import type { PlanImportCompiledSlot, PlanImportNutritionMode } from "./types.ts";
import { refitDayMealsToTargets, type PlannerTargets } from "../../nutrition/mealPlanAlgo";

/**
 * Scale linked slot portion multipliers per day to hit planner targets.
 * Only applies in match mode when user opts in. Never scales vegetable-only rows
 * (slots with zero protein get skipped by the joint fitter's recipe macros).
 */
export function rebalanceImportedPlanDays(input: {
  slots: PlanImportCompiledSlot[];
  targets: PlannerTargets;
  mode: PlanImportNutritionMode;
}): PlanImportCompiledSlot[] {
  if (input.mode !== "match") return input.slots;

  const byDay = new Map<number, PlanImportCompiledSlot[]>();
  for (const s of input.slots) {
    if (s.linkStatus !== "linked") {
      const arr = byDay.get(s.dayIndex) ?? [];
      arr.push(s);
      byDay.set(s.dayIndex, arr);
      continue;
    }
    const arr = byDay.get(s.dayIndex) ?? [];
    arr.push({ ...s });
    byDay.set(s.dayIndex, arr);
  }

  const out: PlanImportCompiledSlot[] = [];
  for (const [, daySlots] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const linked = daySlots.filter((s) => s.linkStatus === "linked");
    const other = daySlots.filter((s) => s.linkStatus !== "linked");
    if (linked.length === 0) {
      out.push(...daySlots);
      continue;
    }
    const baseMacros = linked.map((s) => ({
      calories: (s.supprNutrition.calories ?? 0) / (s.portionMultiplier || 1),
      protein: (s.supprNutrition.protein ?? 0) / (s.portionMultiplier || 1),
      carbs: (s.supprNutrition.carbs ?? 0) / (s.portionMultiplier || 1),
      fat: (s.supprNutrition.fat ?? 0) / (s.portionMultiplier || 1),
    }));
    const fit = refitDayMealsToTargets({ recipes: baseMacros, targets: input.targets });
    const adjusted = linked.map((s, i) => {
      const mult = fit.multipliers[i] ?? s.portionMultiplier;
      const base = baseMacros[i]!;
      return {
        ...s,
        portionMultiplier: mult,
        supprNutrition: {
          calories: Math.round(base.calories * mult),
          protein: Math.round(base.protein * mult * 10) / 10,
          carbs: Math.round(base.carbs * mult * 10) / 10,
          fat: Math.round(base.fat * mult * 10) / 10,
          fiberG: s.supprNutrition.fiberG,
        },
      };
    });
    out.push(...adjusted, ...other);
  }
  return out.sort((a, b) => a.dayIndex - b.dayIndex || a.slot.localeCompare(b.slot));
}
