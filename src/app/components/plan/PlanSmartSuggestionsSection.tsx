import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import {
  smartSuggestionMacroFitLabel,
  type SmartSuggestion,
} from "../../../lib/planning/smartSuggestions";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { SupprCard } from "../ui/suppr-card";
import { SupprButton } from "../suppr/suppr-button";

type PlanSmartSuggestionsSectionProps = {
  suggestions: SmartSuggestion[];
  v2Enabled?: boolean;
  onOpenRecipe?: (recipeId: string) => void;
  onSave?: (recipeId: string) => void;
  onAddToPlan?: (suggestion: SmartSuggestion) => void;
  dayLabelForIndex?: (dayIndex: number) => string;
  isSaved?: (recipeId: string) => boolean;
};

export function PlanSmartSuggestionsSection({
  suggestions,
  v2Enabled = false,
  onOpenRecipe,
  onSave,
  onAddToPlan,
  dayLabelForIndex,
  isSaved,
}: PlanSmartSuggestionsSectionProps) {
  const handleAdd = useCallback(
    (s: SmartSuggestion) => {
      onAddToPlan?.(s);
      track(AnalyticsEvents.smart_suggestion_added_to_plan, {
        recipeId: s.recipe.id,
        dayIndex: s.macroFit?.dayIndex ?? -1,
        mealIndex: s.macroFit?.mealIndex ?? -1,
        platform: "web",
        surface: "plan",
      });
    },
    [onAddToPlan],
  );

  if (suggestions.length === 0) return null;

  return (
    <SupprCard
      data-testid="planner-smart-suggestions"
      elevation="card"
      padding="lg"
      radius="xl"
      className="mt-2"
    >
      <div className="flex items-start gap-2 mb-3">
        <Sparkles size={16} className="text-primary-solid mt-0.5 shrink-0" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-foreground">Smart suggestions</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Recipes that share ingredients already in your plan — less waste, fewer one-off buys.
          </p>
        </div>
      </div>
      <div
        className={v2Enabled ? "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" : "space-y-2"}
        data-testid={v2Enabled ? "planner-smart-suggestions-carousel" : undefined}
      >
        {suggestions.map((s) => {
          const overlap = s.sharedIngredients.slice(0, 3).join(", ");
          const extra =
            s.sharedIngredients.length > 3 ? ` +${s.sharedIngredients.length - 3} more` : "";
          const dayLabel =
            s.macroFit && dayLabelForIndex ? dayLabelForIndex(s.macroFit.dayIndex) : undefined;
          const macroLabel =
            v2Enabled && s.macroFit && dayLabel
              ? smartSuggestionMacroFitLabel(s.macroFit, dayLabel)
              : null;
          const saved = isSaved?.(s.recipe.id) ?? s.recipe.isSaved;
          return (
            <div
              key={s.recipe.id}
              className={
                v2Enabled
                  ? "flex shrink-0 w-[280px] flex-col justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                  : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
              }
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpenRecipe?.(s.recipe.id)}
                  className="text-left text-[13px] font-semibold text-foreground hover:text-primary-solid transition-colors truncate max-w-full"
                >
                  {s.recipe.title}
                </button>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Also uses {overlap}
                  {extra}
                </p>
                {macroLabel ? (
                  <p className="text-[11px] text-primary-solid mt-0.5 truncate">{macroLabel}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(s.recipe.calories)} kcal
                </span>
                {v2Enabled && onAddToPlan && s.macroFit ? (
                  <SupprButton
                    variant="primary"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => handleAdd(s)}
                  >
                    Add to plan
                  </SupprButton>
                ) : saved ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Saved
                  </span>
                ) : (
                  <SupprButton
                    variant="ghost"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => onSave?.(s.recipe.id)}
                  >
                    Save
                  </SupprButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SupprCard>
  );
}
