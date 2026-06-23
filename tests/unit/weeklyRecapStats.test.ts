/**
 * deriveWeeklyRecapStats (ENG-1225 #4) — the shared web↔mobile derivation for
 * the shareable Weekly Recap card. Pins the sparkline series, on-target count,
 * and the narrative thresholds so the two platforms can never drift.
 */
import { describe, expect, it } from "vitest";
import { deriveWeeklyRecapStats } from "../../src/lib/nutrition-core/weeklyRecapStats";

const day = (calories: number) => ({ totals: { calories } });

describe("deriveWeeklyRecapStats", () => {
  it("maps daily calories (Mon→Sun), nulling un-logged days", () => {
    const out = deriveWeeklyRecapStats(
      [day(1800), day(0), day(2100.4), day(0), day(1700), day(0), day(0)],
      2000,
    );
    expect(out.dailyCalories).toEqual([1800, null, 2100, null, 1700, null, null]);
    expect(out.loggedDays).toBe(3);
  });

  it("counts on-target days as logged AND at/under target", () => {
    // 1800 ✓, 2000 ✓ (==target), 2100 ✗ (over), 0 ✗ (not logged)
    const out = deriveWeeklyRecapStats(
      [day(1800), day(2000), day(2100), day(0), day(1500), day(0), day(0)],
      2000,
    );
    expect(out.onTargetDays).toBe(3);
  });

  it("derives the narrative from the on-target count", () => {
    expect(deriveWeeklyRecapStats(Array(7).fill(day(0)), 2000).narrative).toBe("A fresh week ahead.");
    expect(
      deriveWeeklyRecapStats([day(1800), day(1800), day(1800), day(1800), day(1800), day(0), day(0)], 2000).narrative,
    ).toBe("A steady, consistent week."); // 5 on target
    expect(
      deriveWeeklyRecapStats([day(1800), day(1800), day(1800), day(0), day(0), day(0), day(0)], 2000).narrative,
    ).toBe("Solid progress this week."); // 3 on target
    expect(
      deriveWeeklyRecapStats([day(1800), day(3000), day(0), day(0), day(0), day(0), day(0)], 2000).narrative,
    ).toBe("Every logged day counts."); // 1 on target, 2 logged
  });
});
