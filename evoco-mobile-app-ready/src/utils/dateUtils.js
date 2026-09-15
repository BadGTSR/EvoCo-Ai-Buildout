/**
 * Local calendar date as YYYY-MM-DD.
 *
 * Not date.toISOString().split('T')[0] — that converts to UTC first, which
 * rolls back a calendar day for any timezone ahead of UTC (e.g. NZ) whenever
 * it's run before that many hours past local midnight. Used everywhere
 * "today" or an entry's date needs to match what the user actually sees on
 * their clock, including check-in lookups and backdate detection.
 */
export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "Today" for a date matching the current local day, otherwise a short weekday/date label. */
export function formatEntryDate(date, now = new Date()) {
  if (date.toDateString() === now.toDateString()) return 'Today';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Applies entryDate's local year/month/day onto time's local hour/minute. */
export function combineDateAndTime(entryDate, time) {
  const combined = new Date(entryDate);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

const DEFAULT_START_HOUR = 6;

/** Latest endTime among a date's entries, or null if none end on that date. */
function latestEndTimeForDate(entries, selectedDate) {
  const dateKey = localDateString(selectedDate);
  const sameDayEntries = entries.filter((entry) => {
    if (!entry?.endTime) return false;
    return localDateString(new Date(entry.endTime)) === dateKey;
  });

  if (sameDayEntries.length === 0) return null;

  const latestEndTime = sameDayEntries.reduce((latest, entry) => {
    const end = new Date(entry.endTime).getTime();
    return !latest || end > latest ? end : latest;
  }, null);

  return new Date(latestEndTime);
}

/** Returns the default new-entry start time for a selected date.
 * If there are entries ending later on that date, chain from the latest end time;
 * otherwise default to 6am on the selected date (the wheel can still be scrolled earlier).
 */
export function defaultStartTimeForDate(entries, selectedDate) {
  const chained = latestEndTimeForDate(entries, selectedDate);
  if (chained) return chained;

  const defaultStart = new Date(selectedDate);
  defaultStart.setHours(DEFAULT_START_HOUR, 0, 0, 0);
  return defaultStart;
}

/**
 * Earliest start time the picker should allow for a selected date — the
 * latest end time already logged that date, or null if there's nothing to
 * chain from yet (so the wheel is unrestricted for the day's first entry).
 */
export function earliestAllowedStartForDate(entries, selectedDate) {
  return latestEndTimeForDate(entries, selectedDate);
}
