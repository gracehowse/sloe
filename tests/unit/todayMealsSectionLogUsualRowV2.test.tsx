// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — dedicated `Log usual` row + testID contract
 * (2026-05-15 crowder task + Maestro reliability pass).
 *
 * ENG-1651 (round 2, slice 3, 2026-07-22): the `today_log_usual_row_v2`
 * flag gate was collapsed — the dedicated-row layout is now permanent and
 * the legacy in-header pill is gone. Pairs with
 * apps/mobile/tests/unit/todayLogUsualRowV2.test.tsx. Same matrix on the
 * web side so the contract — testID names + rendered behaviour — cannot
 * drift between platforms.
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
import type { SavedMeal } from "../../src/lib/nutrition/savedMeals";

void React;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const SNACK_MEAL: TodayMealSectionMeal = {
  id: "m-snack",
  name: "Snacks",
  recipeTitle: "Almond butter cookie",
  calories: 140,
  protein: 6,
  carbs: 14,
  fat: 7,
};

const PEANUT_BUTTER_SMOOTHIE: SavedMeal = {
  id: "saved-1",
  name: "Peanut Butter Smoothie",
  defaultMealSlot: "Snacks",
  items: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  lastLoggedAt: "2026-05-10T00:00:00.000Z",
  logCount: 3,
};

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [SNACK_MEAL] },
    ],
    mealsForSelectedDate: [SNACK_MEAL],
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
    savedMeals: [PEANUT_BUTTER_SMOOTHIE],
    onLogSavedMeal: () => undefined,
    hintVisibleForSlot: () => false,
    onDismissUsualMealHint: () => undefined,
    onAcceptUsualMealHint: () => undefined,
    ...overrides,
  };
}

describe("TodayMealsSection (web) — empty day (ENG-635)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("hides Log usual pills when no meals logged on the selected day", () => {
    render(
      <TodayMealsSection
        {...baseProps({
          mealsForSelectedDate: [],
          mealsGrouped: [
            { name: "Breakfast", meals: [] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("today-log-usual-row-Snacks")).toBeNull();
  });
});

describe("TodayMealsSection (web) — Log usual row (ENG-1651: today_log_usual_row_v2 permanently ON)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("renders the dedicated Log-usual row + pill; the legacy in-header pill never renders", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
    expect(
      screen.queryByTestId("today-log-usual-pill-in-header-Snacks"),
    ).toBeNull();
  });

  it("gate removed: rendering is unaffected by what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
    expect(
      screen.queryByTestId("today-log-usual-pill-in-header-Snacks"),
    ).toBeNull();
  });

  it("tapping the pill calls onLogSavedMeal(savedMeal, slot)", () => {
    const onLogSavedMeal = vi.fn();
    render(<TodayMealsSection {...baseProps({ onLogSavedMeal })} />);
    fireEvent.click(screen.getByTestId("today-log-usual-pill-Snacks"));
    expect(onLogSavedMeal).toHaveBeenCalledTimes(1);
    expect(onLogSavedMeal).toHaveBeenCalledWith(
      PEANUT_BUTTER_SMOOTHIE,
      "Snacks",
    );
  });

  it("the row stays in the DOM when the slot is collapsed", () => {
    render(
      <TodayMealsSection
        {...baseProps({ collapsedSlots: new Set(["Snacks"]) })}
      />,
    );
    expect(screen.getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
  });

  it("testID contract: slot + header + chevron also resolve when populated", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-slot-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-slot-header-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-slot-chevron-Snacks")).toBeTruthy();
  });
});
