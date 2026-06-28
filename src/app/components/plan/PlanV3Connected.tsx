"use client";

import * as React from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import { planCalendarDateForIndex } from "@/lib/planning/planDayLabel";
import { computePlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import type { DayPlan } from "@/types/recipe";
import { PlanV3Surface } from "./PlanV3Surface";
import { PlanV3WebDashboard } from "./PlanV3WebDashboard";

/**
 * PlanV3Connected — adapts the web `MealPlanner` host's raw plan data + handlers
 * into the props the Plan v3 surfaces expect (ENG-1225 web parity). Lifted out
 * of the pinned `MealPlanner.tsx` so the host only flag-gates + passes a handful
 * of values: this wrapper owns the week-date/verdict derivation and the
 * meal-tap → swap routing, exactly mirroring the mobile planner's `PlanV3Surface`
 * wiring. Behind `sloe_v3_plan`.
 *
 * Responsive (ENG-1225 gap #13): below `lg` it's the phone-width single column
 * ({@link PlanV3Surface}, the day-selector design — what mobile-web should match
 * the app on); at `lg+` it switches to the desktop two-column dashboard
 * ({@link PlanV3WebDashboard}, the prototype `WebPlan`) so a wide screen isn't a
 * lone 448px column.
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
  /** Open the swap picker for (dayIndex, slotIndex) — powers add-to-slot. */
  onSwapSlot: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — open recipe detail from a populated v3 card tap. */
  onOpenMeal: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — per-meal action sheet. */
  onOpenMealOptions: (dayIndex: number, slotIndex: number) => void;
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
  onOpenMeal,
  onOpenMealOptions,
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

  return (
    <>
      {/* Below lg: the phone-width single column (mobile-web matches the app). */}
      <div className="mx-auto w-full max-w-md lg:hidden">
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
          onOpenMeal={onOpenMeal}
          onAddToSlot={onSwapSlot}
          onOpenMealOptions={onOpenMealOptions}
          shoppingItemCount={shoppingItemCount}
          servingCount={servingCount}
          onOpenShopping={onOpenShopping}
        />
      </div>
      {/* lg+: the desktop two-column dashboard (prototype WebPlan). */}
      <div className="hidden lg:block">
        <PlanV3WebDashboard
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
          onOpenMeal={onOpenMeal}
          onAddToSlot={onSwapSlot}
          onOpenMealOptions={onOpenMealOptions}
          shoppingItemCount={shoppingItemCount}
          servingCount={servingCount}
          onOpenShopping={onOpenShopping}
        />
      </div>
    </>
  );
}

export default PlanV3Connected;
