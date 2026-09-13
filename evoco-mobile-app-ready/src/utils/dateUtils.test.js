import { localDateString, formatEntryDate, combineDateAndTime } from './dateUtils';

describe('localDateString', () => {
  it('formats a local date as YYYY-MM-DD using local, not UTC, components', () => {
    const d = new Date(2026, 8, 5); // Sept 5 2026, local midnight
    expect(localDateString(d)).toBe('2026-09-05');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 1); // Jan 1 2026
    expect(localDateString(d)).toBe('2026-01-01');
  });

  it('regression: stays on the correct local day even when toISOString() would roll back a day (UTC+ timezones before local noon)', () => {
    // Local midnight in any timezone ahead of UTC converts to the previous
    // day via toISOString() — this must not affect the local date string.
    const localMidnight = new Date(2026, 8, 14);
    expect(localDateString(localMidnight)).toBe('2026-09-14');
  });

  it('defaults to now when called with no argument', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(localDateString()).toBe(expected);
  });
});

describe('formatEntryDate', () => {
  it('labels the current local day as "Today"', () => {
    const now = new Date(2026, 8, 14, 15, 30);
    expect(formatEntryDate(now, now)).toBe('Today');
  });

  it('labels a different day with a short weekday/date string', () => {
    const now = new Date(2026, 8, 14);
    const yesterday = new Date(2026, 8, 13);
    const label = formatEntryDate(yesterday, now);
    expect(label).not.toBe('Today');
    expect(label).toContain('13');
  });
});

describe('combineDateAndTime', () => {
  it('takes the date from entryDate and the time-of-day from time', () => {
    const entryDate = new Date(2026, 8, 10); // Sept 10
    const time = new Date(2000, 0, 1, 14, 45); // 2:45pm, unrelated date
    const combined = combineDateAndTime(entryDate, time);

    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(8);
    expect(combined.getDate()).toBe(10);
    expect(combined.getHours()).toBe(14);
    expect(combined.getMinutes()).toBe(45);
  });

  it('zeroes seconds and milliseconds', () => {
    const combined = combineDateAndTime(new Date(2026, 8, 10), new Date(2000, 0, 1, 9, 5, 59, 999));
    expect(combined.getSeconds()).toBe(0);
    expect(combined.getMilliseconds()).toBe(0);
  });
});
