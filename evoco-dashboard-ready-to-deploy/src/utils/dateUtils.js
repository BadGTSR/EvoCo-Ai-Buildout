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
