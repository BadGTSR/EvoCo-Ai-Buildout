import { describe, it, expect } from "vitest";
import { aggregateHoursByStaffAndProject } from "./timesheetAggregation";

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

  it("excludes breaks from hours", () => {
    const entriesByUser = {
      u1: [
        { entryType: "work", projectId: "p1", durationMinutes: 240 },
        { entryType: "paid_break", projectId: "p1", durationMinutes: 30 },
        { entryType: "unpaid_break", projectId: "p1", durationMinutes: 30 },
      ],
    };

    const [row] = aggregateHoursByStaffAndProject(entriesByUser, staff, projects);
    expect(row.totalHours).toBe(4);
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
});
