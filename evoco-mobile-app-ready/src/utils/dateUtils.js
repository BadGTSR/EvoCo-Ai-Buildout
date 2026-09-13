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
