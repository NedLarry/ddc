import { InjectionToken, inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { BOOKING_API_BASE } from '../../booking/booking.config';
import {
  Availability,
  BOOKING_STATUS_FLOW,
  BookingReceipt,
  BookingRecord,
  BookingStatus,
  BookingStatusView,
  BookingSubmission,
  SlotSelection,
} from '../../booking/models/booking.models';
import { EMAIL_PATTERN } from '../../booking/services/booking.validators';
import { MockBookingStore } from './mock-booking.store';
import { MOCK_SCHEDULE, generateSlots } from './mock-schedule';

/**
 * Stands in for the booking backend. Registered last in the interceptor
 * chain so it sees requests exactly as the real server would. Anything
 * outside the API base passes through untouched.
 *
 * Routes:
 *   GET   /availability
 *   POST  /bookings
 *   GET   /bookings/status?reference=&email=
 *   POST  /admin/session
 *   GET   /admin/bookings
 *   PATCH /admin/bookings/:reference
 */
/**
 * Milliseconds each mock response waits, so loading states are visible as
 * they would be live. Tests provide `() => 0`.
 */
export const MOCK_API_LATENCY = new InjectionToken<() => number>('MOCK_API_LATENCY', {
  providedIn: 'root',
  factory: () => () => 250 + Math.round(Math.random() * 350),
});

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(BOOKING_API_BASE);
  if (!req.url.startsWith(`${base}/`)) {
    return next(req);
  }

  const store = inject(MockBookingStore);
  const wait = inject(MOCK_API_LATENCY)();
  const path = req.url.slice(base.length).split('?')[0];

  // Handle after the delay, as a server would, so each retry is a fresh request.
  return timer(wait).pipe(
    mergeMap(() => {
      try {
        return route(req, path, store);
      } catch (error) {
        console.error('[mock-api]', error);
        return fail(req, 500, 'Mock API error.');
      }
    })
  );
};

type Reply = Observable<HttpEvent<unknown>>;

function route(req: HttpRequest<unknown>, path: string, store: MockBookingStore): Reply {
  const { method } = req;

  if (method === 'GET' && path === '/availability') {
    const body: Availability = {
      timezone: MOCK_SCHEDULE.timezone,
      slotMinutes: MOCK_SCHEDULE.slotMinutes,
      slots: generateSlots(new Date(), store.takenSlots()),
    };
    return ok(body);
  }

  if (method === 'POST' && path === '/bookings') {
    return createBooking(req, store);
  }

  if (method === 'GET' && path === '/bookings/status') {
    return lookupStatus(req, store);
  }

  if (method === 'POST' && path === '/admin/session') {
    const passcode = (req.body as { passcode?: unknown } | null)?.passcode;
    if (passcode !== environment.mockAdminPasscode) {
      return fail(req, 401, 'That passcode is not right.');
    }
    return ok({ token: store.issueToken() });
  }

  if (path.startsWith('/admin/')) {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    if (!store.isValidToken(token)) {
      return fail(req, 401, 'Your session has expired. Sign in again.');
    }

    if (method === 'GET' && path === '/admin/bookings') {
      return ok(store.all());
    }

    const match = /^\/admin\/bookings\/([A-Z0-9-]+)$/.exec(path);
    if (method === 'PATCH' && match) {
      return updateStatus(req, match[1], store);
    }
  }

  return fail(req, 404, 'Not found.');
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function createBooking(req: HttpRequest<unknown>, store: MockBookingStore): Reply {
  const parsed = parseSubmission(req.body);
  if (typeof parsed === 'string') {
    return fail(req, 422, parsed);
  }

  if (parsed.kind === 'consultation') {
    const start = parsed.details.slot.start;
    const offered = generateSlots(new Date()).some((s) => s.start === start);
    if (!offered) {
      return fail(req, 422, 'That time is no longer offered. Pick another slot.');
    }
    if (store.takenSlots().has(start)) {
      return fail(req, 409, 'Someone booked that time moments ago. Pick another slot.');
    }
  }

  const now = new Date().toISOString();
  const record: BookingRecord = {
    ...parsed,
    reference: store.newReference(),
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
    displayName: displayNameOf(parsed),
    replyTo: replyToOf(parsed),
  };
  store.add(record);

  const receipt: BookingReceipt = {
    reference: record.reference,
    kind: record.kind,
    status: record.status,
    submittedAt: record.submittedAt,
    message:
      record.kind === 'consultation'
        ? "Received. We'll confirm your call by email within one business day."
        : "Received. We'll reply with next steps within one business day.",
    ...(record.kind === 'consultation' ? { slot: record.details.slot } : {}),
  };
  return ok(receipt, 201);
}

function lookupStatus(req: HttpRequest<unknown>, store: MockBookingStore): Reply {
  const reference = (req.params.get('reference') ?? '').trim().toUpperCase();
  const email = (req.params.get('email') ?? '').trim().toLowerCase();
  const record = store.find(reference);

  // Same answer for "no such reference" and "wrong email" — don't confirm
  // that a reference exists to someone who doesn't own it.
  if (!record || record.replyTo.toLowerCase() !== email) {
    return fail(req, 404, "We couldn't find a booking with that reference and email.");
  }

  const view: BookingStatusView = {
    reference: record.reference,
    kind: record.kind,
    status: record.status,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
    displayName: record.displayName,
    ...(record.kind === 'consultation'
      ? { slot: record.details.slot }
      : { requestName: record.details.requestName }),
  };
  return ok(view);
}

function updateStatus(req: HttpRequest<unknown>, reference: string, store: MockBookingStore): Reply {
  const existing = store.find(reference);
  if (!existing) {
    return fail(req, 404, 'Booking not found.');
  }
  const status = (req.body as { status?: unknown } | null)?.status;
  const allowed: readonly string[] = [...BOOKING_STATUS_FLOW[existing.kind], 'cancelled'];
  if (typeof status !== 'string' || !allowed.includes(status)) {
    return fail(req, 422, `"${String(status)}" is not a valid status for a ${existing.kind}.`);
  }
  return ok(store.setStatus(reference, status as BookingStatus));
}

/* ------------------------------------------------------------------ */
/* Server-side validation                                              */
/* ------------------------------------------------------------------ */

/** Rebuilds a submission from the flattened wire format, or explains why not. */
function parseSubmission(body: unknown): BookingSubmission | string {
  if (!body || typeof body !== 'object') return 'Missing booking details.';
  const b = body as Record<string, unknown>;
  const text = (key: string) => (typeof b[key] === 'string' ? (b[key] as string).trim() : '');
  const notes = text('notes');

  if (b['kind'] === 'request') {
    const requestName = text('requestName');
    const description = text('description');
    const email = text('email');
    if (requestName.length < 3) return 'Give the request a short name.';
    if (description.length < 20) return 'Add a little more detail to the description.';
    if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
    return { kind: 'request', details: { requestName, description, email } };
  }

  if (b['kind'] !== 'consultation') return 'Unknown booking type.';

  const slot = b['slot'] as Partial<SlotSelection> | undefined;
  if (!slot || typeof slot.start !== 'string' || Number.isNaN(Date.parse(slot.start))) {
    return 'Choose a time for your call.';
  }
  const cleanSlot: SlotSelection = {
    start: new Date(slot.start).toISOString(),
    timezone: typeof slot.timezone === 'string' ? slot.timezone : 'UTC',
  };

  if (b['clientType'] === 'person') {
    const name = text('name');
    const email = text('email');
    const phone = text('phone');
    if (name.length < 2) return 'Enter your full name.';
    if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
    if (!/^\+?\d{7,15}$/.test(phone)) return 'Enter a valid phone number.';
    return {
      kind: 'consultation',
      details: { clientType: 'person', name, email, phone, slot: cleanSlot, ...(notes ? { notes } : {}) },
    };
  }

  if (b['clientType'] === 'business') {
    const businessName = text('businessName');
    const businessEmail = text('businessEmail');
    if (businessName.length < 2) return 'Enter the business name.';
    if (!EMAIL_PATTERN.test(businessEmail)) return 'Enter a valid business email address.';
    return {
      kind: 'consultation',
      details: { clientType: 'business', businessName, businessEmail, slot: cleanSlot, ...(notes ? { notes } : {}) },
    };
  }

  return 'Tell us whether you are booking as an individual or a business.';
}

function displayNameOf(s: BookingSubmission): string {
  if (s.kind === 'request') return s.details.requestName;
  return s.details.clientType === 'person' ? s.details.name : s.details.businessName;
}

function replyToOf(s: BookingSubmission): string {
  if (s.kind === 'request') return s.details.email;
  return s.details.clientType === 'person' ? s.details.email : s.details.businessEmail;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

function ok(body: unknown, status = 200): Reply {
  return of(new HttpResponse({ status, body: structuredClone(body) }));
}

function fail(req: HttpRequest<unknown>, status: number, message: string): Reply {
  return throwError(
    () =>
      new HttpErrorResponse({
        status,
        statusText: String(status),
        error: { message },
        url: req.url,
      })
  );
}
