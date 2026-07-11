import { describe, expect, it } from "vitest";
import {
  assertLinearHorizon,
  computeTrajectory,
  MAX_LINEAR_PROJECTION_WEEKS,
  projectWeight,
} from "../../src/lib/weightProjection";

describe("projectWeight — direction classifier", () => {
  it("respects an explicit maintenanceTdeeKcal over the goal heuristic", () => {
    // TestFlight build 7 `ALkK-XrcMz_V-D6NrjuVYbo`: user is on a "lose" goal
    // with a 1500 kcal target but their real TDEE (adaptive) is 2800. They
    // ate 1900 — clearly in deficit. The pre-fix heuristic would have used
    // target + 500 = 2000 as the break-even and flagged this as "gain".
    const { direction, dailySurplusDeficit } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 1900,
      targetCalories: 1500,
      maintenanceTdeeKcal: 2800,
      goal: "lose",
    });
    expect(direction).toBe("deficit");
    expect(dailySurplusDeficit).toBe(1900 - 2800);
  });

  it("falls back to target + 500 for lose goal when maintenanceTdeeKcal is missing", () => {
    const { direction } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 2100,
      targetCalories: 1500,
      goal: "lose",
    });
    // 2100 vs fallback 2000 → surplus > 50 threshold.
    expect(direction).toBe("surplus");
  });

  it("ignores maintenanceTdeeKcal when zero or non-finite", () => {
    for (const bad of [0, -100, Number.NaN, null, undefined]) {
      const { direction } = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1500,
        targetCalories: 1500,
        maintenanceTdeeKcal: bad as number | null | undefined,
        goal: "maintain",
      });
      // With maintain + matching target the fallback still produces maintenance.
      expect(direction).toBe("maintenance");
    }
  });

  it("classifies as maintenance when |surplus/deficit| < 50 kcal", () => {
    const { direction } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 2030,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2000,
      goal: "maintain",
    });
    expect(direction).toBe("maintenance");
  });

  it("projects a lower weight when the user is truly in deficit vs their real TDEE", () => {
    const { projectedWeightKg } = projectWeight({
      currentWeightKg: 80,
      todayCalories: 2000,
      targetCalories: 1800,
      maintenanceTdeeKcal: 2700, // real burn
      goal: "lose",
      weeksOut: 5,
    });
    // Deficit = 2000 - 2700 = -700 kcal/day × 35 days = -24,500 kcal.
    // -24,500 / 7700 kcal/kg ≈ -3.18 kg → 80 - 3.18 ≈ 76.8.
    expect(projectedWeightKg).toBeLessThan(80);
    expect(projectedWeightKg).toBeGreaterThan(75);
  });
});

// ─── ENG-1029: linear projection horizon guard ───────────────────────────
//
// The flat 7700 kcal/kg rule over-estimates loss over long horizons, so it
// must never feed a display longer than the 5-week cap. The guard throws
// in dev (so a future caller that stretches the horizon trips a test) and
// clamps the horizon in production. The observed-trend path is exempt.
describe("ENG-1029 projection horizon guard", () => {
  it("the cap is 5 weeks", () => {
    expect(MAX_LINEAR_PROJECTION_WEEKS).toBe(5);
  });

  it("assertLinearHorizon throws (in dev/test) past the cap on the formula path", () => {
    expect(() => assertLinearHorizon(6, false)).toThrow(/5-week cap/);
    expect(() => assertLinearHorizon(12, false)).toThrow();
  });

  it("assertLinearHorizon is a no-op at or under the cap", () => {
    expect(() => assertLinearHorizon(5, false)).not.toThrow();
    expect(() => assertLinearHorizon(1, false)).not.toThrow();
  });

  it("assertLinearHorizon never throws when using the observed trend (a measured signal)", () => {
    // A measured rate over a longer window is legitimate — not the linear
    // extrapolation this guards.
    expect(() => assertLinearHorizon(52, true)).not.toThrow();
  });

  it("projectWeight on the FORMULA path past the cap throws in dev (loud failure for a new caller)", () => {
    expect(() =>
      projectWeight({
        currentWeightKg: 80,
        todayCalories: 2000,
        targetCalories: 1800,
        maintenanceTdeeKcal: 2700,
        goal: "lose",
        weeksOut: 10, // past the 5-week cap, formula path (no observed rate)
      }),
    ).toThrow(/5-week cap/);
  });

  it("projectWeight on the OBSERVED-trend path may project a longer horizon", () => {
    // observedKgPerWeek is reliable + direction-aligned → uses the trend,
    // which is exempt from the linear cap.
    const r = projectWeight({
      currentWeightKg: 80,
      todayCalories: 2000,
      targetCalories: 1800,
      maintenanceTdeeKcal: 2700,
      goal: "lose",
      weeksOut: 10,
      observedKgPerWeek: -0.5, // measured loss, agrees with the deficit
    });
    expect(r.projectionWeeks).toBe(10);
    // 0.5 kg/wk × 10 wk = 5 kg → 80 - 5 = 75.
    expect(r.projectedWeightKg).toBeCloseTo(75, 1);
  });

  it("the default 5-week production path is unchanged (no throw, weeks = 5)", () => {
    const r = projectWeight({
      currentWeightKg: 80,
      todayCalories: 2000,
      targetCalories: 1800,
      maintenanceTdeeKcal: 2700,
      goal: "lose",
      // weeksOut defaults to 5
    });
    expect(r.projectionWeeks).toBe(5);
  });
});

describe("projectWeight — ENG-1506 goal-fallback vocabulary (BOTH flag paths pinned)", () => {
  // The fallback branches historically compared v2 values ('lose'/'gain')
  // only, so profile-sourced DB goals ('cut'/'bulk') silently fell through
  // to `estimatedTdee = targetCalories` whenever maintenance was missing.
  // The DB-vocabulary fix is flag-gated (review round 2026-07-11): hosts
  // pass `normalizeGoalVocabulary: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)`
  // because the fix visibly moves flag-OFF trajectory geometry (flat line →
  // ±slope) for exactly the missing-maintenance population the kill switch
  // protects. Both paths are pinned here so neither can silently regress.

  describe("flag ON (normalizeGoalVocabulary: true) — DB vocabulary reaches the fallback", () => {
    it("'cut' reaches the deficit fallback branch (target + 500)", () => {
      const r = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1900,
        targetCalories: 1500,
        goal: "cut",
        normalizeGoalVocabulary: true,
      });
      // break-even 2000, ate 1900 → deficit
      expect(r.dailySurplusDeficit).toBe(-100);
      expect(r.direction).toBe("deficit");
    });

    it("'bulk' reaches the surplus fallback branch (target − 300)", () => {
      const r = projectWeight({
        currentWeightKg: 75,
        todayCalories: 2500,
        targetCalories: 2600,
        goal: "bulk",
        normalizeGoalVocabulary: true,
      });
      // break-even 2300, ate 2500 → surplus
      expect(r.dailySurplusDeficit).toBe(200);
      expect(r.direction).toBe("surplus");
    });

    it("legacy v2 synonyms keep working ('lose' → +500, 'gain' → −300)", () => {
      const lose = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1900,
        targetCalories: 1500,
        goal: "lose",
        normalizeGoalVocabulary: true,
      });
      expect(lose.dailySurplusDeficit).toBe(-100);
      const gain = projectWeight({
        currentWeightKg: 75,
        todayCalories: 2500,
        targetCalories: 2600,
        goal: "gain",
        normalizeGoalVocabulary: true,
      });
      expect(gain.dailySurplusDeficit).toBe(200);
    });

    it("unknown goal still falls to targetCalories as break-even", () => {
      const r = projectWeight({
        currentWeightKg: 75,
        todayCalories: 2000,
        targetCalories: 2000,
        goal: "garbage",
        normalizeGoalVocabulary: true,
      });
      expect(r.dailySurplusDeficit).toBe(0);
      expect(r.direction).toBe("maintenance");
    });
  });

  describe("flag OFF (default) — the exact pre-ENG-1506 'lose'/'gain'-only comparison", () => {
    it("DB 'cut' falls through to targetCalories (legacy flat-line behaviour)", () => {
      const r = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1900,
        targetCalories: 1500,
        goal: "cut",
      });
      // Legacy: break-even = target (1500), ate 1900 → reads as surplus.
      expect(r.dailySurplusDeficit).toBe(400);
      expect(r.direction).toBe("surplus");
    });

    it("DB 'bulk' falls through to targetCalories (legacy behaviour)", () => {
      const r = projectWeight({
        currentWeightKg: 75,
        todayCalories: 2500,
        targetCalories: 2600,
        goal: "bulk",
      });
      // Legacy: break-even = target (2600), ate 2500 → reads as deficit.
      expect(r.dailySurplusDeficit).toBe(-100);
      expect(r.direction).toBe("deficit");
    });

    it("v2 'lose' / 'gain' keep their historical branches", () => {
      const lose = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1900,
        targetCalories: 1500,
        goal: "lose",
      });
      expect(lose.dailySurplusDeficit).toBe(-100);
      expect(lose.direction).toBe("deficit");
      const gain = projectWeight({
        currentWeightKg: 75,
        todayCalories: 2500,
        targetCalories: 2600,
        goal: "gain",
      });
      expect(gain.dailySurplusDeficit).toBe(200);
      expect(gain.direction).toBe("surplus");
    });
  });

  it("computeTrajectory threads normalizeGoalVocabulary through to projectWeight", () => {
    // Same 7 logged days, cut goal, no maintenance: flag-OFF projects a
    // flat line (break-even = target); flag-ON projects loss (target+500).
    const byDay: Record<string, Array<{ calories: number }>> = {};
    for (let i = 1; i <= 7; i++) {
      byDay[`2026-07-0${i}`] = [{ calories: 1900 }];
    }
    const base = {
      byDay,
      latestWeightKg: 75,
      targetCalories: 1500,
      goal: "cut",
    } as const;
    const off = computeTrajectory({ ...base });
    const on = computeTrajectory({ ...base, normalizeGoalVocabulary: true });
    expect(off?.kind).toBe("projection");
    expect(on?.kind).toBe("projection");
    if (off?.kind === "projection" && on?.kind === "projection") {
      // OFF: 1900 vs 1500 break-even → surplus → projected UP.
      expect(off.projectedKg).toBeGreaterThan(75);
      // ON: 1900 vs 2000 break-even → deficit → projected DOWN.
      expect(on.projectedKg).toBeLessThan(75);
    }
  });
});
