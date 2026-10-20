import { AvailabilitySlot } from '../models/booking.models';

/**
 * Date and time helpers for slot picking.
 *
 * Slots travel as ISO instants and are only turned into wall-clock times at
 * the edge, in whichever zone the viewer is in. All formatting goes through
 * Intl so it follows the viewer's locale.
 */

/** The viewer's IANA zone, falling back to UTC where Intl can't say. */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for an instant as seen from `timeZone`. */
export function dayKey(iso: string, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD, which sorts and compares cleanly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** "09:30" or "9:30 AM", depending on locale. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "Thu 2 Oct" — for day tabs. */
export function formatDayShort(iso: string, timeZone: string): {
  weekday: string;
  date: string;
} {
  const date = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'short' }).format(date),
    date: new Intl.DateTimeFormat(undefined, { timeZone, day: 'numeric', month: 'short' }).format(date),
  };
}

/** "Thursday 2 October, 09:30 BST" — for confirmations. */
export function formatSlotLong(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/** "2 Oct 2026, 14:05" — for admin tables. */
export function formatDateTime(iso: string, timeZone = localTimezone()): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export interface SlotDay {
  /** YYYY-MM-DD in the viewer's zone. */
  key: string;
  weekday: string;
  date: string;
  slots: AvailabilitySlot[];
  /** True when at least one slot on this day can still be booked. */
  hasOpenSlots: boolean;
}

/**
 * Groups slots by the viewer's local day. Business hours in Lagos can land
 * on a different calendar day for someone in Auckland, so grouping must
 * happen client-side in the viewer's zone rather than trusting the API.
 */
export function groupSlotsByDay(
  slots: readonly AvailabilitySlot[],
  timeZone: string
): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of slots) {
    const key = dayKey(slot.start, timeZone);
    let day = days.get(key);
    if (!day) {
      day = { key, ...formatDayShort(slot.start, timeZone), slots: [], hasOpenSlots: false };
      days.set(key, day);
    }
    day.slots.push(slot);
    day.hasOpenSlots ||= slot.available;
  }
  return [...days.values()];
}

/* ------------------------------------------------------------------ */
/* Calendar export                                                     */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  uid: string;
  start: string;
  minutes: number;
  title: string;
  description: string;
}

/** 20261002T083000Z */
function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

/** Builds a single-event .ics file body that any calendar app can import. */
export function buildIcs(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = new Date(start.getTime() + event.minutes * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diadem Consults//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@diadem-consults.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
