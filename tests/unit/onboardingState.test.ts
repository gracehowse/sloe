import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance,
  resolveNextStep,
  type OnboardingState,
  type StepId,
} from "../../src/lib/onboarding/state";

/**
 * Onboarding v2 — state shape, step ordering, and `canAdvance`
 * validation rules. Locks in the decision-doc invariants:
 *
 *  - 13 steps in fixed order; `pace` auto-skips when goal = maintain.
 *  - Pace safety floor is SOFT-WARN — `canAdvance("pace", …)` returns
 *    true even when projected target falls below 1,200/1,500 kcal.
 *    Only the *banner* policy lives in `targets.ts`.
 *  - Sex `"unspecified"` is valid; the BMR equation uses the male/
 *    female midpoint (covered by `onboardingV2Targets.test.ts`).
 *
 * If any of these fail, that's a regression vs.
 * `docs/decisions/2026-04-19-onboarding-redesign-scope.md`.
 */

const baseState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

describe("onboarding v2 — step ordering", () => {
  it("ships exactly 15 steps in the documented order (Phase 5: + recipes)", () => {
    expect(TOTAL_STEPS).toBe(15);
    expect(STEP_IDS).toEqual([
      "welcome",
      "signup",
      "goal",
      "sex",
      "age",
      "height",
      "weight",
      "activity",
      "pace",
      "diet",
      "strategy",
      "reveal",
      "permissions",
      "import",
      "recipes",
    ]);
  });

  it("has a label for every step id", () => {
    for (const id of STEP_IDS) {
      expect(STEP_LABELS[id]).toBeTruthy();
    }
  });
});

describe("onboarding v2 — resolveNextStep auto-skip", () => {
  it("skips the pace step when goal = maintain (forward navigation)", () => {
    // We're on `activity` (index 7); the next non-skipped step is
    // `diet` (index 9), not `pace` (index 8).
    const next = resolveNextStep(7, +1, baseState({ goal: "maintain" }));
    expect(STEP_IDS[next]).toBe("diet");
  });

  it("skips the pace step when goal = maintain (backward navigation)", () => {
    // We're on `diet` (index 9); going back should land on `activity`
    // (index 7), not `pace` (index 8).
    const prev = resolveNextStep(9, -1, baseState({ goal: "maintain" }));
    expect(STEP_IDS[prev]).toBe("activity");
  });

  it("does not skip the pace step for cut/recomp/gain goals", () => {
    for (const goal of ["lose", "recomp", "gain"] as const) {
      const next = resolveNextStep(7, +1, baseState({ goal }));
      expect(STEP_IDS[next]).toBe("pace");
    }
  });

  it("also auto-skips the pace step when weightSkipped is true (Stage F diversity-inclusion)", () => {
    const next = resolveNextStep(
      7,
      +1,
      baseState({ goal: "lose", weightSkipped: true }),
    );
    expect(STEP_IDS[next]).toBe("diet");
  });

  it("clamps to [0, TOTAL_STEPS - 1]", () => {
    expect(resolveNextStep(0, -1, baseState())).toBe(0);
    expect(resolveNextStep(TOTAL_STEPS - 1, +1, baseState())).toBe(TOTAL_STEPS - 1);
  });
});

describe("onboarding v2 — canAdvance per step", () => {
  const cases: Array<[StepId, OnboardingState, boolean, string]> = [
    // welcome — no inputs required
    ["welcome", baseState(), true, "always advances"],
    // signup — always advanceable from the shared canAdvance contract.
    // The Signup step owns its own "Create account" CTA which fires
    // the real Supabase signUp and advances the flow itself; the
    // global footer Continue is suppressed on this step in the shell.
    // canAdvance returns true defensively so any code path that
    // doesn't honour the suppression (keyboard shortcut, deep-link)
    // still permits forward motion rather than soft-locking the flow.
    ["signup", baseState(), true, "always advances (step owns its own auth gate)"],
    ["signup", baseState({ authMethod: "email" }), true, "email auth method"],
    [
      "signup",
      baseState({ name: "Grace", email: "grace@example.com" }),
      true,
      "name + valid email",
    ],
    // strategy — informational (default = goal-derived)
    ["strategy", baseState(), true, "always advances (default = goal-derived)"],
    // goal — must be picked
    ["goal", baseState(), false, "no goal"],
    ["goal", baseState({ goal: "lose" }), true, "lose goal"],
    // sex — required
    ["sex", baseState(), false, "no sex"],
    ["sex", baseState({ sex: "female" }), true, "female"],
    ["sex", baseState({ sex: "unspecified" }), true, "unspecified is valid"],
    // age — must be in [14, 100]
    ["age", baseState({ age: 13 }), false, "below floor"],
    ["age", baseState({ age: 14 }), true, "at floor"],
    ["age", baseState({ age: 100 }), true, "at ceiling"],
    ["age", baseState({ age: 101 }), false, "above ceiling"],
    // height + weight — positive (or weight skipped per Stage F)
    ["height", baseState({ heightCm: 0 }), false, "zero height"],
    ["height", baseState({ heightCm: 170 }), true, "positive height"],
    ["weight", baseState({ weightKg: 0 }), false, "zero weight"],
    ["weight", baseState({ weightKg: 60 }), true, "positive weight"],
    [
      "weight",
      baseState({ weightKg: 0, weightSkipped: true }),
      true,
      "weight skipped (diversity-inclusion path)",
    ],
    // activity — required
    ["activity", baseState(), false, "no activity"],
    ["activity", baseState({ activity: "moderate" }), true, "moderate"],
    // diet — optional
    ["diet", baseState(), true, "always advances (optional)"],
    // reveal / permissions / import — informational
    ["reveal", baseState(), true, ""],
    ["permissions", baseState(), true, ""],
    ["import", baseState(), true, ""],
  ];

  for (const [step, state, expected, label] of cases) {
    it(`${step}: ${label}`, () => {
      expect(canAdvance(step, state)).toBe(expected);
    });
  }
});

describe("onboarding v2 — pace safety floor is SOFT-WARN", () => {
  /**
   * Reified from decision doc 2026-04-19-onboarding-redesign-scope.md
   * §"Decision 2 — Pace safety floor: soft warn, allow advance".
   *
   * Even when the projected daily target is well below the safety
   * floor (1,200 F / 1,500 M / 1,350 unspecified), `canAdvance` for
   * the pace step must still return true so long as a numeric pace
   * has been chosen. The danger banner shows; analytics fire on
   * advance-despite-banner; the user proceeds if they choose.
   */
  it("returns true with no warning context for an aggressive pace (banner + acknowledgement live in the UI layer)", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
    });
    // No `paceWarning` ctx supplied → soft-warn product decision
    // applies as before (other warning levels never block).
    expect(canAdvance("pace", state)).toBe(true);
  });

  it("returns false when a `danger` warning is active and the user has not acknowledged (Stage F legal)", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
      paceDangerAcknowledged: false,
    });
    expect(
      canAdvance("pace", state, { paceWarning: { level: "danger" } }),
    ).toBe(false);
  });

  it("returns true when a `danger` warning is active AND the user has ticked the acknowledgement", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
      paceDangerAcknowledged: true,
    });
    expect(
      canAdvance("pace", state, { paceWarning: { level: "danger" } }),
    ).toBe(true);
  });

  it("does NOT require acknowledgement for `info` or `warn` levels", () => {
    const state = baseState({
      goal: "lose",
      sex: "male",
      weightKg: 80,
      paceKgPerWeek: 0.4,
      paceDangerAcknowledged: false,
    });
    expect(
      canAdvance("pace", state, { paceWarning: { level: "warn" } }),
    ).toBe(true);
    expect(
      canAdvance("pace", state, { paceWarning: { level: "info" } }),
    ).toBe(true);
  });

  it("returns false only when the user hasn't picked a pace at all", () => {
    const state = baseState({ goal: "lose", paceKgPerWeek: null });
    expect(canAdvance("pace", state)).toBe(false);
  });

  it("auto-passes the pace step when goal is maintain (defence-in-depth)", () => {
    const state = baseState({ goal: "maintain", paceKgPerWeek: null });
    expect(canAdvance("pace", state)).toBe(true);
  });
});

describe("onboarding v2 — pace presets + ranges", () => {
  it("ships 3 presets per non-maintain goal", () => {
    expect(PACE_PRESETS.lose).toHaveLength(3);
    expect(PACE_PRESETS.gain).toHaveLength(3);
    expect(PACE_PRESETS.recomp).toHaveLength(3);
  });

  it("preset values fall within their goal's range", () => {
    for (const goal of ["lose", "gain", "recomp"] as const) {
      const range = PACE_RANGES[goal];
      for (const preset of PACE_PRESETS[goal]) {
        expect(preset.value).toBeGreaterThanOrEqual(range.min);
        expect(preset.value).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it("default pace per goal falls within range", () => {
    for (const goal of ["lose", "gain", "recomp"] as const) {
      const range = PACE_RANGES[goal];
      const def = GOAL_DEFAULT_PACE[goal];
      expect(def).toBeGreaterThanOrEqual(range.min);
      expect(def).toBeLessThanOrEqual(range.max);
    }
    expect(GOAL_DEFAULT_PACE.maintain).toBe(0);
  });
});
