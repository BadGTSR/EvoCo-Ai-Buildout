/**
 * Turns { userId: [entries] } into per-staff rows with a per-project hours
 * breakdown and a total, for any date range (a week or an arbitrary export
 * range). Only "work" entries count towards hours — breaks don't.
 */
export function aggregateHoursByStaffAndProject(entriesByUser, staff, projects) {
  const projMap = {};
  projects.forEach((p) => {
    projMap[p.id] = p;
  });

  return Object.entries(entriesByUser).map(([userId, entries]) => {
    const person = staff.find((s) => s.id === userId) || { displayName: "Unknown", id: userId };
    const workEntries = entries.filter((e) => e.entryType === "work");

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
