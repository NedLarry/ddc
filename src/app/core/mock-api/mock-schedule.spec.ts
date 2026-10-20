import { MOCK_SCHEDULE, generateSlots } from './mock-schedule';

/** Wall-clock hour and weekday in Lagos (UTC+1, no DST). */
function lagos(iso: string): { hour: number; minute: number; weekday: number } {
  const d = new Date(Date.parse(iso) + MOCK_SCHEDULE.utcOffsetMinutes * 60_000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

describe('generateSlots', () => {
  // Monday 28 Sep 2026, 07:00 in Lagos.
  const monday = new Date('2026-09-28T06:00:00.000Z');

  it('only offers weekday slots inside business hours', () => {
    const slots = generateSlots(monday);
    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      const { hour, minute, weekday } = lagos(slot.start);
      expect(weekday).not.toBe(0);
      expect(weekday).not.toBe(6);
      expect(hour * 60 + minute).toBeGreaterThanOrEqual(MOCK_SCHEDULE.openHour * 60);
      expect(hour * 60 + minute + MOCK_SCHEDULE.slotMinutes).toBeLessThanOrEqual(MOCK_SCHEDULE.closeHour * 60);
    }
  });

  it('starts at 09:00 Lagos time, which is 08:00Z', () => {
    expect(generateSlots(monday)[0].start).toBe('2026-09-28T08:00:00.000Z');
  });

  it('respects minimum notice', () => {
    // 10:15 Lagos — earliest allowed start is 12:15, so first slot is 12:30.
    const slots = generateSlots(new Date('2026-09-28T09:15:00.000Z'));
    expect(slots[0].start).toBe('2026-09-28T11:30:00.000Z');
  });

  it('skips a weekend entirely', () => {
    const saturday = new Date('2026-10-03T06:00:00.000Z');
    const first = lagos(generateSlots(saturday)[0].start);
    expect(first.weekday).toBe(1);
  });

  it('marks taken slots unavailable', () => {
    const taken = new Set(['2026-09-28T08:30:00.000Z']);
    const slots = generateSlots(monday, taken);
    expect(slots.find((s) => s.start === '2026-09-28T08:30:00.000Z')?.available).toBe(false);
    expect(slots.find((s) => s.start === '2026-09-28T08:00:00.000Z')?.available).toBe(true);
  });
});
