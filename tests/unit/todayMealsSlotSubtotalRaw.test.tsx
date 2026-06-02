// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — ENG-785 slot subtotal must NOT double-count.
 *
 * Stored `meal.calories` is already baked at the entry's portion (F-70
 * convention — the recipe-log path stores `scaledMacro(recipe.calories, p)`
 * with `portionMultiplier: p` as a label only). The slot-header subtotal
 * used to re-apply `scaledMacro(m.calories, pm)`, so a meal with
 * `portionMultiplier ≠ 1` was scaled twice and diverged from its own rows
 * + the day total (both of which sum raw). This pins the subtotal to the
 * raw sum.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";
import { isFeatureEnabled } from "../../src/lib/analytics/track";

void React;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

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
    collapsedSlots: new Set<string>(),
    onToggleSlot: () => undefined,
    onOpenAddForSlot: () => undefined,
    onOpenSaveUsualMeal: () => undefined,
    onOpenDuplicateDay: () => undefined,
    onRequestCopyMeal: () => undefined,
    onDeleteMeal: () => undefined,
    onOpenLogSheet: () => undefined,
    savedMeals: [],
    onLogSavedMeal: () => undefined,
    hintVisibleForSlot: () => false,
    onDismissUsualMealHint: () => undefined,
    onAcceptUsualMealHint: () => undefined,
    ...overrides,
  };
}

describe("TodayMealsSection (web) — ENG-785 raw slot subtotal", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("sums RAW calories for a half-portion entry (no double-count)", () => {
    // calories already baked at 0.5×: storage holds 140. Old bug re-scaled
    // to 70; the fix shows the raw 140 to match the per-row + day total.
    const halfPortion: TodayMealSectionMeal = {
      id: "m-half",
      name: "Snacks",
      recipeTitle: "Half portion bar",
      calories: 140,
      protein: 0,
      carbs: 0,
      fat: 0,
      portionMultiplier: 0.5,
    };
    const grouped = [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [halfPortion] },
    ];
    render(
      <TodayMealsSection
        {...baseProps({ mealsForSelectedDate: [halfPortion], mealsGrouped: grouped })}
      />,
    );
    const header = screen.getByTestId("today-slot-header-Snacks");
    expect(header.textContent).toContain("140");
    expect(header.textContent).not.toContain("70");
  });

  it("subtotal of two half-portion entries equals the sum of raw values", () => {
    const a: TodayMealSectionMeal = {
      id: "a", name: "Snacks", recipeTitle: "A", calories: 100, protein: 0, carbs: 0, fat: 0, portionMultiplier: 0.5,
    };
    const b: TodayMealSectionMeal = {
      id: "b", name: "Snacks", recipeTitle: "B", calories: 60, protein: 0, carbs: 0, fat: 0, portionMultiplier: 0.5,
    };
    const grouped = [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [a, b] },
    ];
    render(
      <TodayMealsSection
        {...baseProps({ mealsForSelectedDate: [a, b], mealsGrouped: grouped })}
      />,
    );
    const header = screen.getByTestId("today-slot-header-Snacks");
    // raw 100 + 60 = 160 (not the double-scaled 50 + 30 = 80)
    expect(header.textContent).toContain("160");
    expect(header.textContent).not.toContain("80");
  });
});
