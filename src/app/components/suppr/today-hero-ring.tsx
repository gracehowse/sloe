"use client";

import * as React from "react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";
import { MACRO_RING_TOGGLE } from "../../../lib/copy/today";

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

  /** 2026-05-12 round 4 — pill dropped. Prop preserved on the type for
   *  backwards compat with host wiring; no UI surfaces it here. The
   *  explainer is now reached from the Targets sub-tab inside More
   *  (mirrors mobile). */
  onPressWhy?: () => void;

  /** ENG-798 win-moment ring pulse — forwarded to `DailyRing`. True for
   *  ~200ms after a Today landmark fires (the web analog of mobile's
   *  success haptic). */
  pulse?: boolean;
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
  onPressWhy: _onPressWhy,
  pulse = false,
}: TodayHeroRingProps) {
  // 2026-05-12 round 4 (Grace TF, web parity with mobile): the
  // "Why this number?" pill was dropped. Audit: pill signalled low
  // confidence in the number. On mobile we relocated the affordance to
  // Settings → Targets → "How is this calculated?" row, which opens
  // the WhyThisNumberSheet inline there. Web mirrors: the explainer
  // is reachable from the Targets sub-tab (inside More) on web too,
  // not from Today's hero. Today stays clean.
  return (
    <div className="flex flex-col items-center mb-3 rounded-card border border-border bg-card px-4 py-3 gap-2">
      <DailyRing
        consumed={consumed}
        target={target}
        size={128}
        strokeWidth={9}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        displayMode={displayMode}
        pulse={pulse}
      />
      <button
        type="button"
        data-testid="today-macro-rings-toggle"
        onClick={onToggleExpanded}
        className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
      >
        {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
      </button>
    </div>
  );
}
