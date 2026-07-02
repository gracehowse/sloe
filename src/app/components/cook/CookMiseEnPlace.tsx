"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
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
  // ENG-1311 — CookMode's v3 shell is the immersive aubergine ground
  // (`--primary-deep`, gated on the same flag). The light-theme ink
  // tokens are dark-on-dark there: match the shell siblings instead —
  // H1 = `--accent-frost-bright` (#efe9f2 on #241733, ≈14.1:1), muted
  // copy = `--accent-frost` (≈9.8:1). Flag OFF keeps the light-shell
  // foreground tokens.
  const cookV3 = isFeatureEnabled("recipe_detail_v3_conformance");
  const mutedClass = cookV3 ? "text-[var(--accent-frost)]" : "text-muted-foreground";
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 px-6 py-8 overflow-y-auto"
      data-testid="cook-mise-en-place"
    >
      <div className="w-full max-w-lg flex flex-col gap-4">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedClass}`}>
          Before you start
        </p>
        <h2
          className={`text-2xl font-semibold ${
            cookV3 ? "text-[var(--accent-frost-bright)]" : "text-foreground"
          }`}
        >
          Gather your ingredients
        </h2>
        {recipeTitle ? (
          <p className={`text-sm ${mutedClass}`}>{recipeTitle}</p>
        ) : null}
        <p className={`text-sm leading-relaxed ${mutedClass}`}>
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
