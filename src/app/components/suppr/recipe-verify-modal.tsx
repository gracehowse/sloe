"use client";

/**
 * RecipeVerifyModal (ENG-1333) — web recipe-detail ingredient-verification
 * review surface. The dedicated "review & resolve" modal the import-review
 * banner opens on web, matching the v3 prototype `WebVerify`
 * (`docs/ux/redesign/v3/Sloe-App.html` L8472).
 *
 * Web-only: mobile already has its dedicated `apps/mobile/app/recipe/verify.tsx`
 * screen. This is the web twin of that surface.
 *
 * Contract:
 *  - Lists each ingredient row with a status dot + name + amount·status.
 *  - Every row derives its status from the SHARED
 *    `deriveIngredientVerificationTier` helper — the exact same computation the
 *    inline recipe-detail card grid uses. There is no second/divergent status
 *    source (the SourceDot-drop regression class this ticket guards against).
 *  - Low-confidence rows (partial / estimated / unverified) surface a "Fix"
 *    affordance that routes back into the existing per-row verify search flow
 *    (`onFixRow(index)`), gated to persisted rows only.
 *  - A single primary "Calculate nutrition" CTA is the one filled action.
 *
 * The modal does not persist or compute anything itself — it renders derived
 * status and hands actions back to `RecipeDetail` (the composition root that
 * owns the verify-search flow + the ambient inline SourceDot/Verify CTA).
 * Keeping it presentational makes it testable and keeps the write logic in one
 * place.
 */

import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { SourceDot } from "../ui/source-dot";
import type { IngredientRow } from "../../../types/recipe";
import {
  deriveIngredientVerificationTier,
  ingredientShouldShowVerifyCta,
} from "../../../lib/recipe-ingredients/ingredientVerificationStatus";
import { ING_TIER_COLOR, ING_TIER_LABEL } from "../../../lib/recipe-ingredients/ingredientTierDisplay.ts";
import { mapMealSourceToDot } from "../../../lib/nutrition/sourceMap";
import { cleanIngredientDisplayName } from "../../../lib/recipe/cleanIngredientDisplayName";
import { formatIngredientAmountUnit } from "../../../lib/recipe-ingredients/formatIngredientAmount";
import { ContextualHelpHint } from "../help/ContextualHelpHint";
import { IMPORT_VERIFY_HELP } from "../../../lib/help/importLoopHints";

export type RecipeVerifyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recipe title — rendered as the dialog subtitle. */
  recipeName: string;
  /** The recipe's ingredient rows (same array the inline grid renders). */
  ingredients: IngredientRow[];
  /**
   * Persisted DB ids per ingredient index. A row without an id is not yet
   * persisted, so it cannot be verified through the search flow — the "Fix"
   * affordance is gated on a truthy id (mirrors the inline card grid).
   */
  ingredientIds: string[];
  /** Servings the detail view is scaled to (matches the inline amount line). */
  servings: number;
  /** Base servings the stored amounts are expressed in. */
  baseServings: number;
  /** Open the per-row verify search flow for this ingredient index. */
  onFixRow: (index: number) => void;
  /** Primary CTA — lock in / calculate nutrition, then close. */
  onCalculate: () => void;
};

// Dot colour + status word both come from the canonical
// `ingredientTierDisplay.ts` maps (ENG-1432/tl-F4, 2026-07-20) — this file
// used to define its own TIER_DOT_VAR/TIER_STATUS_LABEL copies, which had
// drifted from the inline recipe-detail grid on both axes: "estimated" wore
// destructive-red here vs the grid's amber (a stale red the grid dropped in
// the 2026-07-01 red-retirement pass, ENG-1296/ENG-1431, that this file
// never picked up), and "partial"/"verified"/"unverified" all read
// different words here ("Estimated"/"Matched"/"Needs input") than the grid
// ("Partial match"/"Structured"/"Unverified") despite representing the
// identical tier. Importing the shared maps makes that drift structurally
// impossible instead of relying on comments to keep two copies in sync.

export function RecipeVerifyModal({
  open,
  onOpenChange,
  recipeName,
  ingredients,
  ingredientIds,
  servings,
  baseServings,
  onFixRow,
  onCalculate,
}: RecipeVerifyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-background max-w-md gap-4"
        data-testid="recipe-verify-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            Verify ingredients
            <ContextualHelpHint topic={IMPORT_VERIFY_HELP} testId="recipe-verify-help" />
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {recipeName
              ? `Confirm each ingredient so Sloe can lock reliable macros for ${recipeName}.`
              : "Confirm each ingredient so Sloe can lock reliable macros."}
          </DialogDescription>
        </DialogHeader>

        <ul
          className="flex flex-col"
          aria-label="Ingredients to verify"
          data-testid="recipe-verify-modal-list"
        >
          {ingredients.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">
              No ingredients to verify yet.
            </li>
          ) : (
            ingredients.map((ingredient, index) => {
              // Shared helper — the SAME derivation the inline card grid uses.
              const tier = deriveIngredientVerificationTier({
                isVerified: ingredient.isVerified ?? null,
                confidence: ingredient.confidence ?? null,
                source: ingredient.source ?? null,
              });
              const canFix = ingredientShouldShowVerifyCta(tier);
              const isPersisted = Boolean(ingredientIds[index]);
              const displayName =
                cleanIngredientDisplayName(ingredient.name) || ingredient.name;
              const amountLine = ingredient.amount
                ? formatIngredientAmountUnit(
                    (parseFloat(ingredient.amount) * servings) / baseServings,
                    ingredient.unit,
                  )
                : ingredient.unit;
              const statusLabel = ING_TIER_LABEL[tier];

              return (
                <li
                  key={index}
                  className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                  data-testid={`recipe-verify-row-${index}`}
                  data-tier={tier}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ING_TIER_COLOR[tier] }}
                    aria-hidden
                    data-testid={`recipe-verify-row-dot-${index}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {displayName}
                      </span>
                      <SourceDot
                        source={mapMealSourceToDot(ingredient.source)}
                        size={6}
                        data-testid={`recipe-verify-row-source-${index}`}
                      />
                    </span>
                    <span className="mt-0.5 block text-xs tabular-nums text-foreground-tertiary">
                      {amountLine ? `${amountLine} · ${statusLabel}` : statusLabel}
                    </span>
                  </span>
                  {canFix ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onFixRow(index)}
                      disabled={!isPersisted}
                      aria-label={`Fix ${ingredient.name}`}
                      data-testid={`recipe-verify-row-fix-${index}`}
                    >
                      Fix
                    </Button>
                  ) : (
                    <Check
                      className="size-4 shrink-0"
                      style={{ color: "var(--success)" }}
                      aria-label="Matched"
                      data-testid={`recipe-verify-row-check-${index}`}
                    />
                  )}
                </li>
              );
            })
          )}
        </ul>

        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            onClick={onCalculate}
            data-testid="recipe-verify-modal-calculate"
          >
            Calculate nutrition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecipeVerifyModal;
