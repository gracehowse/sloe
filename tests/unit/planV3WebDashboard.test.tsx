// @vitest-environment jsdom
/**
 * Render test for `<PlanV3WebDashboard>` (web, ENG-1225 gap #13) — the desktop
 * two-column Plan. Pins: the whole week stacks (all 7 day headers + their meal
 * cards), empty slots offer "+ Add", the week-health stat strip derives from the
 * real plan, and the right rail's insight + shopping copy reflect the actual
 * open-slot / item counts (no fabricated suggestions).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ALL_MEAL_SLOTS } from "../../src/lib/nutrition/mealPlanAlgo";
import { computePlanWeekVerdict } from "../../src/lib/planning/planWeekStatus";
import type { DayPlan, DayPlanMeal } from "../../src/types/recipe";
import { PlanV3WebDashboard } from "../../src/app/components/plan/PlanV3WebDashboard";

void React;

const meal = (name: string, calories: number, opts: Partial<DayPlanMeal> = {}): DayPlanMeal => ({
  name,
  recipeTitle: name,
  calories,
  protein: Math.round(calories * 0.08),
  carbs: Math.round(calories * 0.1),
  fat: Math.round(calories * 0.04),
  ...opts,
});
const placeholder = (slot: string): DayPlanMeal =>
  meal(slot, 0, { recipeTitle: "", isPlaceholder: true });

const fullDay = (day: number): DayPlan => {
  const meals = [meal("Oats", 420), meal("Bowl", 540), meal("Salmon", 610), meal("Apple", 180)];
  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { day, meals, totals };
};
const emptyDay = (day: number): DayPlan => ({
  day,
  meals: ALL_MEAL_SLOTS.map((s) => placeholder(s)),
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

// 5 full days + 2 empty (Sat/Sun) → "2 days still need a meal".
const week: DayPlan[] = [
  fullDay(0),
  fullDay(1),
  fullDay(2),
  fullDay(3),
  fullDay(4),
  emptyDay(5),
  emptyDay(6),
];
const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 15 + i));
const verdict = computePlanWeekVerdict(
  week.map((dp) => dp.meals.map((m, i) => ({ slot: ALL_MEAL_SLOTS[i] ?? "Snacks", kcal: m.calories, empty: m.isPlaceholder }))),
);
const noop = () => {};

const baseProps = {
  plan: week,
  targetKcal: 1830,
  weekDates,
  weekLabel: "15–21 June",
  verdict,
  household: null,
  onGenerate: noop,
  onAdjust: noop,
  onTemplates: noop,
  onOpenHousehold: noop,
  onOpenMeal: noop,
  onAddToSlot: noop,
  shoppingItemCount: 23,
  servingCount: 2,
  onOpenShopping: noop,
};

describe("PlanV3WebDashboard", () => {
  it("stacks the whole week with day headers and meal names", () => {
    render(<PlanV3WebDashboard {...baseProps} />);
    expect(screen.getByText("Your plan")).toBeInTheDocument();
    // All 7 days present (Monday 15 … Sunday 21).
    expect(screen.getByText("Monday 15")).toBeInTheDocument();
    expect(screen.getByText("Sunday 21")).toBeInTheDocument();
    expect(screen.getAllByText("Salmon").length).toBeGreaterThan(0);
  });

  it("derives the week-health stat strip from the plan", () => {
    render(<PlanV3WebDashboard {...baseProps} />);
    expect(screen.getByText("5/7")).toBeInTheDocument(); // 5 planned days
    expect(screen.getByText("Days planned")).toBeInTheDocument();
    expect(screen.getByText("1830")).toBeInTheDocument(); // daily target
  });

  it("surfaces a grounded open-slots insight + live shopping count", () => {
    render(<PlanV3WebDashboard {...baseProps} />);
    expect(screen.getByText("2 days still need a meal")).toBeInTheDocument();
    expect(screen.getByText("Fill the open slots")).toBeInTheDocument();
    expect(screen.getByText(/23 items · for 2 people/)).toBeInTheDocument();
  });

  it("ENG-1547 — an all-empty week renders NO verdict row (law 3: '0 of 7 days land' is derived noise)", () => {
    const allEmpty = Array.from({ length: 7 }, (_, i) => emptyDay(i));
    const emptyVerdict = computePlanWeekVerdict(
      allEmpty.map((dp) =>
        dp.meals.map((m, i) => ({ slot: ALL_MEAL_SLOTS[i] ?? "Snacks", kcal: m.calories, empty: m.isPlaceholder })),
      ),
    );
    render(<PlanV3WebDashboard {...baseProps} plan={allEmpty} verdict={emptyVerdict} />);
    // The verdict headline must not appear on an empty week (desktop parity
    // with mobile PlanV3Surface's gate).
    expect(screen.queryByText(/days land/)).not.toBeInTheDocument();
    // The 0/7 fact still lives in the stat strip alone.
    expect(screen.getByText("0/7")).toBeInTheDocument();
  });

  it("offers + Add on empty slots and fires the add handler", () => {
    const onAddToSlot = vi.fn();
    render(<PlanV3WebDashboard {...baseProps} onAddToSlot={onAddToSlot} />);
    // Saturday (index 5) is empty → its four slots all offer Add.
    expect(screen.getAllByText(/Add breakfast/i).length).toBeGreaterThan(0);
  });

  it("hides the open-slots insight when every slot is filled", () => {
    const fullWeek = Array.from({ length: 7 }, (_, i) => fullDay(i));
    render(<PlanV3WebDashboard {...baseProps} plan={fullWeek} />);
    // No open slots → the "This week" nudge card is gone; the shopping card
    // (single "Open shopping list") carries the next action.
    expect(screen.queryByText("This week")).not.toBeInTheDocument();
    expect(screen.queryByText(/still need/)).not.toBeInTheDocument();
    expect(screen.getByText("Open shopping list")).toBeInTheDocument();
  });
});
