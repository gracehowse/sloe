// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — Sloe TD4 per-slot cards parity with mobile.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";

void React;

const HAM: TodayMealSectionMeal = {
  id: "m1",
  name: "Breakfast",
  recipeTitle: "Ham and Cheese Toastie",
  calories: 217,
  protein: 12,
  carbs: 20,
  fat: 9,
};

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  const breakfast = overrides.mealsGrouped?.[0]?.meals ?? [HAM];
  return {
    mealsGrouped: overrides.mealsGrouped ?? [
      { name: "Breakfast", meals: breakfast },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: overrides.mealsForSelectedDate ?? breakfast,
    effectiveCalorieTarget: 2000,
    fiberTarget: 30,
    collapsedSlots: overrides.collapsedSlots ?? new Set(),
    onToggleSlot: vi.fn(),
    onOpenAddForSlot: overrides.onOpenAddForSlot ?? vi.fn(),
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

describe("TodayMealsSection — TD4 per-slot cards (web)", () => {
  it("renders Sloe TD4 section title (Newsreader Today's Meals)", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-meals-section-header")).toHaveTextContent(
      "Today's Meals",
    );
  });

  it("renders each slot as its own card with today-add-food on populated open slots", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-slot-Breakfast")).toBeTruthy();
    expect(screen.getByTestId("today-slot-Lunch")).toBeTruthy();
    expect(screen.getByTestId("today-add-food-Breakfast")).toBeTruthy();
    expect(screen.queryByTestId("today-add-food-Lunch")).toBeNull();
  });

  it("Add food routes through onOpenAddForSlot(slot)", () => {
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-add-food-Breakfast"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Breakfast");
  });

  it("empty slot header tap opens add for slot", () => {
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-slot-header-Lunch"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Lunch");
  });

  it("hides Add food when slot is collapsed", () => {
    render(
      <TodayMealsSection
        {...baseProps({ collapsedSlots: new Set(["Breakfast"]) })}
      />,
    );
    expect(screen.queryByTestId("today-add-food-Breakfast")).toBeNull();
  });
});
