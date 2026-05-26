/**
 * Onboarding targets — behaviour-preserving parity guard for the
 * target-recompute unification (2026-05-26).
 *
 * `computeV2Targets` was refactored to route through the canonical
 * `deriveTargets` core instead of its own inline pipeline. The refactor
 * MUST be byte-identical: a new user's onboarding numbers cannot move.
 *
 * This test re-implements the OLD inline pipeline locally (the exact math
 * that lived in computeV2Targets before the refactor) and asserts the
 * refactored function still returns identical numbers across a matrix of
 * profiles + goals + paces. If the refactor ever drifts, this fails.
 */

import { describe, expect, it } from "vitest";
import {
  computeV2Targets,
  mapGoalToStrategy,
  paceToKcalAdjustment,
  safetyFloorFor,
} from "../../src/lib/onboarding/targets";
import {
  ACTIVITY_MULTIPLIERS,
  budgetSafety,
  calculateBMR,
  calculateMacros,
  type ActivityLevel,
} from "../../src/lib/nutrition/tdee";
import {
  DEFAULT_ONBOARDING_STATE,
  GOAL_DEFAULT_PACE,
  type Goal,
  type OnboardingState,
} from "../../src/lib/onboarding/state";

const baseState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

/** The EXACT inline pipeline computeV2Targets used BEFORE the refactor.
 *  Kept here as the baseline oracle — do not "simplify" it to call
 *  deriveTargets, that would defeat the parity check. */
function legacyComputeV2Targets(state: OnboardingState) {
  const { sex, age, heightCm, weightKg, activity, goal, paceKgPerWeek, weightSkipped } = state;
  if (weightSkipped) return null;
  if (
    sex === null ||
    !Number.isFinite(age) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    activity === null ||
    goal === null
  ) {
    return null;
  }
  const bmr = calculateBMR(sex, weightKg, heightCm, age);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activity as ActivityLevel]);
  const pace = paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];
  const kcalAdj = paceToKcalAdjustment(goal, pace);
  const target = Math.round(tdee + kcalAdj);
  const strategy = state.nutritionStrategy ?? mapGoalToStrategy(goal);
  const macros = calculateMacros(target, strategy, weightKg);
  const floor = safetyFloorFor(sex);
  return {
    bmr: Math.round(bmr),
    tdee,
    target,
    proteinG: macros.protein,
    carbsG: macros.carbs,
    fatG: macros.fat,
    fiberG: macros.fiber,
    pace,
    kcalAdj,
    strategy,
    belowSafetyFloor: (goal === "lose" || goal === "recomp") && target < floor,
    safety: budgetSafety(target, sex),
  };
}

const SEXES = ["male", "female", "unspecified"] as const;
const ACTIVITIES: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const GOALS: Goal[] = ["lose", "recomp", "maintain", "gain"];
const PACES = [null, 0.15, 0.25, 0.4, 0.5, 0.75, 0.9, 1.0] as const;

describe("computeV2Targets — byte-identical after deriveTargets refactor", () => {
  it("matches the legacy inline pipeline across a full profile matrix", () => {
    let cases = 0;
    for (const sex of SEXES) {
      for (const activity of ACTIVITIES) {
        for (const goal of GOALS) {
          for (const pace of PACES) {
            for (const [age, heightCm, weightKg] of [
              [25, 155, 50],
              [28, 168, 62],
              [35, 175, 75],
              [42, 182, 95],
            ] as const) {
              const state = baseState({
                sex,
                age,
                heightCm,
                weightKg,
                activity,
                goal,
                paceKgPerWeek: pace,
              });
              const got = computeV2Targets(state);
              const want = legacyComputeV2Targets(state);
              expect(got).toEqual(want);
              cases += 1;
            }
          }
        }
      }
    }
    // Sanity: the matrix actually ran (3×5×4×8×4 = 1920).
    expect(cases).toBe(1920);
  });

  it("preserves the documented textbook female profile numbers exactly", () => {
    // The same fixture pinned by onboardingTargets.test.ts — re-asserted
    // here so a parity regression surfaces against the canonical numbers.
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
    )!;
    expect(t.bmr).toBe(1369);
    expect(t.tdee).toBe(2122);
    expect(t.kcalAdj).toBe(-440);
    expect(t.target).toBe(1682);
    expect(t.strategy).toBe("high_satisfaction");
  });

  it("preserves null for incomplete + weight-skipped states", () => {
    expect(computeV2Targets(baseState())).toBeNull();
    expect(
      computeV2Targets(
        baseState({
          weightSkipped: true,
          sex: "female",
          age: 28,
          heightCm: 168,
          weightKg: 62,
          activity: "moderate",
          goal: "lose",
        }),
      ),
    ).toBeNull();
  });
});
