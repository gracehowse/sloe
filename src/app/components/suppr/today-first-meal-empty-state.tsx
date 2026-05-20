"use client";

import { Plus, Sparkles, X } from "lucide-react";

/**
 * TodayFirstMealEmptyState — friendly empty card surfaced under the
 * calorie ring when the user has logged 0 meals today AND has zero
 * journal history. Closes journey-architect P1 ("Empty states are
 * silent. No journey has an empty state with a clear 'do this next'
 * action.") for the day-1 / cold-start surface.
 *
 * Mobile parity: `apps/mobile/components/today/TodayFirstMealEmptyState.tsx`.
 */
export interface TodayFirstMealEmptyStateProps {
  /** Open the unified LogSheet so the user can log their first meal. */
  onLogMeal: () => void;
  /** True iff `auth.users.created_at < 24h ago` (brand-new account). */
  isBrandNew: boolean;
  /** True iff the user has previously dismissed the IG/TT recipe-paste tip. */
  tipDismissed: boolean;
  /** Fires when the user dismisses the tip. Host persists. */
  onDismissTip: () => void;
}

export function TodayFirstMealEmptyState({
  onLogMeal,
  isBrandNew,
  tipDismissed,
  onDismissTip,
}: TodayFirstMealEmptyStateProps) {
  const showTip = isBrandNew && !tipDismissed;
  return (
    <section
      role="region"
      aria-label="Ready to log your first meal?"
      className="mb-6 flex flex-col items-center gap-3 rounded-card border border-border bg-card p-5 text-center"
    >
      <h2 className="text-base font-bold text-foreground">
        Ready to log your first meal?
      </h2>
      <p className="px-2 text-xs text-muted-foreground">
        Search a food, scan a barcode, or paste a recipe — your day starts here.
      </p>
      {/* DC12 (2026-05-14, premium-bar audit) — Headspace-style
          supportive moment-of-truth line. Mobile parity:
          `apps/mobile/components/today/TodayFirstMealEmptyState.tsx`. */}
      <p
        data-testid="first-meal-empty-supportive-copy"
        className="px-2 text-xs text-muted-foreground"
      >
        No pressure — log when you&apos;re ready.
      </p>
      <button
        type="button"
        onClick={onLogMeal}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Log a meal"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Log a meal
      </button>
      {showTip && (
        <div
          className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
          role="note"
        >
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="flex-shrink min-w-0">
            Tip: paste an Instagram or TikTok recipe URL — we&apos;ll break it down for you.
          </span>
          <button
            type="button"
            onClick={onDismissTip}
            aria-label="Dismiss tip"
            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

export default TodayFirstMealEmptyState;
