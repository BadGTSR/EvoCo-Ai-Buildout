/** Monday–Sunday ISO bounds for "this week", used by Overview and Approvals */
export function getCurrentWeekBounds(now = new Date()) {
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  // Local Y/M/D, not toISOString() (which converts to UTC and rolls back
  // a day for any timezone ahead of UTC before that many hours past midnight).
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    start: iso(monday),
    end: iso(sunday),
    label: `${monday.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}–${sunday.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`,
  };
}

/** The 7 local "YYYY-MM-DD" dates from a week's Monday start through Sunday, for day-by-day breakdowns. */
export function datesInWeek(weekStartISO) {
  const [y, m, d] = weekStartISO.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });
}
