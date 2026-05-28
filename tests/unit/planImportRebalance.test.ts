import { describe, expect, it } from "vitest";

import { rebalanceImportedPlanDays } from "@/lib/planning/planImport/rebalanceImportedPlan";
import type { PlanImportCompiledSlot } from "@/lib/planning/planImport/types";

const linkedSlot = (
  overrides: Partial<PlanImportCompiledSlot> = {},
): PlanImportCompiledSlot => ({
  dayIndex: 0,
  dayLabel: "Mon",
  slot: "Lunch",
  title: "Bowl",
  recipeKeys: ["bowl"],
  linkStatus: "linked",
  portionMultiplier: 1,
  supprNutrition: { calories: 400, protein: 30, carbs: 40, fat: 12 },
  authorNutrition: null,
  claimedKcal: 400,
  confidence: "high",
  ...overrides,
});

describe("rebalanceImportedPlanDays", () => {
  it("returns slots unchanged in author mode", () => {
    const slots = [linkedSlot()];
    expect(rebalanceImportedPlanDays({ slots, targets: { calories: 2000, protein: 150, carbs: 200, fat: 65 }, mode: "author" })).toEqual(
      slots,
    );
  });

  it("scales linked slot portions in match mode", () => {
    const slots = [linkedSlot({ supprNutrition: { calories: 200, protein: 10, carbs: 20, fat: 8 } })];
    const out = rebalanceImportedPlanDays({
      slots,
      targets: { calories: 400, protein: 40, carbs: 40, fat: 16 },
      mode: "match",
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.portionMultiplier).toBeGreaterThan(1);
    expect(out[0]!.supprNutrition.calories).toBeGreaterThan(200);
  });

  it("leaves kcal_only and blocked slots unchanged while scaling linked rows", () => {
    const slots = [
      linkedSlot({ dayIndex: 0, supprNutrition: { calories: 200, protein: 10, carbs: 20, fat: 8 } }),
      linkedSlot({
        dayIndex: 0,
        slot: "Snacks",
        title: "Estimate only",
        linkStatus: "kcal_only",
        supprNutrition: { calories: 150, protein: 0, carbs: 10, fat: 5 },
      }),
      linkedSlot({
        dayIndex: 0,
        slot: "Dinner",
        title: "Blocked",
        linkStatus: "blocked",
        supprNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      }),
    ];
    const out = rebalanceImportedPlanDays({
      slots,
      targets: { calories: 400, protein: 40, carbs: 40, fat: 16 },
      mode: "match",
    });
    const kcalOnly = out.find((s) => s.linkStatus === "kcal_only");
    const blocked = out.find((s) => s.linkStatus === "blocked");
    expect(kcalOnly?.portionMultiplier).toBe(1);
    expect(kcalOnly?.supprNutrition.calories).toBe(150);
    expect(blocked?.supprNutrition.calories).toBe(0);
    expect(out.some((s) => s.linkStatus === "linked" && s.portionMultiplier > 1)).toBe(true);
  });

  it("passes through days with no linked slots", () => {
    const slots = [
      linkedSlot({
        dayIndex: 1,
        linkStatus: "kcal_only",
        supprNutrition: { calories: 300, protein: 20, carbs: 25, fat: 10 },
      }),
    ];
    const out = rebalanceImportedPlanDays({
      slots,
      targets: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
      mode: "match",
    });
    expect(out).toEqual(slots);
  });
});
