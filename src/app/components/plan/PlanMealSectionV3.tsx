"use client";

import * as React from "react";

import type { PlanJournalByDay } from "@/lib/planning/planCookedMeals";
import {
  isPlanMealCooked,
  journalEntriesForPlanDate,
} from "@/lib/planning/planCookedMeals";
import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import type { DayPlan } from "@/types/recipe";
import { PlanMealCardV3 } from "./PlanMealCardV3";
import { PlanEmptySlotV3 } from "./PlanEmptySlotV3";
import type { PlanMealFilter } from "./PlanMealFilterChipsV3";

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Map a meal-filter chip to its `ALL_MEAL_SLOTS` index ("Snack" → "Snacks"). */
function filterSlotIndex(filter: Exclude<PlanMealFilter, "All">): number {
  const slot = filter === "Snack" ? "Snacks" : filter;
  const i = ALL_MEAL_SLOTS.indexOf(slot);
  return i >= 0 ? i : 0;
}

/**
 * PlanMealSectionV3 — Sloe v3 Plan meal body.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanMealSectionV3.tsx`. With
 * the "All" filter it lists the selected day's four slots (prototype
 * `plan-card` / `plan-empty`); with a specific slot filter it switches to the
 * across-week view — that slot for every day Mon–Sun, each under a day header
 * (prototype `plan-mealfilter` ~L4745). Snack→Snacks slot mapping. Behind
 * sloe_v3_plan.
 */
export interface PlanMealSectionV3Props {
  plan: DayPlan[] | null;
  /** Index of the day the strip has selected (used for the "All" view). */
  selectedDayIndex: number;
  /** One Date per plan day (across-week day headers). */
  weekDates: Date[];
  filter: PlanMealFilter;
  onOpenMeal: (dayIndex: number, slotIndex: number) => void;
  onAddToSlot: (dayIndex: number, slotIndex: number) => void;
  /** Diary rows keyed by date_key — powers cooked strike-through. */
  nutritionByDay?: PlanJournalByDay;
}

export function PlanMealSectionV3({
  plan,
  selectedDayIndex,
  weekDates,
  filter,
  onOpenMeal,
  onAddToSlot,
  nutritionByDay,
}: PlanMealSectionV3Props) {
  const renderSlot = (
    dayIndex: number,
    slotIndex: number,
    slotLabel: string,
  ) => {
    const meal = plan?.[dayIndex]?.meals[slotIndex];
    const date = weekDates[dayIndex];
    const logged = date ? journalEntriesForPlanDate(nutritionByDay, date) : [];
    if (meal && !meal.isPlaceholder) {
      const cooked = isPlanMealCooked(
        {
          recipeId: meal.recipeId,
          recipeTitle: meal.recipeTitle || meal.name,
          isPlaceholder: meal.isPlaceholder,
        },
        logged,
      );
      return (
        <PlanMealCardV3
          slot={slotLabel}
          name={meal.recipeTitle || meal.name}
          kcal={Math.round(meal.calories)}
          isLocked={meal.isLocked}
          isCooked={cooked}
          onPress={() => onOpenMeal(dayIndex, slotIndex)}
        />
      );
    }
    return (
      <PlanEmptySlotV3
        slot={slotLabel}
        onPress={() => onAddToSlot(dayIndex, slotIndex)}
      />
    );
  };

  if (filter === "All") {
    return (
      <div className="mt-1">
        {ALL_MEAL_SLOTS.map((slot, j) => (
          <div key={slot}>{renderSlot(selectedDayIndex, j, slot)}</div>
        ))}
      </div>
    );
  }

  const slotIndex = filterSlotIndex(filter);
  return (
    <div className="mt-1">
      {weekDates.map((date, i) => (
        <div key={i} className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground-tertiary">
            {WEEKDAY_LONG[date.getDay()] ?? "Day"} {date.getDate()}
          </p>
          {renderSlot(i, slotIndex, filter)}
        </div>
      ))}
    </div>
  );
}

export default PlanMealSectionV3;
