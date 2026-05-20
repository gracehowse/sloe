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
    // 2026-05-12 (premium-bar audit web parity, DC3 polish): 200ms
    // fade-up entrance using the shared `.v2-fade-up` keyframe so
    // every Today suggestion card lands with the same motion.
    // Mirrors mobile's 220ms reanimated fade-up.
    <div className="mb-3 rounded-card border border-border bg-card px-3.5 py-3 flex items-center gap-3 v2-fade-up">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Eat again</p>
        <p className="text-[13px] font-semibold text-foreground line-clamp-2 break-words">{suggestion.recipeTitle}</p>
        {/* 2026-05-12 (premium-bar audit web parity, cross-cutting
            copy unify): macro format normalised to `698 kcal · 22g
            P · 95g C · 27g F` to match the canonical
            `formatMacroTrailer` shape on mobile. Was letter-first
            (`P 22g · C 95g`). */}
        <p className="text-[11px] text-muted-foreground">
          {Math.round(suggestion.calories)} kcal · {Math.round(suggestion.protein)}g P · {Math.round(suggestion.carbs)}g C · {Math.round(suggestion.fat)}g F · into {slot}
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
