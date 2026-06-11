import { describe, expect, it } from "vitest";
import {
  buildMaintenanceChain,
  KCAL_PER_KG_FAT,
} from "@/lib/nutrition/maintenanceChain";
import { resolveMaintenance } from "@/lib/nutrition/resolveMaintenance";
import { calculateBMR, ACTIVITY_MULTIPLIERS } from "@/lib/nutrition/tdee";

/**
 * G-4 (TestFlight `ALcwMFPjfmJvyBLjs4CRt1k`, 2026-04-19) — pinning
 * the chain of rows rendered beneath the Progress Maintenance card's
 * "How this works" expandable. Chain content is sensitive to the
 * adaptive branch, plan pace, and goal type — all three are exercised
 * here so either platform regressing would fail a test.
 */
describe("buildMaintenanceChain", () => {
  const baseProfile = {
    sex: "female" as const,
    weight_kg: 62,
    height_cm: 165,
    age: 34,
    activity_level: "sedentary" as const,
  };

  const adaptiveResolved = resolveMaintenance(
    {
      ...baseProfile,
      adaptive_tdee: 1777,
      adaptive_tdee_confidence: "medium",
      adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
    },
    { now: new Date("2026-04-19T12:00:00Z") },
  );

  it("builds the full adaptive chain with deficit + weekly loss", () => {
    expect(adaptiveResolved).not.toBeNull();
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    expect(chain).not.toBeNull();
    const kinds = chain!.steps.map((s) => s.kind);
    expect(kinds).toEqual([
      "bmr",
      "activity",
      "adaptive",
      "maintenance",
      "deficit",
      "goal",
      "summary",
      "weeklyLoss",
    ]);
  });

  it("pulls BMR from calculateBMR (no placeholder)", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    const bmr = Math.round(
      calculateBMR(baseProfile.sex, baseProfile.weight_kg, baseProfile.height_cm, baseProfile.age),
    );
    const bmrStep = chain!.steps.find((s) => s.kind === "bmr")!;
    expect(bmrStep.value).toBe(`${bmr.toLocaleString()} kcal`);
  });

  it("shows the activity multiplier with the current level's value", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    const step = chain!.steps.find((s) => s.kind === "activity")!;
    // sedentary × 1.2 from tdee.ts
    expect(step.label).toContain(String(ACTIVITY_MULTIPLIERS.sedentary));
    expect(step.label).toContain("Sedentary");
  });

  it("pins the activity row to SEDENTARY even for a non-sedentary profile (TDEE gating 2026-06-10)", () => {
    // The explainer's BMR × activity row must reconcile to `= Maintenance`.
    // Since the bonus-coexisting maintenance seed is pinned to SEDENTARY (the
    // add-back / activity-bonus architecture — survey §4 + decision
    // `docs/decisions/2026-06-10-adaptive-tdee-gating.md`), the formula row
    // shows the sedentary multiplier whatever the profile's activity_level is —
    // otherwise the row's product would disagree with the maintenance total
    // below it. Use a LIGHT profile and assert the row stays sedentary.
    const lightProfile = { ...baseProfile, activity_level: "light" as const };
    const formulaResolved = resolveMaintenance(lightProfile);
    expect(formulaResolved).not.toBeNull();
    const chain = buildMaintenanceChain(
      lightProfile,
      formulaResolved!,
      "relaxed",
      "cut",
    );
    const activityStep = chain!.steps.find((s) => s.kind === "activity")!;
    // Row renders the SEDENTARY multiplier + label, NOT light (1.375).
    expect(activityStep.label).toContain(String(ACTIVITY_MULTIPLIERS.sedentary));
    expect(activityStep.label).toContain("Sedentary");
    expect(activityStep.label).not.toContain(String(ACTIVITY_MULTIPLIERS.light));

    // And the row's product reconciles to the maintenance total (BMR × 1.2).
    const expectedMaintenance = Math.round(
      calculateBMR(
        lightProfile.sex,
        lightProfile.weight_kg,
        lightProfile.height_cm,
        lightProfile.age,
      ) * ACTIVITY_MULTIPLIERS.sedentary,
    );
    expect(formulaResolved!.kcal).toBe(expectedMaintenance);
    const maintenanceStep = chain!.steps.find((s) => s.kind === "maintenance")!;
    expect(maintenanceStep.value).toBe(
      `${expectedMaintenance.toLocaleString()} kcal`,
    );
  });

  it("includes the adaptive adjustment when adaptive beats formula", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    const step = chain!.steps.find((s) => s.kind === "adaptive");
    expect(step).toBeDefined();
    // Adaptive 1777 vs formula ~1626 (female 62/165/34 × 1.2), diff ≈ +150
    expect(step!.label).toMatch(/\+ adaptive adjustment \(\+\d+ kcal\)/);
  });

  it("skips the adaptive step on low confidence (falls back to formula)", () => {
    const lowResolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 1777,
        adaptive_tdee_confidence: "low",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(lowResolved).not.toBeNull();
    expect(lowResolved!.source).toBe("formula");
    const chain = buildMaintenanceChain(
      baseProfile,
      lowResolved!,
      "relaxed",
      "cut",
    );
    const kinds = chain!.steps.map((s) => s.kind);
    expect(kinds).not.toContain("adaptive");
    expect(kinds[0]).toBe("bmr");
    expect(kinds).toContain("maintenance");
  });

  it("weekly loss matches 7 × deficit / 7700 helper", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    expect(chain!.dailyDeficitKcal).not.toBeNull();
    const expected = Number(
      ((chain!.dailyDeficitKcal as number) * 7 / KCAL_PER_KG_FAT).toFixed(2),
    );
    expect(chain!.weeklyLossKg).toBeCloseTo(expected, 2);
  });

  it("omits deficit/goal/weekly-loss rows when profile inputs are missing", () => {
    const result = buildMaintenanceChain(
      { sex: "female", weight_kg: null, height_cm: 165, age: 34, activity_level: "sedentary" },
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    expect(result).toBeNull();
  });

  it("renders a surplus (not deficit) line when goalType is bulk", () => {
    const formulaResolved = resolveMaintenance({ ...baseProfile }, {
      now: new Date("2026-04-19T12:00:00Z"),
    });
    const chain = buildMaintenanceChain(
      baseProfile,
      formulaResolved!,
      "relaxed",
      "bulk",
    );
    const step = chain!.steps.find((s) => s.kind === "deficit")!;
    expect(step.label).toContain("surplus");
  });

  it("keeps Maintenance step value identical to resolved.kcal", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    const m = chain!.steps.find((s) => s.kind === "maintenance")!;
    expect(m.value).toBe(`${adaptiveResolved!.kcal.toLocaleString()} kcal`);
  });

  /**
   * Action 13 Item #12 (2026-04-19) — the projected weekly loss / gain
   * line carries a caveat suffix because 7700 kcal/kg is correct for
   * **fat mass**, not week-to-week scale weight (water + glycogen
   * dominate the first week of any cut/bulk). Without the caveat the
   * projection reads as a guarantee.
   */
  it("attaches the long-term-fat caveat to the weekly-loss row (cut)", () => {
    const chain = buildMaintenanceChain(
      baseProfile,
      adaptiveResolved!,
      "relaxed",
      "cut",
    );
    const wl = chain!.steps.find((s) => s.kind === "weeklyLoss")!;
    expect(wl.label).toContain("Projected weekly loss");
    expect(wl.label).toMatch(/\*long-term fat loss; week-to-week varies with water\/glycogen/);
  });

  it("uses the live calorie target instead of re-deriving from collapsed maintenance (ENG-1057)", () => {
    const collapsedAdaptive = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 1270,
        adaptive_tdee_confidence: "medium",
        adaptive_tdee_updated_at: "2026-06-10T12:00:00Z",
      },
      { now: new Date("2026-06-11T12:00:00Z") },
    );
    expect(collapsedAdaptive).not.toBeNull();
    expect(collapsedAdaptive!.source).toBe("formula");

    const chain = buildMaintenanceChain(
      baseProfile,
      collapsedAdaptive!,
      "steady",
      "cut",
      1450,
    );
    expect(chain).not.toBeNull();
    const goalStep = chain!.steps.find((s) => s.kind === "goal")!;
    expect(goalStep.value).toBe("1,450 kcal");
    expect(chain!.budgetKcal).toBe(1450);
    expect(chain!.budgetKcal).not.toBe(720);
  });

  it("attaches the long-term-fat caveat to the weekly-gain row (bulk)", () => {
    const formulaResolved = (
      adaptiveResolved as unknown as { source: "adaptive" | "formula" }
    ); // re-use the resolved value; bulk swaps the deficit sign.
    const chain = buildMaintenanceChain(
      baseProfile,
      formulaResolved as never,
      "relaxed",
      "bulk",
    );
    const wl = chain!.steps.find((s) => s.kind === "weeklyLoss")!;
    expect(wl.label).toContain("Projected weekly gain");
    expect(wl.label).toMatch(/\*long-term fat gain; week-to-week varies with water\/glycogen/);
  });
});
