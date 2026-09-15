import { describe, it, expect } from "vitest";
import { aggregateHoursByStaffAndProject, aggregateDailyHoursByStaff, isApprovedForHours } from "./timesheetAggregation";

const staff = [
  { id: "u1", displayName: "Alice" },
  { id: "u2", displayName: "Bob" },
];
const projects = [
  { id: "p1", projectCode: "PRJ-A" },
  { id: "p2", projectCode: "PRJ-B" },
];

describe("aggregateHoursByStaffAndProject", () => {
  it("splits a staff member's hours out per project", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 240 },
        { entryType: "work", projectId: "p2", durationMinutes: 120 },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);

    expect(row.name).toBe("Alice");
    expect(row.totalHours).toBe(6);
    expect(row.projectHours).toEqual([
      { projectCode: "PRJ-A", hours: 4 },
      { projectCode: "PRJ-B", hours: 2 },
    ]);
  });

  it("sums multiple entries in the same project", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 60 },
        { entryType: "work", projectId: "p1", durationMinutes: 90 },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.projectHours).toEqual([{ projectCode: "PRJ-A", hours: 2.5 }]);
  });

  it("counts paid breaks towards hours but excludes unpaid breaks", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 240 },
        { entryType: "paid_break", projectId: "p1", durationMinutes: 30 },
        { entryType: "unpaid_break", projectId: "p1", durationMinutes: 30 },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.totalHours).toBe(4.5);
  });

  it("handles multiple staff independently", () => {
    const entriesByUser = {
      u1: [{ entryType: "work", projectId: "p1", durationMinutes: 480 }],
      u2: [{ entryType: "work", projectId: "p2", durationMinutes: 300 }],
    };

    const rows = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    const alice = rows.find((r) => r.userId === "u1");
    const bob = rows.find((r) => r.userId === "u2");
    expect(alice.totalHours).toBe(8);
    expect(bob.totalHours).toBe(5);
  });

  it("falls back to a placeholder project code when the project is unknown", () => {
    const entriesByUser = {
      u1: [{ entryType: "work", projectId: "missing-project", durationMinutes: 60 }],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.projectHours).toEqual([{ projectCode: "—", hours: 1 }]);
  });

  it("returns zero total and no project rows for a staff member with only breaks", () => {
    const entriesByUser = {
      u1: [{ entryType: "unpaid_break", projectId: "p1", durationMinutes: 30 }],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.totalHours).toBe(0);
    expect(row.projectHours).toEqual([]);
  });

  it("excludes a backdated entry that hasn't been approved yet", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 240 },
        { entryType: "work", projectId: "p1", durationMinutes: 120, isBackdated: true, backdateApprovalStatus: "pending" },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.totalHours).toBe(4);
  });

  it("includes a backdated entry once it's been approved", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 240, isBackdated: true, backdateApprovalStatus: "approved" },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.totalHours).toBe(4);
  });
});

describe("isApprovedForHours", () => {
  it("is true for a normal, non-backdated entry", () => {
    expect(isApprovedForHours({ isBackdated: false })).toBe(true);
    expect(isApprovedForHours({})).toBe(true);
  });

  it("is false for a backdated entry still pending", () => {
    expect(isApprovedForHours({ isBackdated: true, backdateApprovalStatus: "pending" })).toBe(false);
  });

  it("is false for a rejected backdated entry", () => {
    expect(isApprovedForHours({ isBackdated: true, backdateApprovalStatus: "rejected" })).toBe(false);
  });

  it("is true for a backdated entry once approved", () => {
    expect(isApprovedForHours({ isBackdated: true, backdateApprovalStatus: "approved" })).toBe(true);
  });
});

describe("aggregateDailyHoursByStaff", () => {
  const weekDates = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];

  it("buckets approved hours into the correct day of the week", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", date: "2026-09-14", durationMinutes: 480 },
        { entryType: "work", date: "2026-09-16", durationMinutes: 240 },
      ],
    };

    const [row] = aggregateDailyHoursByStaff(entriesByUser, staff, weekDates);
    expect(row.dailyHours).toEqual([8, 0, 4, 0, 0, 0, 0]);
    expect(row.approvedTotalHours).toBe(12);
    expect(row.unapprovedTotalHours).toBe(0);
  });

  it("routes unapproved backdated hours to unapprovedTotalHours instead of any day column", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", date: "2026-09-14", durationMinutes: 480, isBackdated: true, backdateApprovalStatus: "pending" },
      ],
    };

    const [row] = aggregateDailyHoursByStaff(entriesByUser, staff, weekDates);
    expect(row.dailyHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(row.approvedTotalHours).toBe(0);
    expect(row.unapprovedTotalHours).toBe(8);
  });

  it("ignores entries outside the given week and unpaid breaks", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", date: "2026-09-01", durationMinutes: 480 },
        { entryType: "unpaid_break", date: "2026-09-14", durationMinutes: 30 },
      ],
    };

    const [row] = aggregateDailyHoursByStaff(entriesByUser, staff, weekDates);
    expect(row.approvedTotalHours).toBe(0);
  });
});
