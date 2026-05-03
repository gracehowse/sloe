// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — empty-state parity with mobile.
 *
 * 2026-05-02 parity sweep: mobile's `TodayMealsSection` has NO
 * empty-state collage rendered inside the meals card (mobile relies
 * on the raised "+" tab-bar button + per-slot "Tap to add" rows + the
 * standalone `<TodayPlannedMealsCard>` rendered above). Web previously
 * rendered:
 *   - a duplicated "Log from today's plan" rows block (already shown
 *     by `<TodayPlannedMealsCard>` above), and
 *   - 3 parallel CTAs (Add custom meal / Photo log / Voice log).
 *
 * Web now matches mobile: a single primary "Log a meal" CTA that opens
 * the unified `<LogSheet>` (same entry as the bottom-bar raised "+" on
 * mobile-web). The LogSheet's right-edge icons cover scan / voice /
 * photo modes, so they're not duplicated here.
 *
 * Coverage:
 *   1. Empty state renders the single "Log a meal" CTA.
 *   2. Empty state does NOT render the legacy collage strings
 *      ("Log from today's plan", "Photo log", "Voice log",
 *      "Add custom meal").
 *   3. CTA fires `onOpenLogSheet`.
 *   4. Non-empty state hides the empty-state CTA entirely.
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

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  const slots: Array<{ name: string; meals: TodayMealSectionMeal[] }> = [
    { name: "Breakfast", meals: [] },
    { name: "Lunch", meals: [] },
    { name: "Dinner", meals: [] },
    { name: "Snacks", meals: [] },
  ];
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

describe("TodayMealsSection — empty state (web↔mobile parity)", () => {
  it("renders a single 'Log a meal' CTA when no meals are logged", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const cta = screen.getByTestId("today-meals-empty-cta");
    expect(cta).toBeTruthy();
    expect(cta.getAttribute("aria-label")).toBe("Log a meal");
  });

  it("does NOT render the legacy collage strings", () => {
    render(<TodayMealsSection {...baseProps()} />);
    // Pre-2026-05-02 the empty state showed "Log from today's plan"
    // (duplicate of TodayPlannedMealsCard) plus three parallel CTAs.
    // Mobile has none of these; web parity means none of these appear.
    expect(screen.queryByText(/Log from today's plan/i)).toBeNull();
    expect(screen.queryByText(/^Photo log$/)).toBeNull();
    expect(screen.queryByText(/^Voice log$/)).toBeNull();
    expect(screen.queryByText(/Add custom meal/i)).toBeNull();
    expect(screen.queryByText(/Or add a custom meal/i)).toBeNull();
  });

  it("fires onOpenLogSheet when the CTA is clicked", () => {
    const onOpenLogSheet = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenLogSheet })} />);
    fireEvent.click(screen.getByTestId("today-meals-empty-cta"));
    expect(onOpenLogSheet).toHaveBeenCalledTimes(1);
  });

  it("hides the empty-state CTA once at least one meal is logged", () => {
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
          mealsGrouped: [
            { name: "Breakfast", meals: [meal] },
            { name: "Lunch", meals: [] },
            { name: "Dinner", meals: [] },
            { name: "Snacks", meals: [] },
          ],
          mealsForSelectedDate: [meal],
        })}
      />,
    );
    expect(screen.queryByTestId("today-meals-empty-cta")).toBeNull();
    expect(screen.queryByTestId("today-meals-empty-state")).toBeNull();
  });
});
