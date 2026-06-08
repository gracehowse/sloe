// @vitest-environment jsdom
/** Figma `654:2` empty day — dashed Log {slot} only, no legacy empty card. */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodayMealsSection,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag === "today_meals_figma_654",
}));

void React;

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

describe("TodayMealsSection — Figma 654 empty day", () => {
  it("renders dashed Log Breakfast CTA without legacy empty-state card", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-log-slot-cta-Breakfast")).toBeTruthy();
    expect(screen.queryByTestId("today-meals-empty-state")).toBeNull();
    expect(screen.queryByTestId("today-meals-empty-cta")).toBeNull();
  });

  it("routes dashed CTA through onOpenAddForSlot", () => {
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-log-slot-cta-Breakfast"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Breakfast");
  });
});
