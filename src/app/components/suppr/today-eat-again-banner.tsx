"use client";

import * as React from "react";
import type { FoodHistoryItem } from "../../../lib/nutrition/foodHistory";

/**
 * TodayEatAgainBanner — "Eat again" one-tap re-log prompt.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Pure
 * presentation; `onLog` and `onDismiss` are supplied by the host so the
 * logging pipeline + AsyncStorage-equivalent dismissal stay centralised.
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
  return (
    <div className="mb-3 rounded-card border border-primary/30 bg-primary/5 px-3.5 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Eat again</p>
        <p className="text-[13px] font-semibold text-foreground truncate">{suggestion.recipeTitle}</p>
        <p className="text-[11px] text-muted-foreground">
          {Math.round(suggestion.calories)} kcal · P {Math.round(suggestion.protein)}g · C {Math.round(suggestion.carbs)}g · F {Math.round(suggestion.fat)}g · into {slot}
        </p>
      </div>
      <button
        type="button"
        onClick={onLog}
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:opacity-90"
        aria-label={`Log ${suggestion.recipeTitle} to ${slot}`}
      >
        Log
      </button>
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
