// @vitest-environment jsdom
/**
 * Swipe-to-delete on Today meal rows — Figma 654 layout (production default).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TodayMealsSection,
  type TodayMealsSectionProps,
  type TodayMealSectionMeal,
} from "../../src/app/components/suppr/today-meals-section";

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag === "today_meals_figma_layout",
}));

void React;

function meal(over: Partial<TodayMealSectionMeal> & { id: string }): TodayMealSectionMeal {
  return {
    name: "Breakfast",
    recipeTitle: "Oats",
    calories: 200,
    protein: 8,
    carbs: 30,
    fat: 4,
    ...over,
  };
}

function baseProps(overrides: Partial<TodayMealsSectionProps> = {}): TodayMealsSectionProps {
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

describe("TodayMealsSection — swipe delete (web)", () => {
  it("renders Remove meal control on expanded Figma rows", () => {
    const oats = meal({ id: "m1", recipeTitle: "Oats" });
    const eggs = meal({ id: "m2", recipeTitle: "Eggs", calories: 140 });
    render(
      <TodayMealsSection
        {...baseProps({
          mealsGrouped: [
            { name: "Breakfast", meals: [oats, eggs] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [oats, eggs],
        })}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Remove meal", hidden: true }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("opens destructive confirm when Remove meal is tapped", () => {
    const onDeleteMeal = vi.fn();
    const oats = meal({ id: "m1", recipeTitle: "Oats" });
    const eggs = meal({ id: "m2", recipeTitle: "Eggs", calories: 140 });
    render(
      <TodayMealsSection
        {...baseProps({
          onDeleteMeal,
          mealsGrouped: [
            { name: "Breakfast", meals: [oats, eggs] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [oats, eggs],
        })}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Remove meal", hidden: true })[0]!);
    expect(screen.getByText('Remove "Oats"?')).toBeInTheDocument();
    expect(onDeleteMeal).not.toHaveBeenCalled();
  });
});
