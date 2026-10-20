/**
 * Diadem Consults — booking domain models.
 *
 * Two things can be booked:
 *   1. A consultation call  — by a person or by a business, at a chosen slot
 *   2. A technological request — name, brief description and a reply address
 *
 * Consultations use a discriminated union on `clientType` so a person payload
 * can never carry business fields (or vice versa) past the compiler.
 */

/** Which kind of client is booking a consultation. */
export type ClientType = 'person' | 'business';

/** What is being booked. */
export type BookingKind = 'consultation' | 'request';

/** Lifecycle of a booking once it reaches the backend. */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in-review'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

/** Display copy for each status, so templates don't each spell them out. */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Received',
  confirmed: 'Confirmed',
  'in-review': 'In review',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * The normal path a booking moves along, per kind. `cancelled` can happen
 * from any point and is deliberately not part of either flow.
 */
export const BOOKING_STATUS_FLOW: Record<BookingKind, readonly BookingStatus[]> = {
  consultation: ['pending', 'confirmed', 'completed'],
  request: ['pending', 'in-review', 'scheduled', 'completed'],
};

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

/** A chosen call time. */
export interface SlotSelection {
  /** ISO-8601 instant the call starts, e.g. 2026-10-02T08:30:00.000Z. */
  start: string;
  /**
   * IANA zone the client picked the slot in, e.g. Europe/London. Lets the
   * confirmation email speak in the client's local time.
   */
  timezone: string;
}

/** One bookable call slot offered by the API. */
export interface AvailabilitySlot {
  /** ISO-8601 instant the slot starts. */
  start: string;
  /** False once someone else has taken it. */
  available: boolean;
}

/** Response from GET /availability. */
export interface Availability {
  /** Zone the business hours are defined in, e.g. Africa/Lagos. */
  timezone: string;
  /** Length of each call, in minutes. */
  slotMinutes: number;
  /** Upcoming slots in chronological order. */
  slots: AvailabilitySlot[];
}

/* ------------------------------------------------------------------ */
/* Consultations                                                       */
/* ------------------------------------------------------------------ */

/** An individual booking a consultation call. */
export interface PersonConsultation {
  clientType: 'person';
  /** Full name of the individual. */
  name: string;
  email: string;
  /** E.164 preferred, e.g. +2348012345678. */
  phone: string;
  /** When they want the call. */
  slot: SlotSelection;
  /** Optional free-text note about what they want to discuss. */
  notes?: string;
}

/** A company booking a consultation call. */
export interface BusinessConsultation {
  clientType: 'business';
  businessName: string;
  businessEmail: string;
  /** When they want the call. */
  slot: SlotSelection;
  /** Optional free-text note about what they want to discuss. */
  notes?: string;
}

/** Either shape of consultation, discriminated by `clientType`. */
export type ConsultationDetails = PersonConsultation | BusinessConsultation;

/* ------------------------------------------------------------------ */
/* Technological requests                                              */
/* ------------------------------------------------------------------ */

/** A scoped piece of work someone wants quoted or built. */
export interface RequestDetails {
  /** Short name for the request, e.g. "Migrate billing to Stripe". */
  requestName: string;
  /** A brief description of what is needed. */
  description: string;
  /** Where to send the reply. Also proves ownership on status lookups. */
  email: string;
}

/* ------------------------------------------------------------------ */
/* Submission envelopes                                                */
/* ------------------------------------------------------------------ */

export interface ConsultationBooking {
  kind: 'consultation';
  details: ConsultationDetails;
}

export interface RequestBooking {
  kind: 'request';
  details: RequestDetails;
}

/** Anything the booking service can send. */
export type BookingSubmission = ConsultationBooking | RequestBooking;

/** What the API returns once a booking is accepted. */
export interface BookingReceipt {
  /** Server-assigned reference, e.g. DC-8F2K1A. */
  reference: string;
  kind: BookingKind;
  status: BookingStatus;
  /** ISO-8601 timestamp. */
  submittedAt: string;
  /** Human-readable line the UI can show directly. */
  message: string;
  /** Echoed back for consultations so the confirmation can show the time. */
  slot?: SlotSelection;
}

/* ------------------------------------------------------------------ */
/* Reading bookings back                                               */
/* ------------------------------------------------------------------ */

/**
 * What a client sees when they look up their own booking. Deliberately
 * narrower than the stored record — no phone numbers or notes.
 */
export interface BookingStatusView {
  reference: string;
  kind: BookingKind;
  status: BookingStatus;
  submittedAt: string;
  updatedAt: string;
  displayName: string;
  slot?: SlotSelection;
  requestName?: string;
}

/** Fields every stored booking carries, whatever its kind. */
export interface BookingRecordMeta {
  reference: string;
  status: BookingStatus;
  submittedAt: string;
  updatedAt: string;
  /** Person name, business name, or request name. */
  displayName: string;
  /** Address to reply to. */
  replyTo: string;
}

/** A booking as staff see it in the admin dashboard. */
export type BookingRecord = BookingRecordMeta & BookingSubmission;

/* ------------------------------------------------------------------ */
/* Type guards                                                         */
/* ------------------------------------------------------------------ */

export function isPersonConsultation(
  details: ConsultationDetails
): details is PersonConsultation {
  return details.clientType === 'person';
}

export function isBusinessConsultation(
  details: ConsultationDetails
): details is BusinessConsultation {
  return details.clientType === 'business';
}

export function isConsultationBooking(
  submission: BookingSubmission
): submission is ConsultationBooking {
  return submission.kind === 'consultation';
}

export function isRequestBooking(
  submission: BookingSubmission
): submission is RequestBooking {
  return submission.kind === 'request';
}

/**
 * Best available label for whoever submitted a booking.
 * Useful for confirmation copy and admin lists.
 */
export function describeClient(details: ConsultationDetails): string {
  return isPersonConsultation(details) ? details.name : details.businessName;
}

/** Contact address for a consultation, whichever shape it is. */
export function contactEmail(details: ConsultationDetails): string {
  return isPersonConsultation(details) ? details.email : details.businessEmail;
}
