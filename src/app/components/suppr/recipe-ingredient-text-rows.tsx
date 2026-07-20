"use client";

/**
 * Recipe detail — ingredient TEXT rows (ENG-1611, prototype `.w-ing`).
 * Flag-ON sibling of the RecipeDetail tile grid (legacy path byte-intact
 * in the else): name left (+ Override/Added badges), dotted leader,
 * scaled amount + kcal right, then the trust cluster — categorical tier
 * label (F-120, no opaque %), provenance SourceDot (D-2026-04-27-16,
 * incl. the AI-estimated variant), Verify → on estimated rows, and the
 * owner Fix/Override hover affordances. No tiles, photos, or monograms.
 * Mobile parity: `apps/mobile/components/recipe/RecipeIngredientRows.tsx`.
 */
import { Badge } from "./badge";
import { SourceDot } from "../ui/source-dot";
import { mapMealSourceToDot } from "../../../lib/nutrition/sourceMap.ts";
import {
  effectiveMacros,
  hasOverride,
  type RecipeIngredientLike,
} from "../../../lib/nutrition/ingredientOverrides.ts";
import { formatIngredientAmountUnit } from "../../../lib/recipe-ingredients/formatIngredientAmount.ts";
import {
  deriveIngredientVerificationTier,
  ingredientShouldShowVerifyCta,
} from "../../../lib/recipe-ingredients/ingredientVerificationStatus.ts";
import { ING_TIER_COLOR, ING_TIER_LABEL } from "../../../lib/recipe-ingredients/ingredientTierDisplay.ts";
import { formatNutritionTrustTierLabel } from "../../../lib/nutrition/sourceLabel.ts";
import { cleanIngredientDisplayName } from "../../../lib/recipe/cleanIngredientDisplayName.ts";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

type TextRowIngredient = RecipeIngredientLike & {
  name: string;
  amount?: string | null;
  unit?: string | null;
  source?: string | null;
  isVerified?: boolean | null;
  confidence?: number | null;
};

export function RecipeIngredientTextRows({
  ingredients,
  servings,
  baseServings,
  dbIngredientIds,
  onVerify,
  onOverride,
}: {
  ingredients: TextRowIngredient[];
  servings: number;
  baseServings: number;
  dbIngredientIds: (string | null | undefined)[];
  onVerify: (index: number) => void;
  onOverride: (index: number) => void;
}) {
  const trustSourceNames = isFeatureEnabled("trust_source_name_v1");
  return (
    <ul aria-label="Ingredients" data-testid="recipe-ingredient-rows">
      {ingredients.map((ingredient, index) => {
        const eff = effectiveMacros(ingredient);
        const ingCal = Math.round((eff.calories * servings) / baseServings);
        const tier = deriveIngredientVerificationTier({
          isVerified: ingredient.isVerified ?? null,
          confidence: ingredient.confidence ?? null,
          source: ingredient.source ?? null,
        });
        const tierLabel = trustSourceNames
          ? formatNutritionTrustTierLabel(tier, ingredient.source)
          : ING_TIER_LABEL[tier];
        const amountLine = ingredient.amount
          ? formatIngredientAmountUnit((parseFloat(ingredient.amount) * servings) / baseServings, ingredient.unit ?? null)
          : ingredient.unit;
        const displayName = cleanIngredientDisplayName(ingredient.name) || ingredient.name;
        return (
          <li
            key={index}
            className="group flex items-baseline gap-2 border-b border-border py-3 last:border-b-0"
            data-testid={`recipe-ingredient-row-${index}`}
          >
            <span className="flex-none max-w-[70%] inline-flex items-baseline gap-1">
              <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
              {hasOverride(ingredient) ? (
                <Badge variant="override" title="Manual macro override is pinned on this row.">
                  Override
                </Badge>
              ) : null}
              {ingredient.addedByUser ? (
                <Badge variant="added" title="Added by you after import.">
                  Added
                </Badge>
              ) : null}
            </span>
            <span
              className="flex-1 -translate-y-[3px] border-b border-dotted"
              style={{ borderColor: "var(--border-strong)" }}
              aria-hidden
            />
            <span className="flex-none inline-flex items-baseline gap-1.5">
              {amountLine ? (
                <span className="text-xs tabular-nums text-muted-foreground">{amountLine}</span>
              ) : null}
              {/* P2-30: kcal suppressed at 0. */}
              {ingCal > 0 ? (
                <span className="text-xs font-semibold tabular-nums text-foreground">{ingCal} kcal</span>
              ) : null}
              {/* F-120: categorical tier label only (no opaque %). */}
              <span className="text-[10px] font-semibold" style={{ color: ING_TIER_COLOR[tier] }}>
                {tierLabel}
              </span>
              {/* Phase 4 / B3.X — provenance SourceDot. */}
              <SourceDot
                source={mapMealSourceToDot(ingredient.source ?? null)}
                size={6}
                data-testid={`recipe-ingredient-source-${index}`}
              />
              {dbIngredientIds[index] && ingredientShouldShowVerifyCta(tier) ? (
                <button
                  type="button"
                  onClick={() => onVerify(index)}
                  className="text-[10px] font-bold text-primary-solid hover:underline"
                  aria-label={`Verify ${ingredient.name}`}
                  data-testid={`recipe-ingredient-verify-${index}`}
                >
                  Verify →
                </button>
              ) : null}
              {dbIngredientIds[index] ? (
                <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onVerify(index)}
                    className="rounded-full px-1.5 py-0.5 text-[10px] text-primary-solid hover:bg-primary-soft"
                    aria-label={`Fix match for ${ingredient.name}`}
                  >
                    Fix
                  </button>
                  <button
                    type="button"
                    onClick={() => onOverride(index)}
                    className="rounded-full px-1.5 py-0.5 text-[10px] text-primary-solid hover:bg-primary-soft"
                    aria-label={`Override nutrition for ${ingredient.name}`}
                  >
                    Override
                  </button>
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
