// @vitest-environment jsdom
/**
 * Render test for `<PlanV3WebDashboard>` (web, ENG-1225 gap #13) — the desktop
 * two-column Plan. Pins: the whole week stacks (all 7 day headers + their meal
 * cards), empty slots offer "+ Add", the week-health stat strip derives from the
 * real plan, and the right rail's insight + shopping copy reflect the actual
 * open-slot / item counts (no fabricated suggestions).
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ALL_MEAL_SLOTS } from "../../src/lib/nutrition/mealPlanAlgo";
import { computePlanWeekVerdict } from "../../src/lib/planning/planWeekStatus";
import type { DayPlan, DayPlanMeal } from "../../src/types/recipe";
import { PlanV3WebDashboard } from "../../src/app/components/plan/PlanV3WebDashboard";

void React;

const meal = (
  name: string,
  calories: number,
  opts: Partial<DayPlanMeal> = {},
): DayPlanMeal => ({
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
  const meals = [
    meal("Oats", 420),
    meal("Bowl", 540),
    meal("Salmon", 610),
    meal("Apple", 180),
  ];
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
const weekDates = Array.from(
  { length: 7 },
  (_, i) => new Date(2026, 5, 15 + i),
);
const verdict = computePlanWeekVerdict(
  week.map((dp) =>
    dp.meals.map((m, i) => ({
      slot: ALL_MEAL_SLOTS[i] ?? "Snacks",
      kcal: m.calories,
      empty: m.isPlaceholder,
    })),
  ),
);
const noop = () => {};

function forceEmptyGrammar(value: boolean): void {
  (
    window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }
  ).__SUPPR_FORCE_FLAGS__ = {
    empty_state_grammar_v1: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> })
    .__SUPPR_FORCE_FLAGS__;
});

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
    expect(screen.getByText("1,830")).toBeInTheDocument(); // daily target (ENG-1533 — comma-formatted)
  });

  it("surfaces a grounded open-slots insight + live shopping count", () => {
    render(<PlanV3WebDashboard {...baseProps} />);
    expect(screen.getByText("2 days still need a meal")).toBeInTheDocument();
    expect(screen.getByText("Fill the open slots")).toBeInTheDocument();
    expect(screen.getByText(/23 items · for 2 people/)).toBeInTheDocument();
  });

  it("ENG-1551 — the tool-card CTAs are content-width pills, not banner-width", () => {
    render(<PlanV3WebDashboard {...baseProps} />);
    for (const label of ["Plan a batch", "Open shopping list"]) {
      const btn = screen.getByText(label).closest("button")!;
      expect(btn.className).toContain("w-fit");
      expect(btn.className).not.toContain("w-full");
    }
  });

  it("flag ON + empty week renders one invitation and suppresses the zero dashboard", () => {
    forceEmptyGrammar(true);
    const allEmpty = Array.from({ length: 7 }, (_, i) => emptyDay(i));
    const emptyVerdict = computePlanWeekVerdict(
      allEmpty.map((dp) =>
        dp.meals.map((m, i) => ({
          slot: ALL_MEAL_SLOTS[i] ?? "Snacks",
          kcal: m.calories,
          empty: m.isPlaceholder,
        })),
      ),
    );
    render(
      <PlanV3WebDashboard
        {...baseProps}
        plan={allEmpty}
        verdict={emptyVerdict}
      />,
    );
    expect(screen.queryByText(/days on target/)).not.toBeInTheDocument();
    expect(screen.getByTestId("plan-empty-week-card")).toBeInTheDocument();
    expect(screen.queryByText("0/7")).not.toBeInTheDocument();
    expect(screen.queryByText(/Add breakfast/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Generate this week" }),
    ).toHaveLength(1);
  });

  it("flag OFF + empty week preserves the legacy zero dashboard", () => {
    forceEmptyGrammar(false);
    const allEmpty = Array.from({ length: 7 }, (_, i) => emptyDay(i));
    render(<PlanV3WebDashboard {...baseProps} plan={allEmpty} />);
    expect(
      screen.queryByTestId("plan-empty-week-card"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("0/7")).toBeInTheDocument();
    expect(screen.getAllByText(/Add breakfast/i).length).toBeGreaterThan(0);
  });

  it("flag ON + partial week preserves stats and the standard week body", () => {
    forceEmptyGrammar(true);
    render(<PlanV3WebDashboard {...baseProps} />);
    expect(
      screen.queryByTestId("plan-empty-week-card"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("5/7")).toBeInTheDocument();
    expect(screen.getAllByText(/Add breakfast/i).length).toBeGreaterThan(0);
  });

  it("flag ON + populated week preserves the complete dashboard", () => {
    forceEmptyGrammar(true);
    const fullWeek = Array.from({ length: 7 }, (_, i) => fullDay(i));
    render(<PlanV3WebDashboard {...baseProps} plan={fullWeek} />);
    expect(
      screen.queryByTestId("plan-empty-week-card"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("7/7")).toBeInTheDocument();
    expect(screen.queryByText(/Add breakfast/i)).not.toBeInTheDocument();
  });

  it("flag ON + generating empty week retains progress and prevents duplicate submits", () => {
    forceEmptyGrammar(true);
    const allEmpty = Array.from({ length: 7 }, (_, i) => emptyDay(i));
    render(<PlanV3WebDashboard {...baseProps} plan={allEmpty} isGenerating />);
    const generate = screen.getByRole("button", { name: "Generating…" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: /add meals as you go/i }),
    ).toBeDisabled();
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
