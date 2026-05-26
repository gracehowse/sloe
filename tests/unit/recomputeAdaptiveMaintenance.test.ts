/**
 * recomputeTargetsFromProfile — adaptive-maintenance + continuous-pace
 * contract (target-recompute unification, 2026-05-26).
 *
 * The post-onboarding editor + Settings activity-edit path now route
 * through `resolveMaintenance` (adaptive when confidence is medium/high
 * AND the value is fresh, else static Mifflin) and the canonical
 * `deriveTargets` core (continuous pace, goal-mapped strategy default).
 *
 * These tests pin the BEHAVIOUR CHANGE the unification delivers:
 *   - a confident + fresh adaptive value becomes the deficit baseline
 *     (it used to be ignored — static TDEE only).
 *   - a stale or low-confidence adaptive value falls back to static.
 *   - strategy defaults to mapGoalToStrategy(goal), NOT "balanced".
 *   - continuous pace from the plan_pace preset (no PACE_DAILY_DEFICIT).
 */

import { describe, expect, it } from "vitest";
import { recomputeTargetsFromProfile } from "../../src/lib/nutrition/recomputeTargetsForActivity";
import { calculateTDEE, calculateMacros } from "../../src/lib/nutrition/tdee";
import { mapGoalToStrategy } from "../../src/lib/onboarding/targets";

const PROFILE = {
  sex: "female" as const,
  weightKg: 60,
  heightCm: 165,
  age: 30,
  activityLevel: "moderate" as const,
  planPace: "steady" as const, // 0.5 kg/week → 550 deficit
};

const NOW = new Date("2026-05-26T12:00:00.000Z");
const FRESH = "2026-05-25T12:00:00.000Z"; // 1 day old
const STALE = "2026-05-01T12:00:00.000Z"; // 25 days old (> 14d)

describe("recomputeTargetsFromProfile — adaptive maintenance baseline", () => {
  it("uses a confident + fresh adaptive value as the deficit baseline (NOT static)", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate"); // 2046
    const adaptive = 2200; // deliberately ≠ static

    const out = recomputeTargetsFromProfile({
      ...PROFILE,
      goal: "cut",
      adaptiveTdee: adaptive,
      adaptiveTdeeConfidence: "high",
      adaptiveTdeeUpdatedAt: FRESH,
      now: NOW,
    })!;

    // Maintenance = adaptive (2200), NOT static (2046).
    expect(out.maintenanceTdee).toBe(adaptive);
    expect(out.maintenanceTdee).not.toBe(staticTdee);
    // Deficit applied to the ADAPTIVE baseline: 2200 − 550 = 1650.
    expect(out.target_calories).toBe(1650);
  });

  it("falls back to static Mifflin when the adaptive value is STALE", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate"); // 2046
    const out = recomputeTargetsFromProfile({
      ...PROFILE,
      goal: "cut",
      adaptiveTdee: 2200,
      adaptiveTdeeConfidence: "high",
      adaptiveTdeeUpdatedAt: STALE,
      now: NOW,
    })!;
    expect(out.maintenanceTdee).toBe(staticTdee); // 2046
    expect(out.target_calories).toBe(staticTdee - 550); // 1496
  });

  it("falls back to static when confidence is low", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate");
    const out = recomputeTargetsFromProfile({
      ...PROFILE,
      goal: "cut",
      adaptiveTdee: 2200,
      adaptiveTdeeConfidence: "low",
      adaptiveTdeeUpdatedAt: FRESH,
      now: NOW,
    })!;
    expect(out.maintenanceTdee).toBe(staticTdee);
  });

  it("falls back to static when NO adaptive fields are passed (editor UIs today)", () => {
    // This is the behaviour-preserving path: the editor UIs don't pass
    // adaptive columns yet, so the maintenance number is the static
    // formula — same shape as before the unification.
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate");
    const out = recomputeTargetsFromProfile({ ...PROFILE, goal: "cut" })!;
    expect(out.maintenanceTdee).toBe(staticTdee);
    expect(out.target_calories).toBe(staticTdee - 550);
  });
});

describe("recomputeTargetsFromProfile — strategy default (NOT balanced)", () => {
  it("defaults a cut to high_satisfaction (mapGoalToStrategy), not balanced", () => {
    const out = recomputeTargetsFromProfile({ ...PROFILE, goal: "cut" })!;
    // mapGoalToStrategy("lose") = high_satisfaction. Macros must match
    // that strategy, not the old hardcoded balanced default.
    const expected = calculateMacros(
      out.target_calories,
      mapGoalToStrategy("lose"),
      60,
    );
    expect(out.target_protein).toBe(expected.protein);
    expect(out.target_carbs).toBe(expected.carbs);
    expect(out.target_fat).toBe(expected.fat);
    expect(out.target_fiber_g).toBe(expected.fiber);

    // And it must DIFFER from the old balanced default (proves the fix).
    const balanced = calculateMacros(out.target_calories, "balanced", 60);
    expect(out.target_protein).not.toBe(balanced.protein);
  });

  it("honours an explicit nutritionStrategy override", () => {
    const out = recomputeTargetsFromProfile({
      ...PROFILE,
      goal: "cut",
      nutritionStrategy: "low_carb",
    })!;
    const expected = calculateMacros(out.target_calories, "low_carb", 60);
    expect(out.target_fat).toBe(expected.fat);
  });
});

describe("recomputeTargetsFromProfile — continuous pace per preset", () => {
  it("maps each plan_pace preset to its continuous kg/week deficit", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate"); // 2046
    const cases: Array<[typeof PROFILE.planPace, number]> = [
      ["relaxed", 275], // 0.25 kg/week
      ["steady", 550], // 0.5
      ["accelerated", 825], // 0.75
      ["vigorous", 1100], // 1.0
    ];
    for (const [planPace, deficit] of cases) {
      const out = recomputeTargetsFromProfile({ ...PROFILE, planPace, goal: "cut" })!;
      expect(out.target_calories).toBe(staticTdee - deficit);
    }
  });

  it("applies the FULL surplus magnitude for gain (no half-magnitude bug)", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate");
    const out = recomputeTargetsFromProfile({ ...PROFILE, goal: "bulk" })!;
    // Full +550 (the old calculateBudget path applied +275).
    expect(out.target_calories).toBe(staticTdee + 550);
  });

  it("lands exactly on maintenance for a maintain goal", () => {
    const staticTdee = calculateTDEE("female", 60, 165, 30, "moderate");
    const out = recomputeTargetsFromProfile({ ...PROFILE, goal: "maintain" })!;
    expect(out.target_calories).toBe(staticTdee);
  });

  it("returns null when body basics are invalid (no fabricated targets)", () => {
    expect(
      recomputeTargetsFromProfile({ ...PROFILE, weightKg: 0, goal: "cut" }),
    ).toBeNull();
    expect(
      recomputeTargetsFromProfile({ ...PROFILE, age: -1, goal: "cut" }),
    ).toBeNull();
  });
});
