import { describe, it, expect } from "vitest";
import { getCurrentWeekBounds } from "./dateUtils";

function localMidnight(y, m, d) {
  return new Date(y, m - 1, d);
}

describe("getCurrentWeekBounds", () => {
  it("returns a Monday-start, Sunday-end 7-day window for every day of the week", () => {
    // Walk a full month so every getDay() branch (0-6), including the
    // Sunday special case, gets exercised.
    for (let day = 1; day <= 28; day++) {
      const now = localMidnight(2026, 9, day);
      const { start, end } = getCurrentWeekBounds(now);
      const startDate = localMidnight(...start.split("-").map(Number));
      const endDate = localMidnight(...end.split("-").map(Number));

      expect(startDate.getDay()).toBe(1); // Monday
      expect(endDate.getDay()).toBe(0); // Sunday
      expect((endDate - startDate) / 86400000).toBe(6);
      expect(now.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
      expect(now.getTime()).toBeLessThanOrEqual(endDate.getTime());
    }
  });

  it("keeps local calendar dates in a UTC+ timezone (regression: toISOString() rolls back a day before local noon)", () => {
    // Monday local midnight — in NZ (UTC+12/13) this is still the previous
    // day in UTC, so a naive toISOString().split('T')[0] would misreport it.
    const monday = localMidnight(2026, 9, 14);
    const { start } = getCurrentWeekBounds(monday);
    expect(start).toBe("2026-09-14");
  });

  it("produces a human-readable label for the same week", () => {
    const { label } = getCurrentWeekBounds(localMidnight(2026, 9, 16));
    expect(label).toContain("14");
    expect(label).toContain("20");
    expect(label).toContain("2026");
  });
});
