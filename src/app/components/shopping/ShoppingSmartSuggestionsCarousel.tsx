import { Sparkles } from "lucide-react";
import {
  smartSuggestionMacroFitLabel,
  type SmartSuggestion,
} from "../../../lib/planning/smartSuggestions";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { SupprCard } from "../ui/suppr-card";
import { SupprButton } from "../suppr/suppr-button";

type ShoppingSmartSuggestionsCarouselProps = {
  suggestions: SmartSuggestion[];
  onOpenRecipe?: (recipeId: string) => void;
  onAddToPlan?: (suggestion: SmartSuggestion) => void;
  dayLabelForIndex?: (dayIndex: number) => string;
};

export function ShoppingSmartSuggestionsCarousel({
  suggestions,
  onOpenRecipe,
  onAddToPlan,
  dayLabelForIndex,
}: ShoppingSmartSuggestionsCarouselProps) {
  if (suggestions.length === 0) return null;

  return (
    <SupprCard
      data-testid="shopping-smart-suggestions"
      elevation="card"
      padding="lg"
      radius="xl"
      className="mb-4"
    >
      <div className="flex items-start gap-2 mb-3">
        <Sparkles size={16} className="text-primary-solid mt-0.5 shrink-0" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-foreground">Smart suggestions</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Also uses items already in your list
          </p>
        </div>
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        data-testid="shopping-smart-suggestions-carousel"
      >
        {suggestions.map((s) => {
          const overlap = s.sharedIngredients.slice(0, 2).join(", ");
          const dayLabel =
            s.macroFit && dayLabelForIndex ? dayLabelForIndex(s.macroFit.dayIndex) : undefined;
          const macroLabel =
            s.macroFit && dayLabel ? smartSuggestionMacroFitLabel(s.macroFit, dayLabel) : null;
          return (
            <div
              key={s.recipe.id}
              className="flex shrink-0 w-[240px] flex-col rounded-lg border border-border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => onOpenRecipe?.(s.recipe.id)}
                className="text-left text-[13px] font-semibold text-foreground hover:text-primary-solid transition-colors line-clamp-2"
              >
                {s.recipe.title}
              </button>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                Also uses {overlap}
              </p>
              {macroLabel ? (
                <p className="text-[11px] text-primary-solid mt-1 truncate">{macroLabel}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(s.recipe.calories)} kcal
                </span>
                {onAddToPlan && s.macroFit ? (
                  <SupprButton
                    variant="primary"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => {
                      onAddToPlan(s);
                      track(AnalyticsEvents.smart_suggestion_added_to_plan, {
                        recipeId: s.recipe.id,
                        dayIndex: s.macroFit?.dayIndex ?? -1,
                        mealIndex: s.macroFit?.mealIndex ?? -1,
                        platform: "web",
                        surface: "shopping",
                      });
                    }}
                  >
                    Add to plan
                  </SupprButton>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </SupprCard>
  );
}
