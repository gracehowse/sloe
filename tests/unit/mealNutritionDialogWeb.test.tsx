// @vitest-environment jsdom
/**
 * MealNutritionDialog (web) + TodayMealsSection "View nutrition" wiring.
 *
 * P5 parity gap #15 — the web mirror of the mobile per-meal nutrition-detail
 * SCREEN (`apps/mobile/app/meal-nutrition.tsx`). Web is a single-page app, so
 * the analog is a Dialog (sibling to MacroDetailPanel) hosted by NutritionTracker
 * and opened from a "View nutrition" item in each meal row's kebab.
 *
 * These tests protect:
 *  - the dialog renders the meal title, total kcal, macro split (P/C/F %), and
 *    the micronutrient rows for a meal WITH data
 *  - the confidence / incomplete state for a low-data meal (single reported macro
 *    that can't account for the kcal) — no misleading "% of kcal" labels
 *  - the empty micros state for a meal with no published micros
 *  - the macro-split percentages sum to EXACTLY 100 (the shared Hamilton-rounding
 *    guarantee — `macroCalorieSplit`)
 *  - flag OFF (host omits `onOpenMealNutrition`) → no "View nutrition" affordance
 *    in the kebab; flag ON → item present and wired
 *
 * Pairs with apps/mobile/tests/unit/macroCalorieSplitLargestRemainder.test.ts
 * (shared rounding) so the per-meal numbers can't drift between platforms.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Radix's DropdownMenu uses Pointer Events + pointer capture, which jsdom does
// not implement. Stub the capture methods + scrollIntoView once so
// `userEvent.click` can open the kebab the way a real pointer would.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
  if (!proto.scrollIntoView) proto.scrollIntoView = () => undefined;
});

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

import {
  MealNutritionDialog,
  type MealNutritionMeal,
} from "../../src/app/components/suppr/meal-nutrition-dialog";
import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";
import { isFeatureEnabled } from "../../src/lib/analytics/track";

void React;

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

// A complete, micro-rich meal (verified source, sugar + sodium + iron published).
const FULL_MEAL: MealNutritionMeal = {
  id: "m-bowl",
  name: "Dinner",
  recipeTitle: "Salmon teriyaki bowl",
  time: "7:30 PM",
  calories: 620,
  protein: 42,
  carbs: 58,
  fat: 21,
  fiberG: 6,
  source: "FatSecret",
  micros: { sugarG: 12, sodiumMg: 540, ironMg: 3 },
};

// A low-data meal: only fat is reported, kcal far exceeds Atwater-for-fat, so the
// macro split is NOT trustworthy (F-82 single_macro state).
const LOW_DATA_MEAL: MealNutritionMeal = {
  id: "m-crisp",
  name: "Snacks",
  recipeTitle: "Chili crisp",
  calories: 300,
  protein: 0,
  carbs: 0,
  fat: 3, // 3g fat ≈ 27 kcal — nowhere near the 300 kcal claim → incomplete
  source: "Open Food Facts",
  micros: null,
};

describe("MealNutritionDialog (web) — meal WITH data", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("renders the meal title + slot/time/source meta", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    expect(screen.getByText("Salmon teriyaki bowl")).toBeTruthy();
    // Description line: "Dinner · 7:30 PM · FatSecret".
    expect(screen.getByText(/Dinner · 7:30 PM · FatSecret/)).toBeTruthy();
  });

  it("renders the total kcal headline", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    expect(screen.getByTestId("meal-nutrition-kcal")).toHaveTextContent("620 kcal");
  });

  it("renders the macro split bar + per-macro grams and '% of kcal'", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    expect(screen.getByTestId("meal-nutrition-macro-bar")).toBeTruthy();
    expect(screen.getByText("Protein")).toBeTruthy();
    expect(screen.getByText("Carbs")).toBeTruthy();
    expect(screen.getByText("Fat")).toBeTruthy();
    expect(screen.getByText("42g")).toBeTruthy();
    expect(screen.getByText("58g")).toBeTruthy();
    // The "% of kcal" caption renders for a complete split.
    expect(screen.getAllByText(/% of kcal/).length).toBe(3);
  });

  it("paints the '% of kcal' caption in neutral muted-foreground, NOT the macro hue (ENG-1020 #5)", () => {
    // e2e walk 2026-06-10: the share-of-energy caption is a neutral stat. It
    // must NOT inherit the macro hue — `--macro-fat` is amber (the over-budget
    // signal), so the Fat caption used to read as a warning. All three render
    // in muted-foreground with no inline macro-var colour.
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    const captions = screen.getAllByText(/% of kcal/);
    expect(captions.length).toBe(3);
    for (const caption of captions) {
      expect(caption.className).toMatch(/text-muted-foreground/);
      // No inline macro-hue colour leaked back in.
      expect(caption.getAttribute("style") ?? "").not.toMatch(/--macro-/);
    }
  });

  it("renders the macronutrient detail rows with published values (fibre first)", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    const list = screen.getByTestId("meal-nutrition-micros-list");
    // Fibre injected as the first curated row.
    expect(within(list).getByText("Fiber")).toBeTruthy();
    expect(within(list).getByText("6g")).toBeTruthy();
    // Published micros surface with formatted values.
    expect(within(list).getByText("Sugar")).toBeTruthy();
    expect(within(list).getByText("12g")).toBeTruthy();
    expect(within(list).getByText("Sodium")).toBeTruthy();
    expect(within(list).getByText("540mg")).toBeTruthy();
    // e2e walk 2026-06-10: unpublished rows no longer render at all —
    // the absent fields collapse to one quiet summary line below the
    // list (calm-minimal; the old wall of grey "Not published" rows
    // read as dead chrome).
    expect(within(list).queryByText("Not published")).toBeNull();
    expect(screen.getByTestId("meal-nutrition-micros-rest").textContent).toMatch(
      /\d+ more not published by FatSecret\./,
    );
  });

  it("shows the source-attributed published-count line", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    // Fibre + sugar + sodium + iron = 4 populated fields, attributed to the source.
    expect(screen.getByText(/4 of \d+ fields published by FatSecret/)).toBeTruthy();
  });

  it("renders nothing when open is false (additive — no surface when closed)", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open={false} onClose={() => undefined} />);
    expect(screen.queryByTestId("meal-nutrition-dialog")).toBeNull();
    expect(screen.queryByText("Salmon teriyaki bowl")).toBeNull();
  });

  it("renders + wires the Edit affordance when onEdit is provided", () => {
    const onEdit = vi.fn();
    render(
      <MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} onEdit={onEdit} />,
    );
    fireEvent.click(screen.getByTestId("meal-nutrition-edit"));
    expect(onEdit).toHaveBeenCalledWith("m-bowl");
  });

  it("omits the Edit affordance when onEdit is not provided (read-only on web)", () => {
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    expect(screen.queryByTestId("meal-nutrition-edit")).toBeNull();
  });
});

describe("MealNutritionDialog (web) — low-data / confidence state", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("shows the incomplete-data explainer instead of a misleading macro bar", () => {
    render(<MealNutritionDialog meal={LOW_DATA_MEAL} open onClose={() => undefined} />);
    // The single_macro confidence state replaces the bar with an explainer.
    expect(screen.getByTestId("meal-nutrition-incomplete")).toBeTruthy();
    expect(screen.queryByTestId("meal-nutrition-macro-bar")).toBeNull();
    // Copy names the reported macro + the missing ones (shared helper output).
    expect(
      screen.getByText(/Only fat reported — protein and carbs not published by source\./),
    ).toBeTruthy();
    // No "% of kcal" captions in the incomplete state (grams only).
    expect(screen.queryByText(/% of kcal/)).toBeNull();
  });

  it("shows the source-attributed empty micros state when no micros are published", () => {
    render(<MealNutritionDialog meal={LOW_DATA_MEAL} open onClose={() => undefined} />);
    expect(screen.getByTestId("meal-nutrition-micros-empty")).toHaveTextContent(
      "Open Food Facts did not publish vitamin or mineral data for this product.",
    );
    expect(screen.queryByTestId("meal-nutrition-micros-list")).toBeNull();
  });

  it("falls back to a designed dead-end when the meal is null (removed mid-flow)", () => {
    render(<MealNutritionDialog meal={null} open onClose={() => undefined} />);
    expect(screen.getByTestId("meal-nutrition-missing")).toHaveTextContent("Meal not found");
  });
});

describe("MealNutritionDialog (web) — Hamilton-rounding guarantee", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("the three displayed macro percentages sum to exactly 100", () => {
    // 33.4 / 33.4 / 14.84 is the canonical near-uniform split where naive
    // per-macro Math.round yields 99. The shared macroCalorieSplit must fix it.
    const meal: MealNutritionMeal = {
      id: "m-even",
      name: "Lunch",
      recipeTitle: "Balanced plate",
      calories: 401,
      protein: 33.4,
      carbs: 33.4,
      fat: 14.84,
      source: "USDA",
    };
    render(<MealNutritionDialog meal={meal} open onClose={() => undefined} />);
    const captions = screen.getAllByText(/% of kcal/);
    expect(captions.length).toBe(3);
    const pcts = captions.map((el) => {
      const match = (el.textContent ?? "").match(/(\d+)% of kcal/);
      return match ? Number(match[1]) : 0;
    });
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

// --- TodayMealsSection wiring: the "View nutrition" affordance is flag-gated ---

const DINNER_ROW: TodayMealSectionMeal = {
  id: "m-dinner",
  name: "Dinner",
  recipeTitle: "Salmon teriyaki bowl",
  calories: 620,
  protein: 42,
  carbs: 58,
  fat: 21,
};

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [DINNER_ROW] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: [DINNER_ROW],
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

async function openKebab() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("More actions for Salmon teriyaki bowl"));
}

describe("TodayMealsSection (web) — 'View nutrition' kebab item (gap #15 wiring)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("flag OFF (onOpenMealNutrition omitted): no 'View nutrition' item, legacy actions intact", async () => {
    render(<TodayMealsSection {...baseProps()} />);
    await openKebab();
    expect(screen.queryByTestId("today-meal-view-nutrition-m-dinner")).toBeNull();
    expect(screen.queryByText("View nutrition")).toBeNull();
    // Legacy kebab actions remain byte-identical.
    expect(screen.getByText("Copy to another day…")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("flag ON (handler wired): 'View nutrition' item renders and calls the handler with the meal id", async () => {
    const onOpenMealNutrition = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenMealNutrition })} />);
    await openKebab();
    const item = screen.getByTestId("today-meal-view-nutrition-m-dinner");
    expect(item).toBeTruthy();
    expect(item).toHaveTextContent("View nutrition");
    fireEvent.click(item);
    expect(onOpenMealNutrition).toHaveBeenCalledTimes(1);
    expect(onOpenMealNutrition).toHaveBeenCalledWith("m-dinner");
  });
});
