/**
 * Goal-pace re-tune helper — pure math + label tests.
 *
 * Authority: extended-competitor-audit task (2026-04-30, Step 2 + 7).
 * The re-tune sheet (mobile) and Settings → Targets flow (web) both
 * call `computeRetunedTargets`. These tests pin:
 *   - kcal adjustment matches `paceToKcalAdjustment`
 *     (7,700 kcal/kg ÷ 7 days conversion).
 *   - macros derive from the new target via `calculateMacros`.
 *   - safety-floor flag fires below the sex-specific floor.
 *   - inferCurrentPace snaps to the closest preset.
 *   - paceLabel renders without celebration/exclamation copy.
 */

import { describe, expect, it } from "vitest";
import {
  computeRetunedTargets,
  inferCurrentPace,
  paceLabel,
  RETUNE_PACE_PRESETS_KG_PER_WEEK,
} from "../../src/lib/nutrition/goalPaceRetune";

describe("computeRetunedTargets — math correctness", () => {
  it("0.5 kg/week loss applies a ~550 kcal deficit (steady)", () => {
    const out = computeRetunedTargets({
      tdeeKcal: 2400,
      goal: "lose",
      strategy: "high_satisfaction",
      weightKg: 80,
      sex: "male",
      paceKgPerWeek: 0.5,
    });
    expect(out).not.toBeNull();
    // 0.5 * 7700 / 7 = 550
    expect(out!.kcalAdjustment).toBe(-550);
    expect(out!.targetCalories).toBe(2400 - 550);
  });

  it("1.0 kg/week loss applies a ~1100 kcal deficit (vigorous)", () => {
    const out = computeRetunedTargets({
      tdeeKcal: 2400,
      goal: "lose",
      strategy: "high_satisfaction",
      weightKg: 80,
      sex: "male",
      paceKgPerWeek: 1.0,
    });
    expect(out).not.toBeNull();
    expect(out!.kcalAdjustment).toBe(-1100);
    expect(out!.targetCalories).toBe(1300);
    // 1300 < 1500 male floor → soft warn
    expect(out!.belowSafetyFloor).toBe(true);
  });

  it("maintain (0 kg/week) lands on TDEE", () => {
    const out = computeRetunedTargets({
      tdeeKcal: 2400,
      goal: "maintain",
      strategy: "balanced",
      weightKg: 80,
      sex: "female",
      paceKgPerWeek: 0,
    });
    expect(out).not.toBeNull();
    expect(out!.targetCalories).toBe(2400);
    expect(out!.kcalAdjustment).toBe(0);
    expect(out!.belowSafetyFloor).toBe(false);
  });

  it("gain at 0.25 kg/week applies a ~275 kcal surplus", () => {
    const out = computeRetunedTargets({
      tdeeKcal: 2200,
      goal: "gain",
      strategy: "high_protein",
      weightKg: 70,
      sex: "male",
      paceKgPerWeek: 0.25,
    });
    expect(out).not.toBeNull();
    // gain magnitude: 0.25 * 7700 / 7 = 275 (positive)
    expect(out!.kcalAdjustment).toBe(275);
    expect(out!.targetCalories).toBe(2475);
  });

  it("returns null for non-positive TDEE", () => {
    expect(
      computeRetunedTargets({
        tdeeKcal: 0,
        goal: "lose",
        strategy: "high_satisfaction",
        weightKg: 80,
        sex: "male",
        paceKgPerWeek: 0.5,
      }),
    ).toBeNull();
  });

  it("macros add up to roughly the target calories", () => {
    const out = computeRetunedTargets({
      tdeeKcal: 2400,
      goal: "lose",
      strategy: "high_satisfaction",
      weightKg: 80,
      sex: "male",
      paceKgPerWeek: 0.5,
    });
    expect(out).not.toBeNull();
    // protein * 4 + carbs * 4 + fat * 9 ≈ targetCalories (within rounding)
    const reconstructed = out!.proteinG * 4 + out!.carbsG * 4 + out!.fatG * 9;
    expect(Math.abs(reconstructed - out!.targetCalories)).toBeLessThanOrEqual(5);
  });
});

describe("inferCurrentPace — snaps to closest preset", () => {
  it("returns 0 for maintain goal", () => {
    expect(
      inferCurrentPace({ tdeeKcal: 2400, targetCalories: 2400, goal: "maintain" }),
    ).toBe(0);
  });

  it("snaps a -550 deficit to 0.5 kg/week", () => {
    expect(
      inferCurrentPace({ tdeeKcal: 2400, targetCalories: 1850, goal: "lose" }),
    ).toBe(0.5);
  });

  it("snaps a -1100 deficit to 1.0 kg/week", () => {
    expect(
      inferCurrentPace({ tdeeKcal: 2400, targetCalories: 1300, goal: "lose" }),
    ).toBe(1.0);
  });

  it("snaps a -275 deficit to 0.25 kg/week", () => {
    expect(
      inferCurrentPace({ tdeeKcal: 2400, targetCalories: 2125, goal: "lose" }),
    ).toBe(0.25);
  });
});

describe("paceLabel — calm copy", () => {
  it("maintain renders as 'Maintain' without exclamation", () => {
    const label = paceLabel(0, "maintain");
    expect(label).toBe("Maintain");
    expect(label).not.toContain("!");
  });

  it("loss formats with kg/week + 'loss' suffix", () => {
    expect(paceLabel(0.5, "lose")).toBe("0.5 kg/week loss");
    expect(paceLabel(1.0, "lose")).toBe("1 kg/week loss");
  });

  it("gain formats with kg/week + 'gain' suffix", () => {
    expect(paceLabel(0.25, "gain")).toBe("0.25 kg/week gain");
  });
});

describe("RETUNE_PACE_PRESETS_KG_PER_WEEK — canonical preset list", () => {
  it("matches the four canonical onboarding paces", () => {
    expect(RETUNE_PACE_PRESETS_KG_PER_WEEK).toEqual([0.25, 0.5, 0.75, 1.0]);
  });
});
