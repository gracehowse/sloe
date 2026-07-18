"use client";

import * as React from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import {
  computePlanDayStatus,
  isPlanWeekEmpty,
  type PlanWeekVerdict,
} from "@/lib/planning/planWeekStatus";
import {
  countPlanDayCookedMeals,
  journalEntriesForPlanDate,
  type PlanJournalByDay,
} from "@/lib/planning/planCookedMeals";
import type { DayPlan } from "@/types/recipe";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { PlanHeaderV3 } from "./PlanHeaderV3";
import { PlanWeekStripV3, type PlanWeekStripDay } from "./PlanWeekStripV3";
import { PlanDayDetailBandV3 } from "./PlanDayDetailBandV3";
import { PlanEmptyWeekCard } from "./PlanEmptyWeekCard";
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdBannerV3Props,
} from "./PlanHouseholdBannerV3";
import {
  PlanMealFilterChipsV3,
  type PlanMealFilter,
} from "./PlanMealFilterChipsV3";
import { PlanMealSectionV3 } from "./PlanMealSectionV3";
import { PlanToolsV3 } from "./PlanToolsV3";

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * PlanV3Surface — the Sloe v3 Plan surface (ENG-1225 Blocks 2–3).
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanV3Surface.tsx`: header +
 * verdict, week-strip day selector, optional household banner, the selected
 * day's calorie-band detail, the meal-filter chips, and the meal body (per-day
 * slots under "All", across-week list under a specific slot). Composed from the
 * Plan v3 components; the host (MealPlanner.tsx) passes the real week plan +
 * targets + dates + meal handlers so this stays a thin integration. Behind the
 * `sloe_v3_plan` flag (host-gated).
 */
export interface PlanV3SurfaceProps {
  /** The week plan (one entry per day), or null before a plan exists. */
  plan: DayPlan[] | null;
  /** Daily calorie target (planTargets.calories). */
  targetKcal: number;
  /** One Date per plan day (host-computed via the plan calendar anchor). */
  weekDates: Date[];
  /** "16–22 June" overline. */
  weekLabel: string;
  /** Completeness verdict (computePlanWeekVerdict), or null. */
  verdict: PlanWeekVerdict | null;
  /** Household banner data, or null to hide it (solo / data unavailable). */
  household: Omit<PlanHouseholdBannerV3Props, "onPress"> | null;
  onGenerate: () => void;
  onAdjust: () => void;
  onTemplates: () => void;
  onOpenHousehold: () => void;
  /** Open an existing meal (day index + slot index into ALL_MEAL_SLOTS). */
  onOpenMeal: (dayIndex: number, slotIndex: number) => void;
  /** Add a meal to an empty slot (day index + slot index). */
  onAddToSlot: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — per-meal action menu trigger. */
  onOpenMealOptions?: (dayIndex: number, slotIndex: number) => void;
  /** Shopping-list item count (for the foot tool row). */
  shoppingItemCount: number;
  /** Household serving count (for the foot tool row). */
  servingCount: number;
  /** Open the shopping list (restores the access the legacy chrome carried). */
  onOpenShopping: () => void;
  onOpenBatchCook: () => void;
  batchCookSubtitle: string;
  /** Today (for the week-strip highlight) — injected for deterministic tests. */
  today?: Date;
  /** Diary rows keyed by date_key — powers cooked tally + strike-through. */
  nutritionByDay?: PlanJournalByDay;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PlanV3Surface({
  plan,
  targetKcal,
  weekDates,
  weekLabel,
  verdict,
  household,
  onGenerate,
  onAdjust,
  onTemplates,
  onOpenHousehold,
  onOpenMeal,
  onAddToSlot,
  onOpenMealOptions,
  shoppingItemCount,
  servingCount,
  onOpenShopping,
  onOpenBatchCook,
  batchCookSubtitle,
  today,
  nutritionByDay,
}: PlanV3SurfaceProps) {
  const [mealFilter, setMealFilter] = React.useState<PlanMealFilter>("All");
  // Default the selected day to today (when it falls in the week), else day 0.
  const todayIndex = React.useMemo(() => {
    const t = today ?? new Date();
    const i = weekDates.findIndex((d) => isSameDay(d, t));
    return i >= 0 ? i : 0;
  }, [weekDates, today]);
  // `null` until the user taps a day — until then the selection FOLLOWS today
  // (todayIndex is recomputed once planStartDate loads, so we can't snapshot it
  // into useState or it sticks on day 0; mirrors mobile's Block 2 sim fix).
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const effectiveIndex = selectedIndex ?? todayIndex;
  const safeIndex = Math.min(effectiveIndex, Math.max(weekDates.length - 1, 0));

  const days: PlanWeekStripDay[] = React.useMemo(
    () =>
      weekDates.map((date, i) => {
        const meals = plan?.[i]?.meals ?? [];
        const status = computePlanDayStatus(
          meals.map((m, j) => ({
            slot: ALL_MEAL_SLOTS[j] ?? "Snacks",
            kcal: m.calories,
            empty: m.isPlaceholder,
          })),
        );
        return {
          key: String(i),
          dayLetter: WEEKDAY_LETTER[date.getDay()] ?? "?",
          dateNum: date.getDate(),
          status,
          isToday: today ? isSameDay(date, today) : i === todayIndex,
        };
      }),
    [weekDates, plan, today, todayIndex],
  );

  // ENG-1372 (empty-state grammar, Plan empty-week) — behind
  // `empty_state_grammar_v1`: a week with ZERO real meals in any slot
  // replaces the derived week dashboard with one invitation card. The day
  // strip, filter chips, dashed slots, and tool rail stay mounted only after
  // the person explicitly chooses "add meals as you go".
  const emptyStateGrammarOn = isFeatureEnabled("empty_state_grammar_v1");
  const weekIsEmpty =
    emptyStateGrammarOn &&
    isPlanWeekEmpty(
      (plan ?? []).map((dp) =>
        dp.meals.map((m, j) => ({
          slot: ALL_MEAL_SLOTS[j] ?? "Snacks",
          kcal: m.calories,
          empty: m.isPlaceholder,
        })),
      ),
    );
  // "or add meals as you go" dismisses the invitation FOR THIS SESSION,
  // revealing the day-detail band + per-slot dashed rows underneath — the
  // ghost path promises exactly that, not a second generate flow. Resets
  // automatically once a meal lands (weekIsEmpty flips false on its own).
  const [emptyWeekCardDismissed, setEmptyWeekCardDismissed] = React.useState(false);
  const showEmptyWeekCard = weekIsEmpty && !emptyWeekCardDismissed;

  const selectedDay = plan?.[safeIndex] ?? null;
  const selectedDate = weekDates[safeIndex];
  const dayLabel = selectedDate
    ? `${WEEKDAY_LONG[selectedDate.getDay()] ?? "Day"} ${selectedDate.getDate()}`
    : "";
  const plannedCount =
    selectedDay?.meals.filter((m) => !m.isPlaceholder).length ?? 0;
  const totals = selectedDay?.totals;
  const cookedCount = React.useMemo(() => {
    if (!selectedDay || !selectedDate) return 0;
    const logged = journalEntriesForPlanDate(nutritionByDay, selectedDate);
    return countPlanDayCookedMeals(
      selectedDay.meals.map((m) => ({
        recipeId: m.recipeId,
        recipeTitle: m.recipeTitle || m.name,
        isPlaceholder: m.isPlaceholder,
      })),
      logged,
    );
  }, [selectedDay, selectedDate, nutritionByDay]);

  return (
    <>
      <PlanHeaderV3
        dateRangeLabel={weekLabel}
        // ENG-1372 law 3 — no verdict/dot/jargon ("0 of 7 days on target") until
        // ≥1 meal exists; the empty-week card carries the invitation instead.
        verdict={showEmptyWeekCard ? null : verdict}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
      />
      {showEmptyWeekCard ? (
        <PlanEmptyWeekCard
          onGenerate={onGenerate}
          onAddMealsAsYouGo={() => setEmptyWeekCardDismissed(true)}
        />
      ) : (
        <>
          <PlanWeekStripV3
            days={days}
            selectedKey={String(safeIndex)}
            onSelectDay={(key) => setSelectedIndex(Number(key))}
          />
          {household ? (
            <PlanHouseholdBannerV3 {...household} onPress={onOpenHousehold} />
          ) : null}
          <PlanDayDetailBandV3
            dayLabel={dayLabel}
            dayTotalKcal={Math.round(totals?.calories ?? 0)}
            targetKcal={targetKcal}
            plannedCount={plannedCount}
            cookedCount={cookedCount}
            macros={
              totals
                ? {
                    protein: totals.protein,
                    carbs: totals.carbs,
                    fat: totals.fat,
                  }
                : null
            }
          />
          <PlanMealFilterChipsV3 selected={mealFilter} onSelect={setMealFilter} />
          <PlanMealSectionV3
            plan={plan}
            selectedDayIndex={safeIndex}
            weekDates={weekDates}
            filter={mealFilter}
            onOpenMeal={onOpenMeal}
            onAddToSlot={onAddToSlot}
            onOpenMealOptions={onOpenMealOptions}
            nutritionByDay={nutritionByDay}
          />
          <PlanToolsV3
            batchCookSubtitle={batchCookSubtitle}
            shoppingItemCount={shoppingItemCount}
            servingCount={servingCount}
            onOpenBatchCook={onOpenBatchCook}
            onOpenShopping={onOpenShopping}
          />
        </>
      )}
    </>
  );
}

export default PlanV3Surface;
