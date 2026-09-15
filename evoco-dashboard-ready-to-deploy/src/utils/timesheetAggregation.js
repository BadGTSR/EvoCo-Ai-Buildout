/** Entry types that count towards paid hours — work and paid breaks. Unpaid breaks don't. */
export const PAYABLE_ENTRY_TYPES = ["work", "paid_break"];

/**
 * Whether an entry counts as approved hours right now: not backdated at
 * all, or backdated and a manager has since approved it. A backdated entry
 * that's still pending (or was rejected) stays excluded from every hours
 * total until/unless it's approved — that's the whole point of routing it
 * through backdateRequests in the first place.
 */
export function isApprovedForHours(entry) {
  return !entry.isBackdated || entry.backdateApprovalStatus === "approved";
}

/**
 * Turns { userId: [entries] } into per-staff rows with a per-project hours
 * breakdown and a total, for any date range (a week or an arbitrary export
 * range). Work and paid breaks count towards hours; unpaid breaks don't.
 * Backdated entries not yet approved are excluded entirely.
 */
export function aggregateHoursByStaffAndProject(entriesByUser, staff, projects) {
  const projMap = {};
  projects.forEach((p) => {
    projMap[p.id] = p;
  });

  return Object.entries(entriesByUser).map(([userId, entries]) => {
    const person = staff.find((s) => s.id === userId) || { displayName: "Unknown", id: userId };
    const workEntries = entries.filter((e) => PAYABLE_ENTRY_TYPES.includes(e.entryType) && isApprovedForHours(e));

    const minutesByProject = {};
    for (const e of workEntries) {
      const code = projMap[e.projectId]?.projectCode || "—";
      minutesByProject[code] = (minutesByProject[code] || 0) + (e.durationMinutes || 0);
    }

    const projectHours = Object.entries(minutesByProject)
      .map(([projectCode, minutes]) => ({ projectCode, hours: minutes / 60 }))
      .sort((a, b) => b.hours - a.hours);

    const totalHours = projectHours.reduce((sum, p) => sum + p.hours, 0);

    return {
      userId,
      name: person.displayName || person.email || userId,
      totalHours,
      projectHours,
      entries,
    };
  });
}

/**
 * Per-staff row for the Overview's weekly grid: hours per day (Mon-Sun,
 * approved only) plus a green "approved total" and a red "unapproved
 * total" (hours sitting in a still-pending or rejected backdate request).
 */
export function aggregateDailyHoursByStaff(entriesByUser, staff, weekDates) {
  return Object.entries(entriesByUser).map(([userId, entries]) => {
    const person = staff.find((s) => s.id === userId) || { displayName: "Unknown", id: userId };
    const minutesByDate = Object.fromEntries(weekDates.map((d) => [d, 0]));
    let unapprovedMinutes = 0;

    for (const e of entries) {
      if (!PAYABLE_ENTRY_TYPES.includes(e.entryType)) continue;
      if (!isApprovedForHours(e)) {
        unapprovedMinutes += e.durationMinutes || 0;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(minutesByDate, e.date)) {
        minutesByDate[e.date] += e.durationMinutes || 0;
      }
    }

    const dailyHours = weekDates.map((d) => minutesByDate[d] / 60);
    const approvedTotalHours = dailyHours.reduce((sum, h) => sum + h, 0);

    return {
      userId,
      name: person.displayName || person.email || userId,
      dailyHours,
      approvedTotalHours,
      unapprovedTotalHours: unapprovedMinutes / 60,
    };
  });
}
