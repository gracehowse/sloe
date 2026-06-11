// @vitest-environment jsdom
/**
 * e2e walk 2026-06-10 (ENG-1020 #4) — single-item Figma meal cards.
 *
 * The Figma `654:2` summary card header already shows the single (primary)
 * meal's title + "{slotCals} kcal · {P}g P". When a slot has exactly one
 * entry whose title equals that header title, the expanded row used to repeat
 * it verbatim ("MyFitnessPal entry · 318 kcal" twice). The expanded row is
 * suppressed in that case — but only that redundant row; "Add food" and any
 * multi-item slot rows must still render.
 *
 * Web mirror of the mobile `TodayMealsSection` renderSlotExpanded guard.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TodayMealsSection,
  type TodayMealsSectionProps,
  type TodayMealSectionMeal,
} from "../../src/app/components/suppr/today-meals-section";

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag === "today_meals_figma_654",
}));

void React;

function meal(over: Partial<TodayMealSectionMeal> & { id: string }): TodayMealSectionMeal {
  return {
    name: "Breakfast",
    recipeTitle: "Entry",
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    ...over,
  };
}

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: [],
    effectiveCalorieTarget: 2000,
    fiberTarget: 30,
    collapsedSlots: new Set(),
    onToggleSlot: vi.fn(),
    onOpenAddForSlot: vi.fn(),
    onOpenSaveUsualMeal: vi.fn(),
    onOpenDuplicateDay: vi.fn(),
    onRequestCopyMeal: vi.fn(),
    onDeleteMeal: vi.fn(),
    onOpenLogSheet: vi.fn(),
    savedMeals: [],
    onLogSavedMeal: vi.fn(),
    hintVisibleForSlot: () => false,
    onDismissUsualMealHint: vi.fn(),
    onAcceptUsualMealHint: vi.fn(),
    ...overrides,
  };
}

describe("TodayMealsSection — Figma 654 single-row dedup", () => {
  it("suppresses the redundant expanded row when the single entry equals the header title, keeping Add food", () => {
    const single = meal({ id: "1", recipeTitle: "MyFitnessPal entry", calories: 318 });
    render(
      <TodayMealsSection
        {...baseProps({
          mealsGrouped: [
            { name: "Breakfast", meals: [single] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [single],
        })}
      />,
    );
    // Header title still renders once (the card header h4).
    expect(screen.getByText("MyFitnessPal entry")).toBeTruthy();
    // Add food stays reachable so the slot is still editable.
    expect(screen.getByTestId("today-add-food-Breakfast")).toBeTruthy();
    // The redundant per-row kebab is gone (no expanded row rendered).
    expect(
      screen.queryByLabelText("More actions for MyFitnessPal entry"),
    ).toBeNull();
    // Swipe delete still targets the summary card (primary meal).
    expect(
      screen.getAllByRole("button", { name: "Remove meal", hidden: true }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows aggregate header title for multi-item slots (ENG-1058)", () => {
    const a = meal({ id: "1", recipeTitle: "good culture", calories: 141 });
    const b = meal({ id: "2", recipeTitle: "Cherry Tomatoes", calories: 28 });
    render(
      <TodayMealsSection
        {...baseProps({
          mealsGrouped: [
            { name: "Breakfast", meals: [a, b] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [a, b],
        })}
      />,
    );
    const summaryRow = screen.getByTestId("today-meals-figma-meal-row-Breakfast");
    expect(summaryRow.textContent).toContain("2 items");
    expect(summaryRow.textContent).not.toContain("good culture");
  });

  it("keeps rows for a multi-item slot even when the first entry matches the header title", () => {
    const a = meal({ id: "1", recipeTitle: "MyFitnessPal entry", calories: 318 });
    const b = meal({ id: "2", recipeTitle: "Sourdough", calories: 272 });
    render(
      <TodayMealsSection
        {...baseProps({
          mealsGrouped: [
            { name: "Breakfast", meals: [a, b] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [a, b],
        })}
      />,
    );
    // Both rows render (the second item's row carries new information).
    expect(screen.getByLabelText("More actions for MyFitnessPal entry")).toBeTruthy();
    expect(screen.getByLabelText("More actions for Sourdough")).toBeTruthy();
    expect(screen.getByTestId("today-add-food-Breakfast")).toBeTruthy();
  });

  it("does not suppress rows in a collapsed-then-empty slot (guard scoped to expanded cards)", () => {
    // A slot with no meals renders no expanded rows at all (the Figma layout
    // skips it) — the dedup guard never runs there, so suppression can't leak
    // into an empty slot. The next-slot Log CTA still appears.
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-log-slot-cta-Breakfast")).toBeTruthy();
    expect(screen.queryByTestId("today-meals-figma-expanded-Breakfast")).toBeNull();
  });
});
