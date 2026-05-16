// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — flag-gated `Log usual` row + testID
 * contract (2026-05-15 crowder task + Maestro reliability pass).
 *
 * Pairs with apps/mobile/tests/unit/todayLogUsualRowV2.test.tsx. Same
 * matrix on the web side so the contract — testID names + flag-on /
 * flag-off behaviour — cannot drift between platforms.
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

describe("TodayMealsSection (web) — today_log_usual_row_v2 flag", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("flag OFF: in-header pill renders, v2 row does not", () => {
    flagFn.mockImplementation(() => false);
    render(<TodayMealsSection {...baseProps()} />);
    expect(
      screen.getByTestId("today-log-usual-pill-in-header-Snacks"),
    ).toBeTruthy();
    expect(screen.queryByTestId("today-log-usual-row-Snacks")).toBeNull();
    expect(screen.queryByTestId("today-log-usual-pill-Snacks")).toBeNull();
  });

  it("flag ON: v2 row + pill render, in-header pill does not", () => {
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

  it("flag ON: tapping the pill calls onLogSavedMeal(savedMeal, slot)", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const onLogSavedMeal = vi.fn();
    render(<TodayMealsSection {...baseProps({ onLogSavedMeal })} />);
    fireEvent.click(screen.getByTestId("today-log-usual-pill-Snacks"));
    expect(onLogSavedMeal).toHaveBeenCalledTimes(1);
    expect(onLogSavedMeal).toHaveBeenCalledWith(
      PEANUT_BUTTER_SMOOTHIE,
      "Snacks",
    );
  });

  it("flag ON: v2 row stays in the DOM when the slot is collapsed", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    render(
      <TodayMealsSection
        {...baseProps({ collapsedSlots: new Set(["Snacks"]) })}
      />,
    );
    expect(screen.getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
  });

  it("testID contract: slot + header + chevron also resolve when populated", () => {
    flagFn.mockImplementation(() => false);
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-slot-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-slot-header-Snacks")).toBeTruthy();
    expect(screen.getByTestId("today-slot-chevron-Snacks")).toBeTruthy();
  });
});
