import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { TodayHeroRing } from "./TodayHeroRing";
import { Accent } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

// Soft fill for the success pill — no `Accent.successSoft` token exists,
// so derive a 12%-alpha tint from `Accent.success` (#56A775) to match the
// web `bg-success/10` treatment. Mirror of web's `bg-success/10`.
const SUCCESS_SOFT = "rgba(86, 167, 117, 0.12)";

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
  onToggleDisplayMode: () => void;

  // Theme colours (from host's theme hook)
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
  trackColor: string;

  /** Audit gap #10 (2026-05-01) — when provided, a small "Why this
   *  number?" pill renders below the ring; tap fires this handler. */
  onPressWhy?: () => void;

  /** ENG-753 — true when the user has logged today and calories are
   *  within ±10% of the daily target. Drives the "On track" pill.
   *  Gated behind `today-status-pills`. */
  isOnTrack?: boolean;
  /** ENG-753 — adaptive-TDEE learning progress, 0-7. Retained for call-site
   *  stability but no longer rendered on Today (the "Adaptive TDEE learning ·
   *  N of 7 days" line was removed 2026-06-08 to match Figma `654:2`; the
   *  learning state lives on Progress). The underlying TDEE logic is
   *  unchanged. */
  tdeeLearnDays?: number;
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
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    cardBackgroundColor,
    borderColor,
    trackColor,
    onPressWhy,
    isOnTrack,
    // `tdeeLearnDays` is retained on the props interface for call-site
    // stability but no longer rendered on Today — the Adaptive-TDEE line was
    // removed to match Figma `654:2` (2026-06-08). The learning state lives
    // on Progress.
  } = props;

  // ENG-753 — "On track" pill below the ring (prototype screens-web.jsx
  // :173-177). Flag-gated.
  //
  // Sloe redesign (2026-06-08): the "Adaptive TDEE learning · N of 7 days"
  // line was removed — the canonical Figma `654:2` Today hero shows nothing
  // between the Goal/Eaten/Bonus stats and the "Room for dinner" coach line.
  // The learning state lives on Progress. The `tdeeLearnDays` prop is retained
  // for call-site stability and the underlying adaptive-TDEE logic is
  // unchanged — only this presentational line is gone.
  const showOnTrack = isOnTrack === true;
  const showPills = isFeatureEnabled("today-status-pills") && showOnTrack;

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
        textTertiaryColor={textTertiaryColor}
        onPressWhy={onPressWhy}
      />

      {showPills ? (
        <View style={styles.pillRow} testID="today-status-pills">
          <View
            style={[styles.pill, { backgroundColor: SUCCESS_SOFT }]}
            testID="today-pill-on-track"
          >
            <Text style={[styles.pillText, { color: Accent.success }]}>
              ✓ On track
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default TodayHero;
