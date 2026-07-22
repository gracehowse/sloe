/**
 * todayPlannedMealsCard — web parity for the mobile component
 * `apps/mobile/components/today/TodayPlannedMealsCard.tsx`. Renders
 * the user's plan-for-today rows with a portion picker so the user
 * can one-tap log them at ½ / 1 / 1½ / 2× the planned serving.
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TodayPlannedMealsCard } from "../../src/app/components/suppr/today-planned-meals-card";
import type { DayPlanMeal } from "../../src/types/recipe";

const MEALS: DayPlanMeal[] = [
  { name: "Breakfast", recipeTitle: "Greek yogurt bowl", calories: 320, protein: 28, carbs: 35, fat: 8 },
  { name: "Lunch", recipeTitle: "Sheet-pan chicken", calories: 620, protein: 55, carbs: 40, fat: 22 },
];

describe("TodayPlannedMealsCard", () => {
  it("renders the planned section header and one row per planned meal", () => {
    render(<TodayPlannedMealsCard plannedMeals={MEALS} onLogPlannedMealWithPortion={() => {}} />);
    expect(screen.getByText("Planned")).toBeDefined();
    expect(screen.getByText("Greek yogurt bowl")).toBeDefined();
    expect(screen.getByText("Sheet-pan chicken")).toBeDefined();
  });

  it("formats the macro detail line with kcal + P/C/F", () => {
    render(<TodayPlannedMealsCard plannedMeals={[MEALS[0]!]} onLogPlannedMealWithPortion={() => {}} />);
    // Number-first via the SHARED formatter (mobile parity, wave-2 D2):
    // "320 kcal · 28g P · 35g C · 8g F"
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/320 kcal/);
    expect(text).toMatch(/28g P/);
    expect(text).toMatch(/35g C/);
    expect(text).toMatch(/8g F/);
    expect(text).not.toMatch(/P 28g/);
  });

  it("opens the portion picker when 'Log today' is clicked", () => {
    render(<TodayPlannedMealsCard plannedMeals={[MEALS[0]!]} onLogPlannedMealWithPortion={() => {}} />);
    expect(screen.queryByRole("group", { name: /Choose portion/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log today" }));
    expect(screen.getByRole("group", { name: /Choose portion/ })).toBeDefined();
    // The four portion buttons.
    expect(screen.getByRole("button", { name: "½×" })).toBeDefined();
    expect(screen.getByRole("button", { name: "1×" })).toBeDefined();
    expect(screen.getByRole("button", { name: "1½×" })).toBeDefined();
    expect(screen.getByRole("button", { name: "2×" })).toBeDefined();
  });

  it("calls onLogPlannedMealWithPortion with the meal + chosen portion, then closes the picker", () => {
    const onLog = vi.fn();
    render(<TodayPlannedMealsCard plannedMeals={[MEALS[1]!]} onLogPlannedMealWithPortion={onLog} />);
    fireEvent.click(screen.getByRole("button", { name: "Log today" }));
    fireEvent.click(screen.getByRole("button", { name: "1½×" }));
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalledWith(MEALS[1], 1.5);
    // Picker closes after a portion is chosen.
    expect(screen.queryByRole("group", { name: /Choose portion/ })).toBeNull();
    // Back to the "Log today" button.
    expect(screen.getByRole("button", { name: "Log today" })).toBeDefined();
  });

  it("Cancel button on the picker closes it without calling the callback", () => {
    const onLog = vi.fn();
    render(<TodayPlannedMealsCard plannedMeals={[MEALS[0]!]} onLogPlannedMealWithPortion={onLog} />);
    fireEvent.click(screen.getByRole("button", { name: "Log today" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: /Choose portion/ })).toBeNull();
  });
});

/**
 * F-178/F-179 (ENG-1065) — empty-state branch, web parity with mobile
 * `TodayPlannedMealsCard`. When the host mounts the card with no planned
 * meals, the card keeps the SAME shell + "Planned" header and shows a calm
 * one-liner plus a ghost "Plan your day →" link into the Plan tab (`/plan`).
 * `today_planned_empty_state` collapsed (ENG-1651) — the host always mounts
 * this now on the day view.
 */
describe("TodayPlannedMealsCard — empty-state branch (F-178/F-179)", () => {
  it("renders the SAME 'Planned' header in the empty state", () => {
    render(<TodayPlannedMealsCard plannedMeals={[]} onLogPlannedMealWithPortion={() => {}} />);
    expect(screen.getByText("Planned")).toBeDefined();
  });

  it("shows the calm one-liner and a 'Plan your day →' link to /plan", () => {
    render(<TodayPlannedMealsCard plannedMeals={[]} onLogPlannedMealWithPortion={() => {}} />);
    expect(screen.getByText("Nothing planned for today")).toBeDefined();
    const link = screen.getByRole("link", { name: /Plan your day/ });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/plan");
  });

  it("does NOT render meal rows or a 'Log today' button in the empty state", () => {
    const onLog = vi.fn();
    render(<TodayPlannedMealsCard plannedMeals={[]} onLogPlannedMealWithPortion={onLog} />);
    expect(screen.queryByRole("button", { name: "Log today" })).toBeNull();
    expect(onLog).not.toHaveBeenCalled();
  });

  it("renders populated rows (NOT the empty branch) when meals exist", () => {
    render(<TodayPlannedMealsCard plannedMeals={[MEALS[0]!]} onLogPlannedMealWithPortion={() => {}} />);
    expect(screen.getByText("Greek yogurt bowl")).toBeDefined();
    expect(screen.queryByText("Nothing planned for today")).toBeNull();
  });
});
