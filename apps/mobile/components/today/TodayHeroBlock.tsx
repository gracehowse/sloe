import React, { memo } from "react";
import ReAnimated from "react-native-reanimated";

import { TodayHero } from "@/components/today/TodayHero";
import { TodayDeficitInsight } from "@/components/today/TodayDeficitInsight";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * TodayHeroBlock — the Today calorie hero in its entrance wrapper: the
 * `heroEntrance` fade (Feature 5, 2026-05-14 premium-bar audit — first focus
 * after mount fades 0.85 → 1.0 over 200ms; later focuses are no-ops) around
 * the coach-line dispatch + `TodayHero`.
 *
 * Extracted from `TodayScreen.tsx` (ENG-1653, 2026-07-21) so the pinned
 * legacy host shrinks while gaining the `today_hero_cluster_v3` two-slot
 * render — the same block mounts either inside the tight v3 hero cluster
 * (flag on) or at its legacy fragment position (flag off), so it is built
 * once here rather than duplicated per slot.
 *
 * Composition history that used to live at the call site: Phase 4 / Top-5 #2
 * (2026-04-28) caps Today's above-meals composition at four blocks (date
 * header / hero / one context block / macro tiles) —
 * `docs/ux/teardown-2026-04-28-daily-loop.md` §F1. Phase 5 (2026-04-30)
 * removed the in-card "Includes N AI-estimated meals" sentinel (signal moved
 * to `AiFirstLogTooltip` on the first AI meal row). The deficit coach line
 * renders INSIDE the hero (ENG-1099); the Coach chip is the always-present
 * entry (ENG-1293), both behind the same `coach_screen_v1` gate.
 */
export interface TodayHeroBlockProps {
  /** `heroEntrance.style` from the host's focus-fade animation (Reanimated
   *  animated style — typed off the Animated.View prop so version bumps of
   *  reanimated's style generics can't drift this signature). */
  entranceStyle: React.ComponentProps<typeof ReAnimated.View>["style"];

  totals: { calories: number; protein: number; carbs: number; fat: number };
  effectiveMacroTargets: { protein: number; carbs: number; fat: number };
  effectiveCalorieGoal: number;
  /** Base (pre-activity) goal when an activity bonus is applied, else undefined. */
  baseGoal: number | undefined;

  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
  trackColor: string;

  ringExpanded: boolean;
  onToggleExpanded: () => void;

  /** ENG-758 — distinct weigh-in days in the last 7 (host-computed). */
  tdeeLearnDays: number;
  onPressStatusChip: () => void;
  /** Pushes the Coach screen; gated here on `coach_screen_v1`. */
  onOpenCoach: () => void;

  // Coach deficit-line inputs (rendered inside the hero when no fast is
  // active, it's today, and there's budget left — ENG-1099).
  hasActiveFast: boolean;
  isToday: boolean;
  remaining: number;
  selectedDate: Date;
  byDay: React.ComponentProps<typeof TodayDeficitInsight>["byDay"];

  logConfirmBump: number;
  /** ENG-1372 — true iff TODAY has zero logged entries (a past empty day is
   *  a gap, not a fresh start). */
  isFreshDay: boolean;
  onLogFreshDaySlot: () => void;
}

function TodayHeroBlockImpl(props: TodayHeroBlockProps) {
  const {
    entranceStyle,
    totals,
    effectiveMacroTargets,
    effectiveCalorieGoal,
    baseGoal,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    cardBackgroundColor,
    borderColor,
    trackColor,
    ringExpanded,
    onToggleExpanded,
    tdeeLearnDays,
    onPressStatusChip,
    onOpenCoach,
    hasActiveFast,
    isToday,
    remaining,
    selectedDate,
    byDay,
    logConfirmBump,
    isFreshDay,
    onLogFreshDaySlot,
  } = props;

  const coachScreenEnabled = isFeatureEnabled("coach_screen_v1");
  const heroCoachLine =
    !hasActiveFast && isToday && remaining > 0 ? (
      <TodayDeficitInsight
        remaining={remaining}
        selectedDate={selectedDate}
        byDay={byDay}
        onPress={coachScreenEnabled ? onOpenCoach : undefined}
      />
    ) : null;

  return (
    <ReAnimated.View style={entranceStyle}>
      <TodayHero
        consumed={totals.calories}
        goal={effectiveCalorieGoal}
        baseGoal={baseGoal}
        textColor={textColor}
        textSecondaryColor={textSecondaryColor}
        textTertiaryColor={textTertiaryColor}
        cardBackgroundColor={cardBackgroundColor}
        borderColor={borderColor}
        trackColor={trackColor}
        proteinPct={effectiveMacroTargets.protein > 0 ? Math.min(totals.protein / effectiveMacroTargets.protein, 1) : 0}
        carbsPct={effectiveMacroTargets.carbs > 0 ? Math.min(totals.carbs / effectiveMacroTargets.carbs, 1) : 0}
        fatPct={effectiveMacroTargets.fat > 0 ? Math.min(totals.fat / effectiveMacroTargets.fat, 1) : 0}
        expanded={ringExpanded}
        onToggleExpanded={onToggleExpanded}
        isOnTrack={
          totals.calories > 100 &&
          effectiveCalorieGoal > 0 &&
          Math.abs(totals.calories - effectiveCalorieGoal) / effectiveCalorieGoal <= 0.1
        }
        tdeeLearnDays={tdeeLearnDays}
        onPressStatusChip={onPressStatusChip}
        onPressCoach={coachScreenEnabled ? onOpenCoach : undefined}
        coachLine={heroCoachLine ?? undefined}
        logConfirmBump={logConfirmBump}
        isFreshDay={isFreshDay}
        onLogFreshDaySlot={onLogFreshDaySlot}
      />
    </ReAnimated.View>
  );
}

export const TodayHeroBlock = memo(TodayHeroBlockImpl);

export default TodayHeroBlock;
