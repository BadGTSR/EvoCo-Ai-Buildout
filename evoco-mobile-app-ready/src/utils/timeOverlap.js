/**
 * Whether [startA, endA) overlaps [startB, endB). Touching boundaries — one
 * entry ending exactly when the next starts (6:30–9:00, then 9:00–5:00) —
 * are NOT an overlap; that's how entries are meant to chain through the day.
 */
export function rangesOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/** First entry (if any) whose time range overlaps [start, end), ignoring excludeId (the entry being edited, if any). */
export function findOverlappingEntry(start, end, entries, excludeId) {
  return entries.find((e) => {
    if (excludeId && e.id === excludeId) return false;
    if (!e.startTime || !e.endTime) return false;
    return rangesOverlap(start, end, e.startTime, e.endTime);
  });
}
