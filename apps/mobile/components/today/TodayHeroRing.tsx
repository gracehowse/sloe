import React from "react";
import { View } from "react-native";
import CalorieRing from "@/components/charts/CalorieRing";
import { Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroRing — ring hero variant.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx`
 * (audit H3, 2026-04-18) as a thin wrapper over `CalorieRing`.
 * Ported to match the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroRing`) on 2026-04-20 — then pared back same day to drop the
 * in-card macro-row list + logged/burned/net mini-stats row that
 * duplicate the adherence bar + 2x2 macro tile grid shown below the
 * hero on Today (see `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current behaviour:
 *   - Ring sits inside a bordered card.
 *   - Tap → no-op (the long-press is the canonical mode toggle).
 *   - Long-press → toggles BOTH the central number ("Remaining" ⇆
 *     "Logged") AND the inner protein/carbs/fat sub-rings (show /
 *     hide). User feedback 2026-05-02 ("the click and hold to switch
 *     between views was better showing and hiding macro rings"):
 *     bring back the long-press as the single gesture for both
 *     state changes. Discoverability via the long-press is sufficient
 *     for the ring; the segmented "Remaining / Consumed" chips
 *     introduced in PR #50 were reverted because the user found them
 *     redundant.
 *   - The "Why this number?" pill below the ring is a separate
 *     affordance, unchanged.
 */
export interface TodayHeroRingProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  cardBackgroundColor: string;
  borderColor: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Interaction — host-owned. The long-press fires BOTH callbacks
  // (display-mode AND expand) so the gesture toggles both pieces of
  // state in lock-step. The host owns the actual state transitions.
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  textTertiaryColor: string;

  /** Audit gap #10 transparency moat (2026-05-01). When provided, a
   *  small "Why this number?" pill button renders directly under the
   *  ring; tapping it should open the host-owned `WhyThisNumberSheet`.
   *  Sized + spaced so it does not interfere with the ring's tap /
   *  long-press affordances. */
  onPressWhy?: () => void;
}

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  textTertiaryColor: _textTertiaryColor,
  onPressWhy: _onPressWhy,
}: TodayHeroRingProps) {
  return (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
        gap: Spacing.lg,
      }}
    >
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
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />
      {/* 2026-05-12 round 3 (Grace TF): "Why this number?" affordance
          is removed from Today entirely. The explainer is now reachable
          from the Targets screen (Settings → Targets → "How is this
          calculated?"). The Reveal step in onboarding already explains
          the math at first run; post-onboarding the explainer's job is
          debugging-mode access, which tolerates 2-3 taps. Today's hero
          stays clean.

          The `onPressWhy` prop is preserved on the type for backwards
          compat with the host wiring in `app/(tabs)/index.tsx`, but no
          UI surfaces it here. If a future iteration brings the
          affordance back, the wiring is still in place. */}
    </View>
  );
}

export default TodayHeroRing;
