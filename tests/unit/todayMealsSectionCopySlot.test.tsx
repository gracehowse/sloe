// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — ENG-786 rebuild "Copy to another day" row.
 *
 * The host (`NutritionTracker`) passes `onCopySlot` ONLY when the
 * `today_log_again` flag is on (same flag key retained under the new
 * behavior: `onCopySlot={isFeatureEnabled(...) ? (slot) =>
 * setCopySlotTarget({ slot }) : undefined}`). The component renders the
 * row iff `onCopySlot` is set and the slot is expanded with ≥1 entry.
 * These tests simulate the host by passing / omitting `onCopySlot`.
 *
 * Pairs with apps/mobile's equivalent ENG-786-rebuild test. Same matrix
 * on both sides so the `today-copy-slot-{slot}` testID + label +
 * flag-on/off contract can't drift between platforms.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

const GREEK_YOGURT: TodayMealSectionMeal = {
  id: "m-yogurt",
  name: "Snacks",
  recipeTitle: "Waitrose Greek yogurt",
  calories: 62,
  protein: 6,
  carbs: 4,
  fat: 3,
};

const ALMOND_BUTTER: TodayMealSectionMeal = {
  id: "m-almond",
  name: "Snacks",
  recipeTitle: "Almond butter",
  calories: 98,
  protein: 3,
  carbs: 3,
  fat: 9,
};

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  const snackMeals = [GREEK_YOGURT];
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: snackMeals },
    ],
    mealsForSelectedDate: snackMeals,
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

describe("TodayMealsSection (web) — ENG-786 Copy to another day row", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("prop omitted (flag off): the Copy row is absent", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });

  it("prop wired, single item: row renders with 'Copy to another day'", () => {
    render(<TodayMealsSection {...baseProps({ onCopySlot: vi.fn() })} />);
    expect(screen.getByTestId("today-copy-slot-Snacks")).toBeTruthy();
    expect(screen.getByText("Copy to another day")).toBeTruthy();
  });

  it("prop wired, multiple items: row still renders with 'Copy to another day' (no singular/plural split)", () => {
    const snackMeals = [GREEK_YOGURT, ALMOND_BUTTER];
    render(
      <TodayMealsSection
        {...baseProps({
          onCopySlot: vi.fn(),
          mealsForSelectedDate: snackMeals,
          mealsGrouped: [
            { name: "Breakfast", meals: [] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: snackMeals },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("today-copy-slot-Snacks")).toBeTruthy();
    expect(screen.getByText("Copy to another day")).toBeTruthy();
  });

  it("prop wired: clicking the row calls onCopySlot(slot) — no longer clones instantly", () => {
    const onCopySlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onCopySlot })} />);
    fireEvent.click(screen.getByTestId("today-copy-slot-Snacks"));
    expect(onCopySlot).toHaveBeenCalledTimes(1);
    expect(onCopySlot).toHaveBeenCalledWith("Snacks");
  });

  it("prop wired but slot collapsed: the row is absent (mirrors mobile)", () => {
    render(
      <TodayMealsSection
        {...baseProps({ onCopySlot: vi.fn(), collapsedSlots: new Set(["Snacks"]) })}
      />,
    );
    expect(screen.queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });

  it("prop wired but slot empty: no row for an empty slot", () => {
    const empty = [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [] },
    ];
    render(
      <TodayMealsSection
        {...baseProps({
          onCopySlot: vi.fn(),
          mealsForSelectedDate: [],
          mealsGrouped: empty,
        })}
      />,
    );
    expect(screen.queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });
});
