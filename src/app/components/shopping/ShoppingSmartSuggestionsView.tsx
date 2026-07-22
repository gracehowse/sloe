import { Check, Sparkles } from "lucide-react";
import { SupprCard } from "../ui/suppr-card";
import {
  formatOverlapSummary,
  type ShoppingSmartSuggestion,
} from "../../../lib/planning/shoppingSmartSuggestions.ts";

/**
 * ENG-1634 — presentational "Smart suggestions" card (web). Hosts wire data
 * via `ShoppingSmartSuggestions`; stories render this view directly.
 */
export type ShoppingSmartSuggestionsViewProps = {
  suggestions: readonly ShoppingSmartSuggestion[];
  addingRecipeId?: string | null;
  addedRecipeIds?: ReadonlySet<string>;
  onAddToPlan?: (suggestion: ShoppingSmartSuggestion) => void;
};

export function ShoppingSmartSuggestionsView({
  suggestions,
  addingRecipeId = null,
  addedRecipeIds,
  onAddToPlan,
}: ShoppingSmartSuggestionsViewProps) {
  if (suggestions.length === 0) return null;
  const added = addedRecipeIds ?? new Set<string>();

  return (
    <SupprCard
      data-testid="shopping-smart-suggestions"
      elevation="card"
      padding="none"
      radius="xl"
      className="px-5 py-5 mb-5"
      style={{ maxWidth: 900 }}
    >
      <div className="flex items-start gap-2 mb-4">
        <Sparkles width={16} height={16} className="text-primary-solid shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Smart suggestions</p>
          <p className="text-sm text-muted-foreground mt-1">
            Recipes that reuse what&apos;s already on your list.
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {suggestions.map((s) => {
          const busy = addingRecipeId === s.recipeId;
          const isAdded = added.has(s.recipeId);
          return (
            <li
              key={s.recipeId}
              data-testid={`shopping-smart-suggestion-${s.recipeId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Also uses {formatOverlapSummary(s.overlapIngredientNames)}
                </p>
                {s.macroFit ? (
                  <p className="text-xs text-muted-foreground mt-1">{s.macroFit.label}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onAddToPlan?.(s)}
                disabled={busy || isAdded || !onAddToPlan}
                aria-busy={busy}
                data-testid={`shopping-smart-suggestion-add-${s.recipeId}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold text-primary-solid bg-transparent hover:bg-primary-soft active:bg-primary-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {isAdded ? (
                  <>
                    <Check width={13} height={13} aria-hidden />
                    Added
                  </>
                ) : busy ? (
                  "Adding…"
                ) : (
                  "Add to plan"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </SupprCard>
  );
}
