import React from "react";
import { View } from "react-native";

import { TodayHeroRing } from "./TodayHeroRing";

/**
 * TodayHero — the canonical Today calorie hero, rendered as a ring.
 *
 * Phase 3 (2026-04-28): the three-variant picker (ring / bar / number)
 * was removed per D-2026-04-27-03 — "Three variants is design
 * indecision dressed as pluralism." `TodayHero` is now a thin wrapper
 * around `TodayHeroRing`.
 *
 * Phase 5 (2026-04-30): the "Includes N AI-estimated meals" inline
 * sentinel was removed. customer-lens flagged it as a defensive
 * disclaimer that contradicted the 2026-04-27 strategic direction
 * (macro-tracker-first, not AI-first). The signal is now delivered
 * once via `AiFirstLogTooltip` on the user's first photo/voice log
 * row in `TodayMealsSection`. After that one-time tooltip dismisses,
 * AI-sourced meals carry the SourceDot pill on their row (already
 * present) and nothing else above the meals list.
 *
 * Web parity: web's `today-hero-ring.tsx` was already single-variant
 * and never carried the sentinel pill, so removing it from mobile
 * brings the two surfaces back into shape parity.
 */
export interface TodayHeroProps {
  consumed: number;
  goal: number;
  baseGoal?: number;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Expand-macros state (host-owned)
  expanded: boolean;
  onToggleExpanded: () => void;

  // Remaining/consumed toggle (host-owned)
  displayMode: "remaining" | "consumed";
  /** Long-press toggles the mode (legacy gesture). */
  onToggleDisplayMode: () => void;
  /** Chip tap sets the mode explicitly. Wave 8a web parity. */
  onSetDisplayMode: (mode: "remaining" | "consumed") => void;

  // Theme colours (from host's theme hook)
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
  trackColor: string;
}

export function TodayHero(props: TodayHeroProps) {
  const {
    consumed,
    goal,
    baseGoal,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onToggleDisplayMode,
    onSetDisplayMode,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    cardBackgroundColor,
    borderColor,
    trackColor,
  } = props;

  return (
    <View>
      <TodayHeroRing
        consumed={consumed}
        goal={goal}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={textSecondaryColor}
        trackColor={trackColor}
        cardBackgroundColor={cardBackgroundColor}
        borderColor={borderColor}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
        onSetDisplayMode={onSetDisplayMode}
        textTertiaryColor={textTertiaryColor}
      />
    </View>
  );
}

export default TodayHero;
