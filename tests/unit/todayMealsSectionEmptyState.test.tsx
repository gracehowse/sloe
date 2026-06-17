// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — empty-state parity with mobile.
 *
 * ENG-1095 (Grace 2026-06-13) — web now mirrors mobile's empty meals: the four
 * standard per-slot rows (Breakfast/Lunch/Dinner/Snacks) render on an empty day,
 * each with a "+" add affordance, instead of the old single "Log a meal" card.
 * Gated on `today_meals_all_slots_v1` (default-on); the single-CTA card is the
 * flag-off kill switch.
 *
 * (Supersedes the 2026-05-02 parity model — "a single primary Log a meal CTA" —
 * which itself replaced the older 3-CTA collage. The collage strings must still
 * never appear in either state.)
 *
 * Coverage:
 *   1. Default (flag on): empty day renders the four per-slot rows + "+" adds,
 *      and NOT the single "Log a meal" card.
 *   2. Default: tapping an empty slot fires onOpenAddForSlot(slot).
 *   3. Flag off: the single "Log a meal" CTA renders and fires onOpenLogSheet.
 *   4. Neither state renders the legacy collage strings.
 *   5. Populated state hides the empty-state CTA entirely.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";

// Default mock: every redesign flag on. `today_meals_all_slots_v1` toggles per
// test to exercise both the all-slots list and the single-CTA kill switch.
const flagState: { allSlots: boolean } = { allSlots: true };
vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => {
    if (flag === "today_meals_all_slots_v1") return flagState.allSlots;
    return true;
  },
}));

void React;

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  const slots: Array<{ name: string; meals: TodayMealSectionMeal[] }> = [];
  return {
    mealsGrouped: slots,
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

describe("TodayMealsSection — empty state (web↔mobile parity, ENG-1095)", () => {
  it("default: empty day renders the four per-slot rows with '+' adds, not the single CTA", () => {
    flagState.allSlots = true;
    render(<TodayMealsSection {...baseProps()} />);
    for (const slot of ["Breakfast", "Lunch", "Dinner", "Snacks"]) {
      expect(screen.getByTestId(`today-slot-${slot}`)).toBeTruthy();
      expect(screen.getByTestId(`today-slot-add-${slot}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("today-meals-empty-cta")).toBeNull();
    expect(screen.queryByTestId("today-meals-empty-state")).toBeNull();
  });

  it("default: tapping an empty slot header fires onOpenAddForSlot(slot)", () => {
    flagState.allSlots = true;
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-slot-header-Lunch"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Lunch");
  });

  it("flag off: renders the single 'Log a meal' CTA and fires onOpenLogSheet", () => {
    flagState.allSlots = false;
    const onOpenLogSheet = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenLogSheet })} />);
    const cta = screen.getByTestId("today-meals-empty-cta");
    expect(cta.getAttribute("aria-label")).toBe("Log a meal");
    fireEvent.click(cta);
    expect(onOpenLogSheet).toHaveBeenCalledTimes(1);
    flagState.allSlots = true;
  });

  it("neither state renders the legacy collage strings", () => {
    flagState.allSlots = true;
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.queryByText(/Log from today's plan/i)).toBeNull();
    expect(screen.queryByText(/^Photo log$/)).toBeNull();
    expect(screen.queryByText(/^Voice log$/)).toBeNull();
    expect(screen.queryByText(/Add custom meal/i)).toBeNull();
  });

  it("hides the empty-state CTA once at least one meal is logged", () => {
    flagState.allSlots = true;
    const meal: TodayMealSectionMeal = {
      id: "m1",
      name: "Breakfast",
      recipeTitle: "Yogurt bowl",
      calories: 320,
      protein: 28,
      carbs: 35,
      fat: 8,
    };
    render(
      <TodayMealsSection
        {...baseProps({
          mealsGrouped: [{ name: "Breakfast", meals: [meal] }],
          mealsForSelectedDate: [meal],
        })}
      />,
    );
    expect(screen.queryByTestId("today-meals-empty-cta")).toBeNull();
    expect(screen.queryByTestId("today-meals-empty-state")).toBeNull();
    // Mobile parity: the other three slots still render (don't vanish on first log).
    for (const slot of ["Lunch", "Dinner", "Snacks"]) {
      expect(screen.getByTestId(`today-slot-${slot}`)).toBeTruthy();
    }
  });
});
