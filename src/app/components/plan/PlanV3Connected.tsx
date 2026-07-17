"use client";

import * as React from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import { resolvePlanWeekAnchor } from "@/lib/mealPlan/planCalendarAnchor";
import { computePlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import type { DayPlan } from "@/types/recipe";
import type { HouseholdBannerData } from "../../../hooks/useHouseholdBanner";
import type { PlanJournalByDay } from "@/lib/planning/planCookedMeals";
import { PlanV3Surface } from "./PlanV3Surface";
import { PlanV3WebDashboard } from "./PlanV3WebDashboard";
import { defaultBatchCookToolSubtitle } from "@/lib/planning/batchCook";
import {
  usePlanV3MealActions,
  type UsePlanV3MealActionsArgs,
} from "./usePlanV3MealActions.tsx";

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
  /** Plan start offset (0 today / 1 tomorrow / 7 next week) — prospective anchor for EMPTY plans. */
  startOffset: number;
  /** ENG-1491 — persisted `meal_plan_days.start_date`; anchors the header week
   *  while the plan has real meals (mobile ENG-1480 contract). */
  planStartDate: string | null;
  onGenerate: () => void;
  isGenerating?: boolean;
  onAdjust: () => void;
  /** Open the swap picker for (dayIndex, slotIndex) — powers add-to-slot. */
  onSwapSlot: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — open recipe detail from a populated v3 card tap. Defaults to onSwapSlot. */
  onOpenMeal?: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — per-meal action sheet. */
  onOpenMealOptions?: (dayIndex: number, slotIndex: number) => void;
  onTemplates?: () => void;
  onOpenHousehold?: () => void;
  onOpenBatchCook?: () => void;
  batchCookSubtitle?: string;
  onOpenShopping: () => void;
  shoppingItemCount?: number;
  servingCount?: number;
  /** ENG-1247 — "Cooking for N · names" household banner; null hides it. */
  household?: HouseholdBannerData | null;
  /** Diary rows keyed by date_key — plan cooked strike-through. */
  nutritionByDay?: PlanJournalByDay;
  /** ENG-1238 — when set, wires the per-meal action sheet inside this wrapper. */
  mealActionDeps?: Omit<UsePlanV3MealActionsArgs, "plan">;
}

type PlanV3ConnectedBodyProps = PlanV3ConnectedProps & {
  openMeal: (dayIndex: number, slotIndex: number) => void;
  openMealOptions?: (dayIndex: number, slotIndex: number) => void;
  mealActionDialog?: React.ReactNode;
};

function PlanV3ConnectedBody({
  plan,
  targetCalories,
  startOffset,
  planStartDate,
  onGenerate,
  isGenerating = false,
  onAdjust,
  onTemplates,
  onOpenHousehold,
  onOpenShopping,
  onOpenBatchCook,
  onSwapSlot,
  openMeal,
  openMealOptions,
  shoppingItemCount = 0,
  servingCount = 1,
  batchCookSubtitle = defaultBatchCookToolSubtitle(),
  household = null,
  nutritionByDay,
  mealActionDialog,
}: PlanV3ConnectedBodyProps) {
  const templates = onTemplates ?? onAdjust;
  const openHousehold = onOpenHousehold ?? onAdjust;
  const openBatchCook = onOpenBatchCook ?? (() => {});
  // ENG-1491 (mirrors mobile ENG-1480 `usePlanV3WeekAnchor`): the header week
  // derives from ONE gated anchor — the persisted `start_date` while the plan
  // has real meals; the prospective chip week otherwise. `startOffset` alone
  // mislabelled real saved plans as rolling-from-today (it resets on load).
  const planHasRealMeals = React.useMemo(
    () => plan.some((dp) => dp.meals.some((m) => !m.isPlaceholder && !!m.recipeTitle)),
    [plan],
  );
  const weekDates = React.useMemo(() => {
    const anchor = resolvePlanWeekAnchor({ planHasRealMeals, planStartDate, startOffset });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      return d;
    });
  }, [planHasRealMeals, planStartDate, startOffset]);

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
          household={household}
          onGenerate={onGenerate}
          onAdjust={onAdjust}
          onTemplates={templates}
          onOpenHousehold={openHousehold}
          onOpenMeal={openMeal}
          onAddToSlot={onSwapSlot}
          onOpenMealOptions={openMealOptions}
          shoppingItemCount={shoppingItemCount}
          servingCount={servingCount}
          onOpenShopping={onOpenShopping}
          onOpenBatchCook={openBatchCook}
          batchCookSubtitle={batchCookSubtitle}
          nutritionByDay={nutritionByDay}
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
          household={household}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          onAdjust={onAdjust}
          onTemplates={templates}
          onOpenHousehold={openHousehold}
          onOpenMeal={openMeal}
          onAddToSlot={onSwapSlot}
          onOpenMealOptions={openMealOptions}
          shoppingItemCount={shoppingItemCount}
          servingCount={servingCount}
          onOpenShopping={onOpenShopping}
          onOpenBatchCook={openBatchCook}
          batchCookSubtitle={batchCookSubtitle}
          nutritionByDay={nutritionByDay}
        />
      </div>
      {mealActionDialog}
    </>
  );
}

function PlanV3ConnectedWithMealActions(
  props: PlanV3ConnectedProps & {
    mealActionDeps: Omit<UsePlanV3MealActionsArgs, "plan">;
  },
) {
  const { mealActionDeps, ...rest } = props;
  const mealActions = usePlanV3MealActions({
    plan: props.plan,
    ...mealActionDeps,
  });
  return (
    <PlanV3ConnectedBody
      {...rest}
      openMeal={mealActions.openV3Meal}
      openMealOptions={mealActions.openV3MealOptions}
      mealActionDialog={mealActions.mealActionDialog}
    />
  );
}

export function PlanV3Connected(props: PlanV3ConnectedProps) {
  if (props.mealActionDeps) {
    return <PlanV3ConnectedWithMealActions {...props} mealActionDeps={props.mealActionDeps} />;
  }
  const { onOpenMeal, onOpenMealOptions, onSwapSlot, ...rest } = props;
  return (
    <PlanV3ConnectedBody
      {...rest}
      onSwapSlot={onSwapSlot}
      openMeal={onOpenMeal ?? onSwapSlot}
      openMealOptions={onOpenMealOptions}
    />
  );
}

export default PlanV3Connected;
