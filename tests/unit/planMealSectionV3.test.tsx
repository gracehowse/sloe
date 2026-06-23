// @vitest-environment jsdom
/**
 * PlanMealSectionV3 (ENG-1225 Block 3) — WEB parity twin. Pins the "All"
 * day-view vs the across-week slot view, the Snack→Snacks slot mapping, and
 * that tapping a filled meal / empty slot fires the right handler with
 * (day, slot). Mirrors `apps/mobile/tests/unit/planMealSectionV3.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanMealSectionV3 } from "../../src/app/components/plan/PlanMealSectionV3";
import type { DayPlan, DayPlanMeal } from "../../src/types/recipe";

void React;

const meal = (name: string, calories: number, placeholder = false): DayPlanMeal => ({
  name,
  recipeTitle: name,
  calories,
  protein: 20,
  carbs: 30,
  fat: 10,
  isPlaceholder: placeholder,
});

// Two days; day 0 has B/L/D/Snacks, day 1 has only breakfast filled.
const plan: DayPlan[] = [
  {
    day: 0,
    meals: [
      meal("Oats", 400),
      meal("Salad", 520),
      meal("Roast", 640),
      meal("Yoghurt", 180),
    ],
    totals: { calories: 1740, protein: 90, carbs: 150, fat: 55 },
  },
  {
    day: 1,
    meals: [meal("Toast", 300), meal("", 0, true), meal("", 0, true)],
    totals: { calories: 300, protein: 15, carbs: 40, fat: 8 },
  },
];
const weekDates = [new Date(2026, 5, 15), new Date(2026, 5, 16)];

describe("PlanMealSectionV3 (web)", () => {
  it("lists the selected day's four slots under the 'All' filter", () => {
    const { getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="All"
        onOpenMeal={() => {}}
        onAddToSlot={() => {}}
      />,
    );
    expect(getByLabelText("Breakfast: Oats")).not.toBeNull();
    expect(getByLabelText("Snacks: Yoghurt")).not.toBeNull();
  });

  it("fires onOpenMeal with (dayIndex, slotIndex) when a meal is tapped", () => {
    const onOpenMeal = vi.fn();
    const { getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="All"
        onOpenMeal={onOpenMeal}
        onAddToSlot={() => {}}
      />,
    );
    fireEvent.click(getByLabelText("Lunch: Salad"));
    expect(onOpenMeal).toHaveBeenCalledWith(0, 1);
  });

  it("maps the Snack filter to the Snacks slot across the week", () => {
    const onAddToSlot = vi.fn();
    const { getByText, getAllByText, getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="Snack"
        onOpenMeal={() => {}}
        onAddToSlot={onAddToSlot}
      />,
    );
    // Day headers for both days.
    expect(getByText("Monday 15")).not.toBeNull();
    expect(getByText("Tuesday 16")).not.toBeNull();
    // Day 0 snacks filled; day 1 has no snacks slot → "Add snack".
    expect(getByLabelText("Snack: Yoghurt")).not.toBeNull();
    fireEvent.click(getAllByText("Add snack")[0]);
    // Snack → slot index 3.
    expect(onAddToSlot).toHaveBeenCalledWith(1, 3);
  });
});
