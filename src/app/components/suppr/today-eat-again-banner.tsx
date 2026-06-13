"use client";

import * as React from "react";
import type { FoodHistoryItem } from "../../../lib/nutrition/foodHistory";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import { SupprButton } from "./suppr-button";

/**
 * TodayEatAgainBanner — "Eat again" one-tap re-log prompt.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Pure
 * presentation; `onLog` and `onDismiss` are supplied by the host so the
 * logging pipeline + AsyncStorage-equivalent dismissal stay centralised.
 *
 * ENG-602 / ENG-643: 64px hero thumb, 2-line title, meal-row density.
 */
export interface TodayEatAgainBannerProps {
  suggestion: FoodHistoryItem;
  slot: string;
  onLog: () => void;
  onDismiss: () => void;
}

export function TodayEatAgainBanner({
  suggestion,
  slot,
  onLog,
  onDismiss,
}: TodayEatAgainBannerProps) {
  const imageUrl = suggestion.imageUrl;
  const showThumb = Boolean(imageUrl || suggestion.recipeTitle);

  return (
    // Sloe treatment system (2026-06-08): the eat-again prompt is a
    // soft-tint NUDGE card — a faint aubergine wash (`bg-primary/10`,
    // mirroring mobile `Accent.primarySoft`) signals "actionable"
    // without a loud fill. Mirror of the mobile `TodayEatAgainBanner`.
    <div className="mb-3 rounded-card bg-primary/10 px-3 py-2.5 flex items-center gap-3 v2-fade-up">
      {showThumb ? (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg relative">
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imageUrl} alt="" className="h-full w-full object-cover rounded-lg" />
          ) : (
            <RecipeHeroFallback id={suggestion.recipeTitle} title={suggestion.recipeTitle} iconSize={28} />
          )}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Eat again</p>
        <p className="text-[13px] font-semibold text-foreground line-clamp-2 break-words leading-snug">
          {suggestion.recipeTitle}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {Math.round(suggestion.calories)} kcal · {Math.round(suggestion.protein)}g P ·{" "}
          {Math.round(suggestion.carbs)}g C · {Math.round(suggestion.fat)}g F · into {slot}
        </p>
      </div>
      {/* Sloe button system (2026-06-12): this is a NUDGE banner (same category
          as the activity-bonus nudge) — the CTA → SupprButton variant="ghost"
          (transparent / no border / plum label). The north-star hero owns the
          primary "Log it" moment. Mirror of mobile `TodayEatAgainBanner`. */}
      <SupprButton
        variant="ghost"
        type="button"
        onClick={onLog}
        className="h-auto px-3 py-1.5 rounded-md text-[11px] font-bold"
        aria-label={`Log ${suggestion.recipeTitle} to ${slot}`}
      >
        Log it
      </SupprButton>
      <button
        type="button"
        onClick={onDismiss}
        className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        aria-label="Dismiss Eat again suggestion"
        title="Dismiss"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}
