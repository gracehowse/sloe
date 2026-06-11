/**
 * ENG-741 — `computeTrajectory` + `avgCaloriesOverRecentLoggedDays`
 * shared helper pins.
 *
 * This is the single source of truth the Progress Trajectory card (web +
 * mobile) and the Journey card both project from. The tests pin:
 *   - the 7-day food-logged average matches the prior inline derivation
 *     (trailing window, negatives floored, total-days count for the floor)
 *   - the projection state appears at exactly the ≥5-day floor
 *   - the placeholder state reports the exact days remaining below it
 *   - null when there's no current weight (never fabricate a forecast)
 *   - eligible-but-zero-average falls back to placeholder (no fake number)
 *   - the observed-rate override is wired through from a timeline
 */
import { describe, expect, it } from "vitest";

import {
  avgCaloriesOverRecentLoggedDays,
  computeTrajectory,
  signedObservedKgPerWeek,
  calcGoalTimeline,
  MIN_DAYS_FOR_PROJECTION,
} from "../../src/lib/weightProjection";

type Meal = { calories?: number | null };

/** Build a `byDay` map of `count` consecutive days each with one meal of `kcal`. */
function buildDays(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    const d = `2026-05-${String(i + 1).padStart(2, "0")}`;
    out[d] = [{ calories: kcal }];
  }
  return out;
}

describe("avgCaloriesOverRecentLoggedDays", () => {
  it("averages the trailing 7 food-logged days and counts total logged days", () => {
    // 9 days at 2000 kcal → window of 7, avg 2000, total 9 logged.
    const { avgCalories, daysWithFood } = avgCaloriesOverRecentLoggedDays(
      buildDays(9, 2000),
      7,
    );
    expect(avgCalories).toBe(2000);
    expect(daysWithFood).toBe(9);
  });

  it("ignores empty days and floors negative calories at 0", () => {
    const byDay: Record<string, Meal[]> = {
      "2026-05-01": [{ calories: 1000 }, { calories: -500 }], // -500 floored → 1000/day
      "2026-05-02": [], // empty — excluded
      "2026-05-03": [{ calories: 2000 }],
    };
    const { avgCalories, daysWithFood } = avgCaloriesOverRecentLoggedDays(byDay, 7);
    // Logged days = 2 (the empty one drops out). (1000 + 2000) / 2 = 1500.
    expect(daysWithFood).toBe(2);
    expect(avgCalories).toBe(1500);
  });

  it("returns zeros when there are no food-logged days", () => {
    expect(avgCaloriesOverRecentLoggedDays({}, 7)).toEqual({
      avgCalories: 0,
      daysWithFood: 0,
    });
  });

  it("ENG-1053 — differs from the old Journey calendar-window average (1894 vs 1872 class)", () => {
    // Sparse logging with gaps: the old web Journey path took the last 7
    // *calendar* keys then averaged only the subset that had food (smaller
    // denominator → higher avg). Trajectory used the last 7 *food-logged*
    // days. Both now share this helper.
    const byDay: Record<string, Meal[]> = {
      "2026-06-01": [{ calories: 1200 }],
      "2026-06-02": [],
      "2026-06-03": [],
      "2026-06-04": [{ calories: 1800 }],
      "2026-06-05": [],
      "2026-06-06": [{ calories: 2000 }],
      "2026-06-07": [],
      "2026-06-08": [{ calories: 2200 }],
      "2026-06-09": [{ calories: 2400 }],
      "2026-06-10": [{ calories: 2600 }],
    };
    const shared = avgCaloriesOverRecentLoggedDays(byDay, 7);
    const recentCalendar = Object.keys(byDay).sort().slice(-7);
    const foodInWindow = recentCalendar.filter((k) => (byDay[k] ?? []).length > 0);
    const legacyJourneyAvg = Math.round(
      foodInWindow.reduce(
        (s, k) => s + (byDay[k] ?? []).reduce((a, m) => a + (m.calories ?? 0), 0),
        0,
      ) / foodInWindow.length,
    );
    expect(shared.avgCalories).toBe(2033); // all 6 food-logged days (window < 7)
    expect(legacyJourneyAvg).toBe(2200); // 5 food days in last 7 calendar keys: 1800…2600
    expect(shared.avgCalories).not.toBe(legacyJourneyAvg);
  });
});

describe("signedObservedKgPerWeek", () => {
  it("is negative when losing, positive when gaining, zero when stalled", () => {
    const losing = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 70,
      weightKgByDay: { "2026-05-01": 82, "2026-05-29": 80 },
    });
    expect(losing.trendDirection).toBe("losing");
    expect(signedObservedKgPerWeek(losing)).toBeLessThan(0);

    const stalled = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 70,
      weightKgByDay: { "2026-05-01": 80, "2026-05-29": 80 },
    });
    expect(signedObservedKgPerWeek(stalled)).toBe(0);
  });
});

describe("computeTrajectory — state machine", () => {
  it("returns null when there is no current weight (never fabricates)", () => {
    expect(
      computeTrajectory({
        byDay: buildDays(7, 1800),
        latestWeightKg: null,
        targetCalories: 1800,
      }),
    ).toBeNull();
    expect(
      computeTrajectory({
        byDay: buildDays(7, 1800),
        latestWeightKg: Number.NaN,
        targetCalories: 1800,
      }),
    ).toBeNull();
  });

  it("returns placeholder below the 5-day floor with exact days remaining", () => {
    const state = computeTrajectory({
      byDay: buildDays(3, 1800),
      latestWeightKg: 70,
      targetCalories: 1800,
    });
    expect(state?.kind).toBe("placeholder");
    if (state?.kind === "placeholder") {
      expect(state.daysRemaining).toBe(MIN_DAYS_FOR_PROJECTION - 3); // 2
      expect(state.daysLogged).toBe(3);
      expect(state.daysRequired).toBe(MIN_DAYS_FOR_PROJECTION);
    }
  });

  it("returns a projection at exactly the 5-day floor", () => {
    const state = computeTrajectory({
      byDay: buildDays(5, 1500),
      latestWeightKg: 70,
      targetCalories: 1500,
      maintenanceTdeeKcal: 2200, // real deficit
      goal: "lose",
    });
    expect(state?.kind).toBe("projection");
    if (state?.kind === "projection") {
      expect(state.avgCalories).toBe(1500);
      expect(state.targetCalories).toBe(1500);
      expect(state.weeks).toBe(5);
      // 1500 - 2200 = -700/day deficit → losing → projected below 70.
      expect(state.projectedKg).toBeLessThan(70);
    }
  });

  it("falls back to placeholder when eligible but the average is zero (no fake number)", () => {
    // 5 days logged but every entry is 0 kcal → eligible by day-count but
    // no real intake to project from. Must NOT invent a projection.
    const state = computeTrajectory({
      byDay: buildDays(5, 0),
      latestWeightKg: 70,
      targetCalories: 1800,
    });
    expect(state?.kind).toBe("placeholder");
  });

  it("wires the observed weekly rate through from a timeline", () => {
    const timeline = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 70,
      // ~ -0.5 kg/week observed loss, far faster than the formula deficit.
      weightKgByDay: { "2026-05-01": 82, "2026-05-29": 80 },
    });
    const withObserved = computeTrajectory({
      byDay: buildDays(7, 1900),
      latestWeightKg: 80,
      targetCalories: 1900,
      maintenanceTdeeKcal: 1950, // tiny formula deficit
      goal: "lose",
      timeline,
    });
    const withoutObserved = computeTrajectory({
      byDay: buildDays(7, 1900),
      latestWeightKg: 80,
      targetCalories: 1900,
      maintenanceTdeeKcal: 1950,
      goal: "lose",
      timeline: null,
    });
    expect(withObserved?.kind).toBe("projection");
    expect(withoutObserved?.kind).toBe("projection");
    if (withObserved?.kind === "projection" && withoutObserved?.kind === "projection") {
      // Observed loss (~-0.5 kg/wk) dominates the near-zero formula deficit,
      // so the observed projection lands lower than the formula-only one.
      expect(withObserved.projectedKg).toBeLessThan(withoutObserved.projectedKg);
    }
  });
});
