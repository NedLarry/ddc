import { Injectable } from '@angular/core';

import { BookingRecord, BookingStatus } from '../../booking/models/booking.models';
import { generateSlots } from './mock-schedule';

const BOOKINGS_KEY = 'dc.mock.bookings.v1';
const TOKEN_KEY = 'dc.mock.adminToken';

/** Unambiguous characters for references — no 0/O or 1/I. */
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * The mock API's "database": bookings in localStorage, so they survive a
 * reload and the admin dashboard sees what the public side submitted.
 *
 * Storage can be unavailable (private windows, blocked site data); every
 * access is guarded and the store falls back to memory.
 */
@Injectable({ providedIn: 'root' })
export class MockBookingStore {
  private records: BookingRecord[] = this.load();

  all(): BookingRecord[] {
    return structuredClone(this.records);
  }

  find(reference: string): BookingRecord | undefined {
    const record = this.records.find((r) => r.reference === reference);
    return record ? structuredClone(record) : undefined;
  }

  add(record: BookingRecord): void {
    this.records.unshift(structuredClone(record));
    this.persist();
  }

  setStatus(reference: string, status: BookingStatus): BookingRecord | undefined {
    const record = this.records.find((r) => r.reference === reference);
    if (!record) return undefined;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    this.persist();
    return structuredClone(record);
  }

  /** Slot starts held by live (not cancelled) consultations. */
  takenSlots(): Set<string> {
    const taken = new Set<string>();
    for (const r of this.records) {
      if (r.kind === 'consultation' && r.status !== 'cancelled') {
        taken.add(r.details.slot.start);
      }
    }
    return taken;
  }

  newReference(): string {
    let ref: string;
    do {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      ref = 'DC-' + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
    } while (this.records.some((r) => r.reference === ref));
    return ref;
  }

  /* Admin session ---------------------------------------------------- */

  issueToken(): string {
    const token = crypto.randomUUID();
    safeSet(sessionStorage, TOKEN_KEY, token);
    this.memoryToken = token;
    return token;
  }

  isValidToken(token: string | null): boolean {
    const current = safeGet(sessionStorage, TOKEN_KEY) ?? this.memoryToken;
    return !!token && token === current;
  }

  private memoryToken: string | null = null;

  /* Persistence ------------------------------------------------------ */

  private load(): BookingRecord[] {
    const raw = safeGet(localStorage, BOOKINGS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as BookingRecord[];
      } catch {
        // Corrupt data — fall through and reseed.
      }
    }
    const seeded = seedRecords(new Date());
    safeSet(localStorage, BOOKINGS_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private persist(): void {
    safeSet(localStorage, BOOKINGS_KEY, JSON.stringify(this.records));
  }
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage full or blocked — the in-memory copy still works this session.
  }
}

/**
 * A handful of sample bookings so the dashboard isn't empty on first run.
 * Names are fictional. Consultation slots are taken from the real schedule
 * so they show as booked in the picker.
 */
function seedRecords(now: Date): BookingRecord[] {
  const slots = generateSlots(now);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const slotAt = (i: number) => (slots[Math.min(i, slots.length - 1)] ?? { start: now.toISOString() }).start;

  return [
    {
      reference: 'DC-K7P3QM',
      kind: 'consultation',
      status: 'pending',
      submittedAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
      displayName: 'Adaeze Okafor',
      replyTo: 'adaeze.okafor@example.com',
      details: {
        clientType: 'person',
        name: 'Adaeze Okafor',
        email: 'adaeze.okafor@example.com',
        phone: '+2348031234567',
        slot: { start: slotAt(3), timezone: 'Africa/Lagos' },
        notes: 'Choosing between building an in-house team and outsourcing our mobile app.',
      },
    },
    {
      reference: 'DC-B4R8NW',
      kind: 'consultation',
      status: 'confirmed',
      submittedAt: hoursAgo(26),
      updatedAt: hoursAgo(20),
      displayName: 'Brightline Logistics Ltd',
      replyTo: 'ops@brightline.example',
      details: {
        clientType: 'business',
        businessName: 'Brightline Logistics Ltd',
        businessEmail: 'ops@brightline.example',
        slot: { start: slotAt(12), timezone: 'Europe/London' },
      },
    },
    {
      reference: 'DC-T2H9XE',
      kind: 'request',
      status: 'in-review',
      submittedAt: hoursAgo(50),
      updatedAt: hoursAgo(30),
      displayName: 'Customer portal rebuild',
      replyTo: 'tunde@harbourfoods.example',
      details: {
        requestName: 'Customer portal rebuild',
        description:
          'Our customer portal is a 2016 PHP app. We want a quote for rebuilding it with SSO and a reporting module, ideally before Q2.',
        email: 'tunde@harbourfoods.example',
      },
    },
    {
      reference: 'DC-M6C5VA',
      kind: 'request',
      status: 'pending',
      submittedAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
      displayName: 'Security review of payment flow',
      replyTo: 'cto@paynest.example',
      details: {
        requestName: 'Security review of payment flow',
        description:
          'Independent review of our card payment integration ahead of a PCI assessment. Around 12 endpoints, Node backend.',
        email: 'cto@paynest.example',
      },
    },
  ];
}
