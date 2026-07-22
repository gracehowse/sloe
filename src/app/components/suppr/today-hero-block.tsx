import * as React from "react";

import { TodayHeroStats } from "./today-hero-stats";
import { TodayDeficitInsight } from "./today-deficit-insight";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

/**
 * TodayHeroBlock (web) — the Today calorie hero: coach-line dispatch +
 * `TodayHeroStats` (daily ring + 4-tile stats; desktop renders stats beside
 * the ring, mobile-web just the ring — canonical copy from
 * `src/lib/copy/today.ts`).
 *
 * Extracted from `NutritionTracker.tsx` (ENG-1653, 2026-07-21) so the pinned
 * legacy host shrinks while gaining the `today_hero_cluster_v3` two-slot
 * render — the block mounts either inside the tight v3 hero cluster (flag
 * on) or at its legacy fragment position (flag off). Mirror of the mobile
 * `apps/mobile/components/today/TodayHeroBlock.tsx`.
 *
 * Composition history from the call site: Phase 4 / Top-5 #2 (2026-04-28)
 * caps Today's above-meals composition at four blocks
 * (`docs/ux/teardown-2026-04-28-daily-loop.md` §F1); the AI-estimated count
 * chip lives inside the hero via `aiSourcedCount`. The deficit coach line
 * renders INSIDE the hero (ENG-1099/ENG-1356); the Coach entry is
 * always-present (ENG-1293) behind the same `coach_screen_v1` gate.
 */
export interface TodayHeroBlockProps {
  totals: { calories: number; protein: number; carbs: number; fat: number };
  effectiveMacroTargets: { protein: number; carbs: number; fat: number };
  effectiveCalorieTarget: number;
  baseCalorieTarget: number | undefined;
  totalBurnKcal: number;
  aiSourcedCount: number;

  ringExpanded: boolean;
  onToggleExpanded: () => void;
  pulse: boolean;
  commitPulse: boolean;
  logConfirmVisible: boolean;

  /** ENG-758 — distinct weigh-in days in the last 7 (host-computed). */
  tdeeLearnDays: number;
  onPressStatusChip: () => void;
  /** Pushes the Coach screen; gated here on `coach_screen_v1`. */
  onOpenCoach: () => void;

  // Coach deficit-line inputs (ENG-1099 — inside the hero when no fast is
  // active, the selected day is today, and there's budget left).
  hasActiveFast: boolean;
  isTodaySelected: boolean;
  selectedDate: Date;
  byDay: React.ComponentProps<typeof TodayDeficitInsight>["byDay"];

  /** ENG-1372 — TODAY with zero logged entries only. */
  isFreshDay: boolean;
  onLogFreshDaySlot: () => void;
}

export function TodayHeroBlock(props: TodayHeroBlockProps) {
  const {
    totals,
    effectiveMacroTargets,
    effectiveCalorieTarget,
    baseCalorieTarget,
    totalBurnKcal,
    aiSourcedCount,
    ringExpanded,
    onToggleExpanded,
    pulse,
    commitPulse,
    logConfirmVisible,
    tdeeLearnDays,
    onPressStatusChip,
    onOpenCoach,
    hasActiveFast,
    isTodaySelected,
    selectedDate,
    byDay,
    isFreshDay,
    onLogFreshDaySlot,
  } = props;

  const remainingToday = Math.max(0, effectiveCalorieTarget - totals.calories);
  const coachScreenEnabled = isFeatureEnabled("coach_screen_v1");
  const coachLineEl =
    !hasActiveFast && isTodaySelected && remainingToday > 0 ? (
      <TodayDeficitInsight
        remaining={remainingToday}
        selectedDate={selectedDate}
        byDay={byDay}
        onPress={coachScreenEnabled ? onOpenCoach : undefined}
      />
    ) : null;

  return (
    <TodayHeroStats
      loggedKcal={Math.round(totals.calories)}
      targetKcal={Math.round(effectiveCalorieTarget)}
      burnedKcal={Math.round(totalBurnKcal)}
      aiSourcedCount={aiSourcedCount}
      consumed={totals.calories}
      target={effectiveCalorieTarget}
      baseGoal={baseCalorieTarget}
      proteinPct={effectiveMacroTargets.protein > 0 ? Math.min(totals.protein / effectiveMacroTargets.protein, 1) : 0}
      carbsPct={effectiveMacroTargets.carbs > 0 ? Math.min(totals.carbs / effectiveMacroTargets.carbs, 1) : 0}
      fatPct={effectiveMacroTargets.fat > 0 ? Math.min(totals.fat / effectiveMacroTargets.fat, 1) : 0}
      proteinGrams={{ current: totals.protein, target: effectiveMacroTargets.protein }}
      carbsGrams={{ current: totals.carbs, target: effectiveMacroTargets.carbs }}
      fatGrams={{ current: totals.fat, target: effectiveMacroTargets.fat }}
      expanded={ringExpanded}
      onToggleExpanded={onToggleExpanded}
      pulse={pulse}
      commitPulse={commitPulse}
      logConfirmVisible={logConfirmVisible}
      isOnTrack={
        totals.calories > 100 &&
        effectiveCalorieTarget > 0 &&
        Math.abs(totals.calories - effectiveCalorieTarget) / effectiveCalorieTarget <= 0.1
      }
      tdeeLearnDays={tdeeLearnDays}
      onPressStatusChip={onPressStatusChip}
      onPressCoach={coachScreenEnabled ? onOpenCoach : undefined}
      coachLine={coachLineEl}
      isFreshDay={isFreshDay}
      onLogFreshDaySlot={onLogFreshDaySlot}
    />
  );
}

export default TodayHeroBlock;
