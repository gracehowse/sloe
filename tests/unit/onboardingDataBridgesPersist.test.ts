/**
 * Build-40 (2026-05-01) — `effectiveTargetsForPersist` precedence rule.
 *
 * The data-bridges step lets the user paste in their own kcal / P / C /
 * F (the MFP / MacroFactor refugee path). When all four fields are set
 * to finite positive values, the manual override REPLACES the
 * BMR-computed targets. Partial overrides (1-3 fields) intentionally
 * fall through to computed — half a target is worse than none for
 * downstream macro tracking.
 *
 * `buildProfileUpsertRow` now consults `effectiveTargetsForPersist`
 * before nulling targets on the `weightSkipped` path: a user who
 * skipped weight AND set manual targets gets concrete targets written
 * (the manual override implies they know their numbers regardless of
 * scale interaction).
 */
import { describe, expect, it } from "vitest";
import {
  buildProfileUpsertRow,
  effectiveTargetsForPersist,
} from "../../src/lib/onboarding/persist";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/state";
import { computeV2Targets } from "../../src/lib/onboarding/targets";

const baseState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

const COMPLETE_PROFILE: Partial<OnboardingState> = {
  name: "Grace",
  goal: "lose",
  paceKgPerWeek: 0.4,
  sex: "female",
  age: 28,
  heightCm: 168,
  weightKg: 62,
  activity: "moderate",
  unitSystem: "metric",
  diet: ["vegetarian"],
};

describe("effectiveTargetsForPersist — manual override precedence", () => {
  it("returns the computed targets unchanged when no manual override is set", () => {
    const state = baseState(COMPLETE_PROFILE);
    const computed = computeV2Targets(state)!;
    const effective = effectiveTargetsForPersist(state, computed);
    expect(effective).toEqual(computed);
  });

  it("returns null when neither manual override NOR computed are set", () => {
    const state = baseState({ ...COMPLETE_PROFILE, weightSkipped: true });
    const effective = effectiveTargetsForPersist(state, null);
    expect(effective).toBeNull();
  });

  it("synthesises a V2Targets when ALL four manual fields are set + finite + positive", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      manualTargetsKcal: 1850,
      manualTargetsProteinG: 145,
      manualTargetsCarbsG: 175,
      manualTargetsFatG: 60,
    });
    const computed = computeV2Targets(state)!;
    const effective = effectiveTargetsForPersist(state, computed)!;
    expect(effective.target).toBe(1850);
    expect(effective.proteinG).toBe(145);
    expect(effective.carbsG).toBe(175);
    expect(effective.fatG).toBe(60);
    // 14g/1000kcal heuristic → 26g for 1850 kcal.
    expect(effective.fiberG).toBe(26);
  });

  it("partial overrides (1-3 fields) fall through to computed", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      manualTargetsKcal: 1800,
      manualTargetsProteinG: 140,
      // carbs + fat NOT set
    });
    const computed = computeV2Targets(state)!;
    const effective = effectiveTargetsForPersist(state, computed)!;
    // Computed targets win — manual partials are ignored.
    expect(effective.target).toBe(computed.target);
    expect(effective.proteinG).toBe(computed.proteinG);
  });

  it("rejects zero / negative manual values (treated as not-set)", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      manualTargetsKcal: 0,
      manualTargetsProteinG: 100,
      manualTargetsCarbsG: 100,
      manualTargetsFatG: 50,
    });
    const computed = computeV2Targets(state)!;
    const effective = effectiveTargetsForPersist(state, computed)!;
    expect(effective.target).toBe(computed.target);
  });

  it("works on the weightSkipped path — manual override means user knows their numbers", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      weightSkipped: true,
      manualTargetsKcal: 2000,
      manualTargetsProteinG: 150,
      manualTargetsCarbsG: 200,
      manualTargetsFatG: 65,
    });
    // Computed is null on weightSkipped — but manual override fills in.
    const effective = effectiveTargetsForPersist(state, null)!;
    expect(effective).not.toBeNull();
    expect(effective.target).toBe(2000);
    expect(effective.fiberG).toBe(28);
  });

  it("default strategy is 'balanced' when computed wasn't reached", () => {
    const state = baseState({
      weightSkipped: true,
      manualTargetsKcal: 1800,
      manualTargetsProteinG: 140,
      manualTargetsCarbsG: 170,
      manualTargetsFatG: 55,
    });
    const effective = effectiveTargetsForPersist(state, null)!;
    expect(effective.strategy).toBe("balanced");
  });
});

describe("buildProfileUpsertRow — Build-40 manual-override branches", () => {
  it("writes manual targets to profiles when all four are set", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      manualTargetsKcal: 1900,
      manualTargetsProteinG: 150,
      manualTargetsCarbsG: 180,
      manualTargetsFatG: 60,
      dataBridgeChosen: "manual",
    });
    const computed = computeV2Targets(state)!;
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets: computed,
      now: new Date("2026-05-01T10:00:00Z"),
    });
    // Manual override wins over computed.
    expect(row.target_calories).toBe(1900);
    expect(row.target_protein).toBe(150);
    expect(row.target_carbs).toBe(180);
    expect(row.target_fat).toBe(60);
    expect(row.target_fiber_g).toBe(27); // 14g/1000kcal × 1900 = 26.6 → 27
    expect(row.target_calories_source).toBe("onboarding");
  });

  it("writes manual targets even on the weightSkipped path (override implies user knows their numbers)", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      weightSkipped: true,
      manualTargetsKcal: 1700,
      manualTargetsProteinG: 130,
      manualTargetsCarbsG: 160,
      manualTargetsFatG: 55,
    });
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets: null,
    });
    // Even though weightSkipped is true, the manual override carries
    // through. weight_kg still null (the partial-profile honesty
    // applies to body data, not targets).
    expect(row.weight_kg).toBeNull();
    expect(row.target_calories).toBe(1700);
    expect(row.target_protein).toBe(130);
    expect(row.target_carbs).toBe(160);
    expect(row.target_fat).toBe(55);
  });

  it("partial manual + weightSkipped — falls through to null targets (existing behaviour preserved)", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      weightSkipped: true,
      manualTargetsKcal: 1700,
      manualTargetsProteinG: 130,
      // carbs + fat not set → not a valid override
    });
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets: null,
    });
    // No valid manual override + computed targets are null → still null.
    expect(row.target_calories).toBeNull();
    expect(row.target_protein).toBeNull();
  });

  it("normal flow without any manual override is unchanged (regression guard)", () => {
    const state = baseState(COMPLETE_PROFILE);
    const computed = computeV2Targets(state)!;
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets: computed,
    });
    expect(row.target_calories).toBe(computed.target);
    expect(row.target_protein).toBe(computed.proteinG);
    // dataBridgeChosen is null (the user never reached the step) —
    // no impact on persistence.
    expect(state.dataBridgeChosen).toBeNull();
  });
});

describe("DEFAULT_ONBOARDING_STATE — Build-40 fields", () => {
  it("manual target fields default to null (unset)", () => {
    expect(DEFAULT_ONBOARDING_STATE.manualTargetsKcal).toBeNull();
    expect(DEFAULT_ONBOARDING_STATE.manualTargetsProteinG).toBeNull();
    expect(DEFAULT_ONBOARDING_STATE.manualTargetsCarbsG).toBeNull();
    expect(DEFAULT_ONBOARDING_STATE.manualTargetsFatG).toBeNull();
  });

  it("dataBridgeChosen defaults to null (never-touched)", () => {
    expect(DEFAULT_ONBOARDING_STATE.dataBridgeChosen).toBeNull();
  });
});
