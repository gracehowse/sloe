/**
 * @vitest-environment node
 *
 * ENG-1373 (bug #6) — the web Today "Meals" section header must be bound to
 * the viewed date. Web Today has day-navigation, so a hard-coded "Today's
 * Meals" contradicted the day being shown once the user stepped back a day.
 * `mealsSectionTitle` derives the header from the selected date key.
 */
import { describe, it, expect } from "vitest";
import { mealsSectionTitle, shiftDateKey } from "../../src/lib/nutrition/trackerDate";

const TODAY = "2026-07-07";

describe("mealsSectionTitle", () => {
  it("shows 'Today's Meals' for the current day", () => {
    expect(mealsSectionTitle(TODAY, TODAY)).toBe("Today's Meals");
  });

  it("shows 'Yesterday's Meals' for the previous day — not 'Today's Meals'", () => {
    const yesterday = shiftDateKey(TODAY, -1);
    expect(mealsSectionTitle(yesterday, TODAY)).toBe("Yesterday's Meals");
  });

  it("surfaces the date for an older day so the header never claims 'today'", () => {
    const older = shiftDateKey(TODAY, -5); // 2026-07-02
    const title = mealsSectionTitle(older, TODAY);
    expect(title).not.toContain("Today");
    expect(title).not.toContain("Yesterday");
    expect(title).toContain("Meals");
    // formatDateLabel renders older days as a weekday/day/month string.
    expect(title).toMatch(/\d/); // contains the day number
  });

  it("defaults the reference day to the real today when omitted", () => {
    // Called with only the selected key: a non-today key must not resolve to
    // "Today's Meals" (guards against the old hard-coded string creeping back).
    const notToday = "2000-01-01";
    expect(mealsSectionTitle(notToday)).not.toBe("Today's Meals");
  });

  it("is stable across a day boundary — the previous day is 'Yesterday', two back is dated", () => {
    expect(mealsSectionTitle(shiftDateKey(TODAY, -1), TODAY)).toBe("Yesterday's Meals");
    expect(mealsSectionTitle(shiftDateKey(TODAY, -2), TODAY)).not.toBe("Yesterday's Meals");
  });
});
