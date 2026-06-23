"use client";

import { SupprButton } from "../suppr/suppr-button.tsx";
import {
  CookIngredientChecklist,
  type CookIngredientChecklistItem,
} from "./CookIngredientChecklist.tsx";

export interface CookMiseEnPlaceProps {
  recipeId: string;
  recipeTitle?: string;
  items: CookIngredientChecklistItem[];
  onContinueToSteps: () => void;
}

/** Optional pre-step "Gather your ingredients" screen — web (ENG-946). */
export function CookMiseEnPlace({
  recipeId,
  recipeTitle,
  items,
  onContinueToSteps,
}: CookMiseEnPlaceProps) {
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 px-6 py-8 overflow-y-auto"
      data-testid="cook-mise-en-place"
    >
      <div className="w-full max-w-lg flex flex-col gap-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Before you start
        </p>
        <h2 className="text-2xl font-semibold text-foreground">Gather your ingredients</h2>
        {recipeTitle ? (
          <p className="text-sm text-muted-foreground">{recipeTitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap each line as you add it — so you never wonder whether the salt went in.
        </p>
        <CookIngredientChecklist recipeId={recipeId} items={items} surface="mise" />
        <SupprButton
          variant="primary"
          className="w-full mt-4"
          onClick={onContinueToSteps}
          data-testid="cook-mise-continue"
        >
          Start cooking
        </SupprButton>
      </div>
    </div>
  );
}
