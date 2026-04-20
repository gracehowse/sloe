import { describe, expect, it } from "vitest";
import {
  computeV2Targets,
  mapGoalToStrategy,
  paceToKcalAdjustment,
  paceWarning,
  safetyFloorFor,
} from "../../src/lib/onboarding/v2/targets";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/v2/state";

/**
 * Onboarding v2 — targets pipeline. Locks in:
 *
 *  - Continuous pace slider (kg/week) → daily kcal adjustment via
 *    7,700 kcal ≈ 1 kg, sign-flipped for cut/recomp vs. gain.
 *  - Mifflin-St Jeor BMR + activity multiplier come straight from the
 *    production calc in `src/lib/nutrition/tdee.ts` — drift between
 *    that file and the v2 wrapper would surface here.
 *  - Goal → strategy mapping for `calculateMacros`.
 *  - Safety floor banners: `info` / `warn` / `danger` triggered by the
 *    documented thresholds, with `null` returned when comfortably safe.
 *
 * Sign-off needed before Phase 2 leaves the flag:
 *  - nutrition-engine on the macro-mapping table.
 *  - legal-reviewer on the `danger` banner wording.
 */

const baseState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

describe("paceToKcalAdjustment", () => {
  it("returns 0 for maintain regardless of pace", () => {
    expect(paceToKcalAdjustment("maintain", 0.5)).toBe(0);
    expect(paceToKcalAdjustment("maintain", 0)).toBe(0);
  });

  it("returns 0 when pace is exactly 0", () => {
    expect(paceToKcalAdjustment("lose", 0)).toBe(0);
    expect(paceToKcalAdjustment("gain", 0)).toBe(0);
  });

  it("returns a negative kcal value for lose (deficit)", () => {
    // 0.5 kg/week × 7,700 / 7 = 550 kcal/day deficit
    expect(paceToKcalAdjustment("lose", 0.5)).toBe(-550);
  });

  it("returns a negative kcal value for recomp (small deficit)", () => {
    // 0.15 kg/week × 7,700 / 7 = 165 kcal/day deficit
    expect(paceToKcalAdjustment("recomp", 0.15)).toBe(-165);
  });

  it("returns a positive kcal value for gain (surplus)", () => {
    // 0.25 kg/week × 7,700 / 7 = 275 kcal/day surplus
    expect(paceToKcalAdjustment("gain", 0.25)).toBe(275);
  });

  it("rounds to the nearest whole kcal", () => {
    // 0.4 × 7,700 / 7 = 440 exactly — no rounding pollution
    expect(paceToKcalAdjustment("lose", 0.4)).toBe(-440);
  });
});

describe("mapGoalToStrategy", () => {
  it("uses high_satisfaction (1.8 g/kg) for lose + recomp", () => {
    expect(mapGoalToStrategy("lose")).toBe("high_satisfaction");
    expect(mapGoalToStrategy("recomp")).toBe("high_satisfaction");
  });

  it("uses balanced (1.6 g/kg) for maintain + gain", () => {
    expect(mapGoalToStrategy("maintain")).toBe("balanced");
    expect(mapGoalToStrategy("gain")).toBe("balanced");
  });
});

describe("safetyFloorFor", () => {
  it("returns 1,500 for male", () => {
    expect(safetyFloorFor("male")).toBe(1500);
  });
  it("returns 1,200 for female", () => {
    expect(safetyFloorFor("female")).toBe(1200);
  });
  it("returns 1,350 (midpoint) for unspecified or null", () => {
    expect(safetyFloorFor("unspecified")).toBe(1350);
    expect(safetyFloorFor(null)).toBe(1350);
  });
});

describe("computeV2Targets — pipeline integration", () => {
  it("returns null when any required input is missing", () => {
    expect(computeV2Targets(baseState())).toBeNull();
    expect(
      computeV2Targets(
        baseState({ sex: "female", goal: "lose" /* still missing activity */ }),
      ),
    ).toBeNull();
  });

  it("computes BMR + TDEE matching the production calc for a textbook female profile", () => {
    // 28y female, 168cm, 62kg, moderate activity — known sane values.
    const t = computeV2Targets(
      baseState({
        sex: "female",
        age: 28,
        heightCm: 168,
        weightKg: 62,
        activity: "moderate",
        goal: "lose",
        paceKgPerWeek: 0.4,
      }),
    );
    expect(t).not.toBeNull();
    // BMR: 10*62 + 6.25*168 - 5*28 - 161 = 620 + 1050 - 140 - 161 = 1369
    expect(t!.bmr).toBe(1369);
    // TDEE: 1369 × 1.55 = 2122 (rounded)
    expect(t!.tdee).toBe(2122);
    // Pace adj: 0.4 × 7700 / 7 = 440 → target 2122 - 440 = 1682
    expect(t!.kcalAdj).toBe(-440);
    expect(t!.target).toBe(1682);
    expect(t!.belowSafetyFloor).toBe(false);
    expect(t!.safety).toBe("safe");
    expect(t!.strategy).toBe("high_satisfaction");
    // Macros are non-negative + reconcile within rounding tolerance.
    expect(t!.proteinG).toBeGreaterThan(0);
    expect(t!.carbsG).toBeGreaterThanOrEqual(0);
    expect(t!.fatG).toBeGreaterThan(0);
    expect(t!.fiberG).toBeGreaterThanOrEqual(15); // calculateMacros floor
    const reconciled = t!.proteinG * 4 + t!.carbsG * 4 + t!.fatG * 9;
    expect(Math.abs(reconciled - t!.target)).toBeLessThanOrEqual(5);
  });

  it("flags belowSafetyFloor for an aggressive pace on a small female", () => {
    const t = computeV2Targets(
      baseState({
        sex: "female",
        age: 25,
        heightCm: 155,
        weightKg: 50,
        activity: "sedentary",
        goal: "lose",
        paceKgPerWeek: 0.9,
      }),
    );
    expect(t).not.toBeNull();
    expect(t!.belowSafetyFloor).toBe(true);
    expect(t!.target).toBeLessThan(1200);
  });

  it("uses the GOAL_DEFAULT_PACE when paceKgPerWeek is null", () => {
    const t = computeV2Targets(
      baseState({
        sex: "male",
        age: 30,
        heightCm: 180,
        weightKg: 80,
        activity: "moderate",
        goal: "lose",
        paceKgPerWeek: null,
      }),
    );
    expect(t).not.toBeNull();
    // Default for lose = 0.4 kg/week → -440 kcal/day adj
    expect(t!.pace).toBe(0.4);
    expect(t!.kcalAdj).toBe(-440);
  });

  it("returns 0 kcalAdj for maintain", () => {
    const t = computeV2Targets(
      baseState({
        sex: "male",
        age: 35,
        heightCm: 175,
        weightKg: 75,
        activity: "moderate",
        goal: "maintain",
      }),
    );
    expect(t).not.toBeNull();
    expect(t!.kcalAdj).toBe(0);
    expect(t!.target).toBe(t!.tdee);
  });

  it("returns positive kcalAdj for gain", () => {
    const t = computeV2Targets(
      baseState({
        sex: "male",
        age: 25,
        heightCm: 180,
        weightKg: 75,
        activity: "active",
        goal: "gain",
        paceKgPerWeek: 0.25,
      }),
    );
    expect(t).not.toBeNull();
    expect(t!.kcalAdj).toBe(275);
    expect(t!.target).toBeGreaterThan(t!.tdee);
  });

  it("treats sex=unspecified as the male/female midpoint", () => {
    const inputs = {
      age: 30,
      heightCm: 170,
      weightKg: 70,
      activity: "moderate" as const,
      goal: "lose" as const,
      paceKgPerWeek: 0.4,
    };
    const male = computeV2Targets(baseState({ ...inputs, sex: "male" }))!;
    const female = computeV2Targets(baseState({ ...inputs, sex: "female" }))!;
    const unspec = computeV2Targets(baseState({ ...inputs, sex: "unspecified" }))!;
    // Unspecified BMR is the rounded midpoint of male/female BMRs.
    expect(unspec.bmr).toBe(Math.round((male.bmr + female.bmr) / 2));
  });
});

describe("paceWarning — soft-warn banner state machine", () => {
  it("returns null for non-cut goals", () => {
    expect(
      paceWarning(
        { goal: "maintain", paceKgPerWeek: 0, sex: "female", weightKg: 60 },
        2000,
      ),
    ).toBeNull();
    expect(
      paceWarning(
        { goal: "gain", paceKgPerWeek: 0.25, sex: "male", weightKg: 75 },
        2700,
      ),
    ).toBeNull();
  });

  it("returns null when projectedTarget is null (pre-body-stats)", () => {
    expect(
      paceWarning(
        { goal: "lose", paceKgPerWeek: 0.4, sex: "female", weightKg: 60 },
        null,
      ),
    ).toBeNull();
  });

  it("returns danger when projected target is below the safety floor", () => {
    const w = paceWarning(
      { goal: "lose", paceKgPerWeek: 0.9, sex: "female", weightKg: 50 },
      900, // < 1200
    );
    expect(w?.level).toBe("danger");
    expect(w?.reason).toBe("below_floor");
    expect(w?.title).toContain("Below the 1,200 kcal safety floor");
    expect(w?.body).toContain("900");
  });

  it("returns warn when weekly loss exceeds 1% of bodyweight", () => {
    const w = paceWarning(
      { goal: "lose", paceKgPerWeek: 0.9, sex: "male", weightKg: 75 },
      1700, // safely above 1500 floor, but 0.9 / 75 = 1.2% > 1%
    );
    expect(w?.level).toBe("warn");
    expect(w?.reason).toBe("fast_loss");
    expect(w?.title).toContain("1%");
  });

  it("returns info when target is within 200 kcal of the floor but not below", () => {
    const w = paceWarning(
      { goal: "lose", paceKgPerWeek: 0.5, sex: "male", weightKg: 80 },
      1600, // 1500 floor + 100 → within 200
    );
    expect(w?.level).toBe("info");
    expect(w?.reason).toBe("near_floor");
  });

  it("returns null when comfortably safe", () => {
    expect(
      paceWarning(
        { goal: "lose", paceKgPerWeek: 0.4, sex: "male", weightKg: 80 },
        2000,
      ),
    ).toBeNull();
  });
});
