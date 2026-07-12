// @vitest-environment jsdom
/**
 * ENG-1524 — meal-row hierarchy (web twin of the mobile fix).
 *
 * The tracker's point is the energy figure, but the pre-1524 row whispered it:
 * the kcal value rendered at `text-xs text-muted-foreground` (quieter than the
 * `text-sm text-foreground` food name) and the row divider used
 * `border-border/10` (10% opacity — near-invisible), so a slot's rows read as
 * one undivided block.
 *
 * This pins the corrected hierarchy, mirroring
 * `apps/mobile/tests/unit/mealRowHierarchy.test.tsx`:
 *   1. The kcal numeral is promoted to the headline font at `text-lg` in
 *      PRIMARY ink (`text-foreground`), tabular-nums, right-anchored.
 *   2. A small TERTIARY "kcal" suffix sits beside it.
 *   3. The food name steps back to the SECONDARY ink (`text-muted-foreground`).
 *   4. The row divider is the full `border-border` token — no `/10` alpha.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: () => true,
}));

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

function baseProps(): TodayMealsSectionProps {
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [HAM] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: [HAM],
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
  };
}

describe("TodayMealsSection — ENG-1524 meal-row hierarchy (web)", () => {
  it("promotes the row kcal to a headline text-lg primary numeral (tabular-nums)", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const kcal = screen.getByTestId("today-meal-kcal-m1");
    expect(kcal.textContent).toBe("217");
    expect(kcal.className).toContain("text-lg");
    expect(kcal.className).toContain("text-foreground");
    expect(kcal.className).toContain("tabular-nums");
    expect(kcal.className).toContain("var(--font-headline)");
    // Not the whispered muted caption it replaced.
    expect(kcal.className).not.toContain("text-xs");
    expect(kcal.className).not.toContain("text-muted-foreground");
  });

  it("keeps a small tertiary 'kcal' suffix beside the numeral", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const unit = screen.getByText("kcal");
    expect(unit.className).toContain("text-foreground-tertiary");
  });

  it("demotes the food name to the secondary ink (text-muted-foreground)", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const name = screen.getByText("Ham and Cheese Toastie");
    expect(name.className).toContain("text-muted-foreground");
    // Stepped back from the primary ink it used to carry.
    expect(name.className).not.toContain("text-foreground ");
  });

  it("draws a real hairline row divider (border-border, no /10 alpha)", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const row = screen.getByTestId("today-meal-row-m1");
    expect(row.className).toContain("border-b border-border");
    expect(row.className).not.toContain("border-border/10");
  });
});
