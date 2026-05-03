"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";

/**
 * TodayHeroRing — Today-screen calorie ring wrapper.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). This is
 * a pure presentation wrapper — it holds no state of its own beyond what
 * the parent passes in. Keeping it thin so any visual or behavioural
 * change still flows through the composition root.
 *
 * Mirrors the mobile `TodayHeroRing` wrapper around `CalorieRing`.
 *
 * 2026-05-02 — segmented "Remaining / Consumed" chips removed for
 * mobile-web parity after user feedback that the chip control on
 * mobile felt redundant. Web is touch-driven on mobile-web and
 * mouse-driven on desktop; in both cases the canonical mode toggle
 * lives in the ring's own click affordance + the existing power-user
 * gesture (long-press on touch, click-and-hold on desktop). The chip
 * control did not survive the same UX bar that took it off mobile.
 * See `docs/decisions/2026-05-02-revert-today-ui-changes.md`.
 *
 * `onDisplayModeChange` is still threaded through the host so the
 * tap-on-ring path can flip the mode if the host wires it; today the
 * host (NutritionTracker) only flips on explicit gesture, not tap.
 */
export interface TodayHeroRingProps {
  consumed: number;
  target: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: CalorieRingDisplayMode;
  /** Reserved for the long-press / click-and-hold gesture handlers
   *  inside `DailyRing`. Wired through the host so any future click
   *  affordance has a single mutation point. */
  onDisplayModeChange: (mode: CalorieRingDisplayMode) => void;

  /** Audit gap #10 transparency moat (2026-05-01). When provided, a
   *  small "Why this number?" pill renders below the ring; tapping it
   *  opens the host-owned `WhyThisNumberDialog`. */
  onPressWhy?: () => void;
}

export function TodayHeroRing({
  consumed,
  target,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onDisplayModeChange: _onDisplayModeChange,
  onPressWhy,
}: TodayHeroRingProps) {
  return (
    <div className="flex flex-col items-center mb-4">
      <DailyRing
        consumed={consumed}
        target={target}
        size={160}
        strokeWidth={10}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
      />
      {/* Audit gap #10 transparency moat (2026-05-01) — small "Why this
          number?" pill that opens the WhyThisNumberDialog. Sized so it
          doesn't fight the ring tap target. */}
      {onPressWhy ? (
        <button
          type="button"
          data-testid="today-hero-why-this-number"
          aria-label="Why this number? Open calorie target explanation"
          onClick={onPressWhy}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors px-3 py-1 text-[11px] font-bold tracking-wide text-primary"
        >
          <HelpCircle size={12} strokeWidth={2.25} />
          Why this number?
        </button>
      ) : null}
    </div>
  );
}
