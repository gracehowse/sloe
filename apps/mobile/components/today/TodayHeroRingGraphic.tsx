import React from "react";
import CalorieRing from "@/components/charts/CalorieRing";
import { CalorieRingDial } from "@/components/charts/CalorieRingDial";
import { ringGeometry } from "@/components/charts/CalorieRing";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * TodayHeroRingGraphic — the Today hero's calorie graphic, behind the Sloe v3
 * `sloe_v3_ring` flag. Extracted from `TodayHeroRing` (ENG-1225) so the swap
 * doesn't grow that pinned 400+ host.
 *
 * - flag ON  → `CalorieRingDial` (the v3 jewel watch-dial; calorie-only —
 *   macros live in the separate Tiles/Bars/Rings section, so `expanded` /
 *   macro percentages are intentionally unused on this path). Sized to match
 *   the legacy ring's footprint (incl. the empty-state shrink) so the hero
 *   geometry is unchanged.
 * - flag OFF → the legacy concentric `CalorieRing` (unchanged).
 *
 * Mirrors the web swap in `today-hero-ring.tsx` / `today-hero-stats.tsx`.
 */
export interface TodayHeroRingGraphicProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function TodayHeroRingGraphic({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
}: TodayHeroRingGraphicProps) {
  if (isFeatureEnabled("sloe_v3_ring")) {
    const isEmpty = consumed === 0 || goal <= 0;
    return (
      <CalorieRingDial
        consumed={consumed}
        target={goal}
        size={ringGeometry(isEmpty).SIZE}
      />
    );
  }
  return (
    <CalorieRing
      consumed={consumed}
      goal={goal}
      baseGoal={baseGoal}
      textColor={textColor}
      secondaryColor={secondaryColor}
      trackColor={trackColor}
      proteinPct={proteinPct}
      carbsPct={carbsPct}
      fatPct={fatPct}
      expanded={expanded}
      onToggle={onToggleExpanded}
    />
  );
}

export default TodayHeroRingGraphic;
