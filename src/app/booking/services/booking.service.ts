import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, finalize, retry, tap } from 'rxjs/operators';

import { BOOKING_API_BASE } from '../booking.config';
import {
  Availability,
  BookingReceipt,
  BookingStatusView,
  BookingSubmission,
  BusinessConsultation,
  ClientType,
  ConsultationDetails,
  PersonConsultation,
  RequestDetails,
  SlotSelection,
  contactEmail,
  describeClient,
  isConsultationBooking,
} from '../models/booking.models';

import {
  normalisePhone,
  normaliseWhitespace,
  notBlank,
  phoneNumber,
  strictEmail,
  trimmedLength,
} from './booking.validators';

/* ------------------------------------------------------------------ */
/* Typed form shapes                                                   */
/* ------------------------------------------------------------------ */

export interface PersonConsultationForm {
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  notes: FormControl<string>;
}

export interface BusinessConsultationForm {
  businessName: FormControl<string>;
  businessEmail: FormControl<string>;
  notes: FormControl<string>;
}

export interface RequestForm {
  requestName: FormControl<string>;
  description: FormControl<string>;
  email: FormControl<string>;
}

/** Field limits, exported so templates can drive counters and `maxlength`. */
export const BOOKING_LIMITS = {
  name: { min: 2, max: 80 },
  businessName: { min: 2, max: 120 },
  requestName: { min: 3, max: 120 },
  description: { min: 20, max: 1000 },
  notes: { max: 500 },
} as const;

/**
 * Thrown by `submit()` on failure. Carries the HTTP status so a component
 * can react to specific cases (e.g. 409 — the slot was just taken) while
 * still showing `message` as-is.
 */
export class BookingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'BookingError';
  }
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(BOOKING_API_BASE);

  private readonly endpoint = `${this.apiBase}/bookings`;

  /* ---------------------------------------------------------------- */
  /* Reactive state                                                    */
  /* ---------------------------------------------------------------- */

  private readonly _submitting = signal(false);
  private readonly _receipt = signal<BookingReceipt | null>(null);
  private readonly _error = signal<string | null>(null);

  /** True while a submission is in flight — bind to disable the submit button. */
  readonly submitting = this._submitting.asReadonly();
  /** The receipt from the last successful submission, if any. */
  readonly receipt = this._receipt.asReadonly();
  /** A user-facing error message from the last failed submission. */
  readonly error = this._error.asReadonly();
  /** Convenience flag for showing a success panel. */
  readonly succeeded = computed(() => this._receipt() !== null);

  /* ---------------------------------------------------------------- */
  /* Form construction                                                 */
  /* ---------------------------------------------------------------- */

  /** Consultation form for an individual: name, email, phone. */
  createPersonConsultationForm(): FormGroup<PersonConsultationForm> {
    return this.fb.nonNullable.group<PersonConsultationForm>({
      name: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        trimmedLength(BOOKING_LIMITS.name.min, BOOKING_LIMITS.name.max),
      ]),
      email: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        strictEmail(),
      ]),
      phone: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        phoneNumber(),
      ]),
      notes: this.fb.nonNullable.control('', [
        trimmedLength(0, BOOKING_LIMITS.notes.max),
      ]),
    });
  }

  /** Consultation form for a business: business name and business email. */
  createBusinessConsultationForm(): FormGroup<BusinessConsultationForm> {
    return this.fb.nonNullable.group<BusinessConsultationForm>({
      businessName: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        trimmedLength(
          BOOKING_LIMITS.businessName.min,
          BOOKING_LIMITS.businessName.max
        ),
      ]),
      businessEmail: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        strictEmail(),
      ]),
      notes: this.fb.nonNullable.control('', [
        trimmedLength(0, BOOKING_LIMITS.notes.max),
      ]),
    });
  }

  /** Technological request form: request name, brief description, reply address. */
  createRequestForm(): FormGroup<RequestForm> {
    return this.fb.nonNullable.group<RequestForm>({
      requestName: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        trimmedLength(
          BOOKING_LIMITS.requestName.min,
          BOOKING_LIMITS.requestName.max
        ),
      ]),
      description: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        trimmedLength(
          BOOKING_LIMITS.description.min,
          BOOKING_LIMITS.description.max
        ),
      ]),
      email: this.fb.nonNullable.control('', [
        Validators.required,
        notBlank(),
        strictEmail(),
      ]),
    });
  }

  /**
   * Builds whichever consultation form matches the selected client type.
   * Call this from a component when the person/business toggle changes.
   */
  createConsultationForm(
    clientType: ClientType
  ): FormGroup<PersonConsultationForm> | FormGroup<BusinessConsultationForm> {
    return clientType === 'person'
      ? this.createPersonConsultationForm()
      : this.createBusinessConsultationForm();
  }

  /**
   * The chosen slot's ISO start. Kept separate from the person/business
   * forms so switching client type doesn't lose the picked time.
   */
  createSlotControl(): FormControl<string> {
    return this.fb.nonNullable.control('', [Validators.required]);
  }

  /* ---------------------------------------------------------------- */
  /* Mapping form values to payloads                                   */
  /* ---------------------------------------------------------------- */

  /** Trims and normalises a person form into a domain object. */
  toPersonConsultation(
    form: FormGroup<PersonConsultationForm>,
    slot: SlotSelection
  ): PersonConsultation {
    const { name, email, phone, notes } = form.getRawValue();
    const payload: PersonConsultation = {
      clientType: 'person',
      name: normaliseWhitespace(name),
      email: email.trim().toLowerCase(),
      phone: normalisePhone(phone),
      slot,
    };
    const cleanedNotes = normaliseWhitespace(notes);
    if (cleanedNotes) {
      payload.notes = cleanedNotes;
    }
    return payload;
  }

  /** Trims and normalises a business form into a domain object. */
  toBusinessConsultation(
    form: FormGroup<BusinessConsultationForm>,
    slot: SlotSelection
  ): BusinessConsultation {
    const { businessName, businessEmail, notes } = form.getRawValue();
    const payload: BusinessConsultation = {
      clientType: 'business',
      businessName: normaliseWhitespace(businessName),
      businessEmail: businessEmail.trim().toLowerCase(),
      slot,
    };
    const cleanedNotes = normaliseWhitespace(notes);
    if (cleanedNotes) {
      payload.notes = cleanedNotes;
    }
    return payload;
  }

  /** Trims a request form into a domain object. */
  toRequestDetails(form: FormGroup<RequestForm>): RequestDetails {
    const { requestName, description, email } = form.getRawValue();
    return {
      requestName: normaliseWhitespace(requestName),
      description: description.trim(),
      email: email.trim().toLowerCase(),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Reading                                                           */
  /* ---------------------------------------------------------------- */

  /** Upcoming consultation slots. */
  getAvailability(): Observable<Availability> {
    return this.http.get<Availability>(`${this.apiBase}/availability`);
  }

  /**
   * Looks up a booking by reference. The email must match the one on the
   * booking, so a guessed reference alone reveals nothing.
   */
  lookupStatus(reference: string, email: string): Observable<BookingStatusView> {
    const params = new HttpParams()
      .set('reference', reference.trim().toUpperCase())
      .set('email', email.trim().toLowerCase());
    return this.http.get<BookingStatusView>(`${this.endpoint}/status`, { params });
  }

  /* ---------------------------------------------------------------- */
  /* Submission                                                        */
  /* ---------------------------------------------------------------- */

  /** Submits a consultation booking. */
  submitConsultation(
    details: ConsultationDetails
  ): Observable<BookingReceipt> {
    return this.submit({ kind: 'consultation', details });
  }

  /** Submits a technological request. */
  submitRequest(details: RequestDetails): Observable<BookingReceipt> {
    return this.submit({ kind: 'request', details });
  }

  /**
   * Posts any booking and tracks state along the way.
   *
   * Retries twice on transient failures with a backoff. 4xx responses are
   * not retried — a validation error will fail the same way every time.
   */
  submit(submission: BookingSubmission): Observable<BookingReceipt> {
    this._submitting.set(true);
    this._error.set(null);

    return this.http
      .post<BookingReceipt>(this.endpoint, this.serialise(submission))
      .pipe(
        retry({
          count: 2,
          delay: (error: HttpErrorResponse, retryCount: number) => {
            const isClientError = error.status >= 400 && error.status < 500;
            if (isClientError) {
              return throwError(() => error);
            }
            return timer(retryCount * 500);
          },
        }),
        tap((receipt) => this._receipt.set(receipt)),
        catchError((error: HttpErrorResponse) => {
          const message = this.describeError(error);
          this._error.set(message);
          return throwError(() => new BookingError(message, error.status));
        }),
        finalize(() => this._submitting.set(false))
      );
  }

  /**
   * Flattens the envelope for transport. Keeps `kind` at the top level so a
   * backend can route on it without unwrapping `details`.
   */
  private serialise(submission: BookingSubmission): Record<string, unknown> {
    const base = {
      kind: submission.kind,
      submittedAt: new Date().toISOString(),
    };

    if (isConsultationBooking(submission)) {
      return {
        ...base,
        ...submission.details,
        // Denormalised for convenience on the receiving end.
        displayName: describeClient(submission.details),
        replyTo: contactEmail(submission.details),
      };
    }

    return {
      ...base,
      ...submission.details,
      displayName: submission.details.requestName,
      replyTo: submission.details.email,
    };
  }

  /** Turns an HTTP failure into something worth showing a user. */
  private describeError(error: HttpErrorResponse): string {
    const detail: unknown = error.error?.message;
    const serverMessage = typeof detail === 'string' ? detail : null;

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    if (error.status === 400 || error.status === 422) {
      return serverMessage ?? 'Some details were rejected. Review the form and try again.';
    }
    if (error.status === 409) {
      return serverMessage ?? 'A booking with these details already exists.';
    }
    if (error.status === 429) {
      return 'Too many attempts. Wait a moment before trying again.';
    }
    if (error.status >= 500) {
      return 'The server had a problem. Try again shortly.';
    }
    return 'Something went wrong submitting your booking.';
  }

  /* ---------------------------------------------------------------- */
  /* Helpers for components                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Marks every control touched so validation messages appear.
   * Call before submitting when the form is invalid.
   */
  revealErrors(form: FormGroup): void {
    form.markAllAsTouched();
    Object.values(form.controls).forEach((control) =>
      control.updateValueAndValidity({ emitEvent: false })
    );
  }

  /** Clears the last receipt and error — use when opening a fresh form. */
  reset(): void {
    this._receipt.set(null);
    this._error.set(null);
    this._submitting.set(false);
  }
}
