"use client";

import * as React from "react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";

/**
 * TodayHeroRing — Today-screen calorie ring wrapper + display-mode toggle.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). This is
 * a pure presentation wrapper — it holds no state of its own beyond what
 * the parent passes in. Keeping it thin so any visual or behavioural
 * change still flows through the composition root.
 *
 * Mirrors the mobile `TodayHeroRing` wrapper around `CalorieRing`.
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
  onDisplayModeChange: (mode: CalorieRingDisplayMode) => void;
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
  onDisplayModeChange,
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
      <p className="text-xs text-muted-foreground mt-3">
        {expanded ? "Click the ring to hide macros" : "Click the ring to show macros"}
      </p>
      {/* Mode toggle — prototype port (2026-04-20, mobile parity):
          subtle tint instead of a heavy primary fill so the control
          matches the ring's understated look (see ui-critic note on
          mobile's 28x28 picker in `TodayHero.tsx`). Active chip reads
          as foreground-on-card; inactive chip inherits muted. */}
      <div
        className="flex justify-center gap-0.5 mt-2 rounded-lg bg-muted/50 p-0.5"
        role="group"
        aria-label="Calorie ring display"
      >
        {(["remaining", "consumed"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onDisplayModeChange(mode)}
            aria-pressed={displayMode === mode}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
              displayMode === mode ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode === "remaining" ? "Remaining" : "Consumed"}
          </button>
        ))}
      </div>
    </div>
  );
}
