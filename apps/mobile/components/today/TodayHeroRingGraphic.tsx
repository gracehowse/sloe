import React from "react";
import { CalorieRingDial } from "@/components/charts/CalorieRingDial";
import { ringGeometry } from "@/components/charts/CalorieRing";

/**
 * TodayHeroRingGraphic — the Today hero's calorie graphic (the Sloe v3 jewel
 * watch-dial). Extracted from `TodayHeroRing` (ENG-1225) so the swap doesn't
 * grow that pinned 400+ host.
 *
 * Calorie-only — macros live in the separate Tiles/Bars/Rings section, so
 * `expanded` / macro percentages are intentionally unused here (the dial's
 * tap/long-press still fires `onToggleExpanded` so the macro section toggles
 * from the ring, ENG-1465). Sized to match the legacy ring's footprint
 * (incl. the empty-state shrink) so the hero geometry is unchanged.
 *
 * Mirrors the web ring in `today-hero-ring.tsx` / `today-hero-stats.tsx`.
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
  /** ENG-1653 — dial-view switch (Remaining ⇆ Consumed), cluster hero only. */
  dialDisplayMode?: "remaining" | "consumed";
}

export function TodayHeroRingGraphic({
  consumed,
  goal,
  onToggleExpanded,
  numeralLarge = false,
  dialDisplayMode,
}: TodayHeroRingGraphicProps) {
  // The jewel watch-dial does NOT use the legacy empty-state 0.72 shrink (it
  // read too small — Grace 2026-06-22); it sits at a bumped full size so the
  // thin-tick dial still anchors the hero.
  return (
    <CalorieRingDial
      consumed={consumed}
      target={goal}
      size={Math.round(ringGeometry(false).SIZE * 1.15)}
      numeralLarge={numeralLarge}
      // ENG-1465 — tap/long-press toggle, restoring the legacy
      // `CalorieRing onToggle={onToggleExpanded}` wiring the v3 swap dropped.
      // On the ENG-1653 cluster hero the host passes the dial-view switch
      // through this same callback (prototype ring-tap).
      onToggle={onToggleExpanded}
      displayMode={dialDisplayMode}
    />
  );
}

export default TodayHeroRingGraphic;
