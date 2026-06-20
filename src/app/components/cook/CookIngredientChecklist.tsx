"use client";

import { Check } from "lucide-react";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { useCookIngredientChecklist } from "../../../lib/nutrition/useCookIngredientChecklist.ts";

export type CookIngredientChecklistItem = {
  name: string;
  amountLabel?: string | null;
};

export interface CookIngredientChecklistProps {
  recipeId: string;
  items: CookIngredientChecklistItem[];
  surface: "recipe_detail" | "mise" | "cook_sidebar";
}

/** Tap-to-check ingredient rows — web (ENG-946). */
export function CookIngredientChecklist({
  recipeId,
  items,
  surface,
}: CookIngredientChecklistProps) {
  const { isChecked, toggle } = useCookIngredientChecklist(recipeId);

  if (items.length === 0) return null;

  return (
    <ul className="space-y-2 w-full" data-testid="cook-ingredient-checklist">
      {items.map((item, index) => {
        const checked = isChecked(index);
        return (
          <li key={`${index}:${item.name}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => {
                const next = toggle(index);
                try {
                  track(AnalyticsEvents.cook_ingredient_checked, {
                    recipeId,
                    index,
                    checked: next,
                    surface,
                    platform: "web",
                  });
                } catch {
                  /* analytics fire-and-forget */
                }
              }}
              className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                checked
                  ? "border-border bg-muted/40"
                  : "border-border/70 bg-card hover:bg-muted/30"
              }`}
              data-testid={`cook-ingredient-check-${index}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  checked
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border bg-background"
                }`}
                aria-hidden
              >
                {checked ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    checked ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {item.name}
                </span>
                {item.amountLabel ? (
                  <span
                    className={`block text-xs tabular-nums mt-0.5 ${
                      checked ? "line-through text-muted-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.amountLabel}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
