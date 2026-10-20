import { AvailabilitySlot } from '../../booking/models/booking.models';

/**
 * Business hours the mock API offers slots in. A real backend would own
 * this (and probably read it from a calendar); it lives here so the front
 * end can be exercised end to end.
 */
export const MOCK_SCHEDULE = {
  timezone: 'Africa/Lagos',
  /** Lagos is UTC+1 all year — no DST — so a fixed offset is exact. */
  utcOffsetMinutes: 60,
  openHour: 9,
  closeHour: 17,
  slotMinutes: 30,
  /** Calendar days ahead to offer, counting today. */
  horizonDays: 14,
  /** Slots starting sooner than this are not offered. */
  minNoticeMinutes: 120,
} as const;

/**
 * Every bookable slot start from `now` across the horizon: weekdays only,
 * inside business hours, respecting minimum notice. `taken` marks slots
 * that are already booked.
 */
export function generateSlots(
  now: Date,
  taken: ReadonlySet<string> = new Set()
): AvailabilitySlot[] {
  const s = MOCK_SCHEDULE;
  const offsetMs = s.utcOffsetMinutes * 60_000;
  const earliest = now.getTime() + s.minNoticeMinutes * 60_000;

  // Shift into Lagos wall-clock so the UTC getters read local date parts.
  const local = new Date(now.getTime() + offsetMs);
  const slots: AvailabilitySlot[] = [];

  for (let i = 0; i < s.horizonDays; i++) {
    const dayStartLocal = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + i
    );
    const weekday = new Date(dayStartLocal).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    for (
      let minute = s.openHour * 60;
      minute + s.slotMinutes <= s.closeHour * 60;
      minute += s.slotMinutes
    ) {
      const startMs = dayStartLocal + minute * 60_000 - offsetMs;
      if (startMs < earliest) continue;
      const start = new Date(startMs).toISOString();
      slots.push({ start, available: !taken.has(start) });
    }
  }

  return slots;
}
