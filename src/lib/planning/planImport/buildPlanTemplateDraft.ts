import type { PlanTemplateDraft, PlanTemplateSlot } from "../../nutrition/planTemplates";
import type { PlanImportCompiledSlot, PlanImportNutritionMode } from "./types";

function nutritionForSlot(
  slot: PlanImportCompiledSlot,
  mode: PlanImportNutritionMode,
): { calories: number; protein: number; carbs: number; fat: number; fiberG?: number } {
  const useAuthor =
    mode === "author" &&
    slot.authorNutrition?.calories != null &&
    slot.authorNutrition.calories > 0;
  const n = useAuthor ? slot.authorNutrition! : slot.supprNutrition;
  const portion = slot.portionMultiplier > 0 ? slot.portionMultiplier : 1;
  return {
    calories: Math.round((n.calories ?? 0)),
    protein: n.protein ?? 0,
    carbs: n.carbs ?? 0,
    fat: n.fat ?? 0,
    fiberG: n.fiberG ?? undefined,
  };
}

/** Build a plan template draft from compiled import slots (linked + kcal_only). */
export function buildPlanTemplateDraftFromImport(input: {
  planName: string;
  slots: readonly PlanImportCompiledSlot[];
  recipeIdByKey: Readonly<Record<string, string>>;
  mode: PlanImportNutritionMode;
}): PlanTemplateDraft | null {
  const usable = input.slots.filter((s) => s.linkStatus !== "blocked");
  if (usable.length === 0) return null;

  const dayIndices = usable.map((s) => s.dayIndex);
  const dayCount = Math.max(1, Math.min(7, Math.max(...dayIndices) + 1));

  const templateSlots: PlanTemplateSlot[] = [];
  for (const s of usable) {
    const macros = nutritionForSlot(s, input.mode);
    const portion = s.portionMultiplier > 0 ? s.portionMultiplier : 1;
    const primaryKey = s.recipeKeys[0];
    const recipeId = primaryKey ? input.recipeIdByKey[primaryKey] : undefined;
    templateSlots.push({
      dayIndex: s.dayIndex,
      slot: s.slot,
      recipeId,
      recipeTitle: s.title,
      calories: Math.round(macros.calories / portion),
      protein: +(macros.protein / portion).toFixed(2),
      carbs: +(macros.carbs / portion).toFixed(2),
      fat: +(macros.fat / portion).toFixed(2),
      fiberG: macros.fiberG != null ? +(macros.fiberG / portion).toFixed(2) : undefined,
      servings: 1,
      portionMultiplier: portion,
    });
  }

  return {
    name: input.planName.trim(),
    dayCount,
    slots: templateSlots,
  };
}
