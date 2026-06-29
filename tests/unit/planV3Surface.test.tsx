// @vitest-environment jsdom
/**
 * PlanV3Surface (ENG-1225 Block 2/3) — WEB parity twin of the assembled v3 Plan
 * top section. Pins that the header + week strip + day-detail render from a real
 * week plan, the selected day defaults to today, tapping a day re-targets the
 * detail band, the shopping tool row restores access, the "All" filter lists the
 * selected day's slots, and a specific slot switches to the across-week view.
 * Mirrors `apps/mobile/tests/unit/planV3Surface.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanV3Surface } from "../../src/app/components/plan/PlanV3Surface";
import type { DayPlan, DayPlanMeal } from "../../src/types/recipe";

void React;

const m = (calories: number, placeholder = false): DayPlanMeal => ({
  name: "Meal",
  recipeTitle: "Meal",
  calories,
  protein: 30,
  carbs: 40,
  fat: 15,
  isPlaceholder: placeholder,
});

const fullDay = (cals: number, p: number, c: number, f: number): DayPlan => ({
  day: 0,
  meals: [m(cals * 0.3), m(cals * 0.35), m(cals * 0.35)],
  totals: { calories: cals, protein: p, carbs: c, fat: f },
});
const emptyDay = (): DayPlan => ({
  day: 0,
  meals: [m(0, true), m(0, true), m(0, true)],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

// Week of Mon 15 Jun 2026 → Sun 21 Jun; today = Thu 18 (index 3).
const weekDates = Array.from(
  { length: 7 },
  (_, i) => new Date(2026, 5, 15 + i),
);
const today = new Date(2026, 5, 18);
const plan: DayPlan[] = [
  fullDay(1800, 120, 150, 55),
  fullDay(1820, 121, 151, 56),
  emptyDay(),
  fullDay(1490, 99, 121, 42), // Thu 18 — selected by default
  fullDay(1810, 120, 150, 55),
  emptyDay(),
  emptyDay(),
];

const baseProps = {
  plan,
  targetKcal: 1830,
  weekDates,
  weekLabel: "15–21 June",
  verdict: {
    daysHit: 4,
    total: 7,
    headline: "On track — 4 of 7 days land",
    subline: "3 days need a meal or swap",
    tone: "warning" as const,
  },
  household: null,
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
  onOpenHousehold: () => {},
  onOpenMeal: () => {},
  onAddToSlot: () => {},
  shoppingItemCount: 17,
  servingCount: 2,
  onOpenShopping: () => {},
  onOpenBatchCook: () => {},
  batchCookSubtitle: "Cook once · scale shopping",
  today,
};

describe("PlanV3Surface (web)", () => {
  it("renders the header, verdict, and 7-day strip", () => {
    const { getByText, getByLabelText } = render(<PlanV3Surface {...baseProps} />);
    expect(getByText("Your plan")).not.toBeNull();
    expect(getByText("On track — 4 of 7 days land")).not.toBeNull();
    // Mon 15 … Sun 21
    expect(getByLabelText("M 15")).not.toBeNull();
    expect(getByLabelText("S 21")).not.toBeNull();
  });

  it("defaults the day-detail to today (Thu 18) with its real totals", () => {
    const { getByText } = render(<PlanV3Surface {...baseProps} />);
    expect(getByText("Thursday 18")).not.toBeNull();
    expect(getByText("1,490")).not.toBeNull();
    expect(getByText("≈340 kcal short — room for more")).not.toBeNull();
  });

  it("re-targets the detail band when another day is tapped", () => {
    const { getByText, getByLabelText } = render(<PlanV3Surface {...baseProps} />);
    fireEvent.click(getByLabelText("W 17")); // empty day, index 2
    expect(getByText("Wednesday 17")).not.toBeNull();
    expect(getByText("Nothing planned yet")).not.toBeNull();
  });

  it("renders the shopping-list tool row (restored access) with item count", () => {
    const onOpenShopping = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanV3Surface {...baseProps} onOpenShopping={onOpenShopping} />,
    );
    expect(getByText("Shopping list")).not.toBeNull();
    expect(getByText("17 items · for 2")).not.toBeNull();
    fireEvent.click(getByLabelText("Shopping list, 17 items · for 2"));
    expect(onOpenShopping).toHaveBeenCalledTimes(1);
  });

  it("lists the selected day's slots under the default 'All' filter", () => {
    const { getByLabelText, getByText } = render(<PlanV3Surface {...baseProps} />);
    // Thu 18 (fullDay) has 3 filled slots; the 4th (Snacks) is missing → empty.
    expect(getByLabelText("Breakfast: Meal")).not.toBeNull();
    expect(getByLabelText("Dinner: Meal")).not.toBeNull();
    expect(getByText("Add snacks")).not.toBeNull();
  });

  it("switches to the across-week view when a specific slot is filtered", () => {
    const { getByLabelText, getByText, getAllByText, queryByText } = render(
      <PlanV3Surface {...baseProps} />,
    );
    fireEvent.click(getByLabelText("Dinner")); // the filter chip
    // Across-week → every day's dinner under a day header.
    expect(getByText("Monday 15")).not.toBeNull();
    expect(getByText("Sunday 21")).not.toBeNull();
    // The 3 empty days (Wed 17, Sat 20, Sun 21) → "Add dinner" rows.
    expect(getAllByText("Add dinner")).toHaveLength(3);
    // "Add snacks" only exists in the All view → gone now.
    expect(queryByText("Add snacks")).toBeNull();
  });
});
