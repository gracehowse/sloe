import { useMemo } from "react";
import { cookScaleCaption } from "@suppr/nutrition-core/recipeScale";
import type { CookIngredientChecklistItem } from "@/components/cook/CookIngredientChecklist";

export type UseCookIngredientPanelInput = {
  checklistEnabled: boolean;
  checklistItems: CookIngredientChecklistItem[];
  cookPhase: "mise" | "steps";
  isDone: boolean;
  scale: number;
  baseServings: number | null;
};

/** ENG-942 — gate + scale caption for the in-step ingredient peek sheet. */
export function useCookIngredientPanelGate({
  checklistEnabled,
  checklistItems,
  cookPhase,
  isDone,
  scale,
  baseServings,
}: UseCookIngredientPanelInput) {
  const showPanel =
    checklistEnabled && checklistItems.length > 0 && cookPhase === "steps" && !isDone;

  const scaleLabel = useMemo(
    () => cookScaleCaption(scale, baseServings),
    [scale, baseServings],
  );

  return { showPanel, scaleLabel };
}
