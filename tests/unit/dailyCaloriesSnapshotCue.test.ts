/**
 * Action 13 Item #11 (2026-04-19) — pin the snapshot vs current-target
 * fallback contract that drives the Daily Calories chart's "approx"
 * visual cue.
 *
 * Bug: when a past day had no `daily_targets` snapshot, drill-down
 * showed "(approx)" but the dashboard's per-day calorie bar colour
 * still used the current-target fallback with no visual cue. The user
 * could see green/amber on a past day that may have been coloured
 * against today's target rather than the target they had at the time.
 *
 * Fix: the chart adds a small dashed border + tooltip on the
 * affected day's bar via `d.isSnapshot === false` && `key < today`.
 *
 * This test pins the helper-side contract (each day carries
 * `isSnapshot`); the rendered cue is exercised in
 * `progressDashboardSnapshotCue.test.tsx` (web) and the mirror in
 * mobile e2e.
 */
import { describe, expect, it } from "vitest";

import { buildWeekStats } from "../../src/lib/nutrition/progressWeekReport";

const TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

function meal(cals = 1500, protein = 100) {
  return { calories: cals, protein, carbs: 60, fat: 20 };
}

describe("buildWeekStats — snapshot fallback flag (Item #11)", () => {
  it("marks days WITHOUT a snapshot as isSnapshot=false", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0); // Wed 15 Apr
    const bundle = buildWeekStats(
      { "2026-04-13": [meal()] },
      TARGETS,
      "monday",
      now,
      // No targetsByDay — every day falls back to current targets.
    );
    const monday = bundle.days.find((d) => d.key === "2026-04-13")!;
    expect(monday.isSnapshot).toBe(false);
    // Falls back to current target, but the helper marks it as approx.
    expect(monday.targetCalories).toBe(2000);
  });

  it("marks days WITH a snapshot as isSnapshot=true", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const bundle = buildWeekStats(
      { "2026-04-13": [meal()] },
      TARGETS,
      "monday",
      now,
      {
        "2026-04-13": {
          targetCalories: 1800,
          targetProtein: 140,
          targetCarbs: 180,
          targetFat: 60,
        },
      },
    );
    const monday = bundle.days.find((d) => d.key === "2026-04-13")!;
    expect(monday.isSnapshot).toBe(true);
    expect(monday.targetCalories).toBe(1800);
  });

  it("a snapshot row with null targetCalories falls back AND marks isSnapshot=false", () => {
    // The "exists but null" path is identical to "no snapshot" — the
    // chart shouldn't promise a snapshot was used when the row was
    // empty.
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const bundle = buildWeekStats(
      { "2026-04-13": [meal()] },
      TARGETS,
      "monday",
      now,
      {
        "2026-04-13": {
          targetCalories: null,
          targetProtein: null,
          targetCarbs: null,
          targetFat: null,
        },
      },
    );
    const monday = bundle.days.find((d) => d.key === "2026-04-13")!;
    expect(monday.isSnapshot).toBe(false);
    expect(monday.targetCalories).toBe(2000);
  });
});
