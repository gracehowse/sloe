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
  /** De-carded v3 hero (ENG-1247): 56px serif-medium centre numeral. */
  numeralLarge?: boolean;
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
  numeralLarge = false,
}: TodayHeroRingGraphicProps) {
  if (isFeatureEnabled("sloe_v3_ring")) {
    // The jewel watch-dial does NOT use the legacy empty-state 0.72 shrink (it
    // read too small — Grace 2026-06-22); it sits at a bumped full size so the
    // thin-tick dial still anchors the hero.
    return (
      <CalorieRingDial
        consumed={consumed}
        target={goal}
        size={Math.round(ringGeometry(false).SIZE * 1.15)}
        numeralLarge={numeralLarge}
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
