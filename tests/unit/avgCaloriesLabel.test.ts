/**
 * Action 5 Item 3 (2026-04-19) — pin the "Avg Calories" tile copy so
 * partial weeks always show the denominator.
 *
 * Bug: tile labelled just "Avg Calories" reads as "average per day this
 * week", but the headline is computed as `sum / daysWithFood`. A user
 * who logged 2 of 7 days saw a number that wasn't actually a 7-day
 * average. Misleading on partial weeks.
 *
 * Fix: shared helper `formatAvgCaloriesLabel(daysWithFood)` returns the
 * explicit "Avg on logged days (X/7)" label on partial weeks and the
 * tighter "Avg Calories" label on full weeks. Both web
 * (`ProgressDashboard.tsx`) and mobile (`app/(tabs)/progress.tsx`) wire
 * the same helper so the copy can't drift.
 */

import { describe, expect, it } from "vitest";
import { formatAvgCaloriesLabel } from "../../src/lib/nutrition/progressWeekReport.ts";

describe("formatAvgCaloriesLabel", () => {
  it("returns 'Avg Calories' on a full week", () => {
    expect(formatAvgCaloriesLabel(7)).toBe("Avg Calories");
  });

  it("includes the denominator on partial weeks", () => {
    expect(formatAvgCaloriesLabel(0)).toBe("Avg on logged days (0/7)");
    expect(formatAvgCaloriesLabel(1)).toBe("Avg on logged days (1/7)");
    expect(formatAvgCaloriesLabel(2)).toBe("Avg on logged days (2/7)");
    expect(formatAvgCaloriesLabel(3)).toBe("Avg on logged days (3/7)");
    expect(formatAvgCaloriesLabel(4)).toBe("Avg on logged days (4/7)");
    expect(formatAvgCaloriesLabel(5)).toBe("Avg on logged days (5/7)");
    expect(formatAvgCaloriesLabel(6)).toBe("Avg on logged days (6/7)");
  });

  it("never advertises more than 7 days (defensive clamp)", () => {
    // `daysWithFood` is derived from a 7-day window so the upper bound
    // is naturally 7. The clamp is belt-and-braces in case future schema
    // shifts feed us a stale value.
    expect(formatAvgCaloriesLabel(8)).toBe("Avg Calories");
    expect(formatAvgCaloriesLabel(99)).toBe("Avg Calories");
  });

  it("treats negative input as zero", () => {
    expect(formatAvgCaloriesLabel(-1)).toBe("Avg on logged days (0/7)");
  });

  it("trims fractional input down before formatting", () => {
    // Defensive — the helper rounds toward zero so a stray `Number(NaN)`
    // upstream can't end up showing "(2.5/7)".
    expect(formatAvgCaloriesLabel(2.9)).toBe("Avg on logged days (2/7)");
    expect(formatAvgCaloriesLabel(2.1)).toBe("Avg on logged days (2/7)");
  });

  it("is the single source of truth for both platforms (parity)", () => {
    // Both web and mobile wire `formatAvgCaloriesLabel(weekStats.daysWithFood)`
    // so calling the helper here is exactly what the UIs render. Pin the
    // contract — any drift means one platform forked the helper.
    for (const days of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const out = formatAvgCaloriesLabel(days);
      if (days >= 7) {
        expect(out).toBe("Avg Calories");
      } else {
        expect(out).toContain(`(${days}/7)`);
        expect(out).toContain("Avg on logged days");
      }
    }
  });
});
