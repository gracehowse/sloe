"use client";

import * as React from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import { planCalendarDateForIndex } from "@/lib/planning/planDayLabel";
import { computePlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import type { DayPlan } from "@/types/recipe";
import { PlanV3Surface } from "./PlanV3Surface";

/**
 * PlanV3Connected — adapts the web `MealPlanner` host's raw plan data + handlers
 * into the props {@link PlanV3Surface} expects (ENG-1225 web parity). Lifted out
 * of the pinned `MealPlanner.tsx` so the host only flag-gates + passes a handful
 * of values: this wrapper owns the week-date/verdict derivation and the
 * meal-tap → swap routing, exactly mirroring the mobile planner's `PlanV3Surface`
 * wiring. Behind `sloe_v3_plan`.
 */
export interface PlanV3ConnectedProps {
  /** The week plan (web `DayPlan[]`). */
  plan: DayPlan[];
  /** Daily calorie target. */
  targetCalories: number;
  /** Plan start offset (0 today / 1 tomorrow / 7 next week) — the date anchor. */
  startOffset: number;
  onGenerate: () => void;
  onAdjust: () => void;
  onOpenShopping: () => void;
  /** Open the swap picker for (dayIndex, slotIndex) — powers open + add. */
  onSwapSlot: (dayIndex: number, slotIndex: number) => void;
  shoppingItemCount?: number;
  servingCount?: number;
}

export function PlanV3Connected({
  plan,
  targetCalories,
  startOffset,
  onGenerate,
  onAdjust,
  onOpenShopping,
  onSwapSlot,
  shoppingItemCount = 0,
  servingCount = 1,
}: PlanV3ConnectedProps) {
  const weekDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => planCalendarDateForIndex(i, startOffset)),
    [startOffset],
  );

  const weekLabel = React.useMemo(() => {
    const start = weekDates[0] ?? new Date();
    const end = weekDates[6] ?? start;
    const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${mon(start)}`
      : `${start.getDate()} ${mon(start)} – ${end.getDate()} ${mon(end)}`;
  }, [weekDates]);

  const verdict = React.useMemo(
    () =>
      computePlanWeekVerdict(
        plan.map((dp) =>
          dp.meals.map((m, i) => ({
            slot: ALL_MEAL_SLOTS[i] ?? "Snacks",
            kcal: m.calories,
            empty: m.isPlaceholder,
          })),
        ),
      ),
    [plan],
  );

  // The v3 Plan is a phone-width single column. Centre it (mobile-web fills the
  // screen; desktop centres ~448px) so it stays coherent at any width until the
  // separate desktop v3 dashboard (prototype `w-aisle`) lands. ENG-1225.
  return (
    <div className="mx-auto w-full max-w-md">
      <PlanV3Surface
      plan={plan}
      targetKcal={targetCalories}
      weekDates={weekDates}
      weekLabel={weekLabel}
      verdict={verdict}
      household={null}
      onGenerate={onGenerate}
      onAdjust={onAdjust}
      onTemplates={onAdjust}
      onOpenHousehold={onAdjust}
      onOpenMeal={onSwapSlot}
      onAddToSlot={onSwapSlot}
      shoppingItemCount={shoppingItemCount}
      servingCount={servingCount}
      onOpenShopping={onOpenShopping}
      />
    </div>
  );
}

export default PlanV3Connected;
