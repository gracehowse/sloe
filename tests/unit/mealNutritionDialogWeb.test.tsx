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
 *  - ENG-837 slot-aggregate mode: the dialog sums multiple meals' kcal / macros /
 *    micros / fibre EXACTLY (hand-computed fixture), renders the slot label as the
 *    title, shows the slot-empty state, hides Edit, and leaves single-meal mode
 *    untouched; the "View slot nutrition" header affordance is flag-gated (present
 *    on populated slots only, calls the handler with the slot name, stopPropagation)
 *  - source-check that the host gates BOTH the slot affordance prop and the
 *    aggregate dialog mount behind `web_meal_nutrition_detail`
 *
 * Pairs with apps/mobile/tests/unit/macroCalorieSplitLargestRemainder.test.ts
 * (shared rounding) so the per-meal numbers can't drift between platforms. The
 * slot sum reuses the SAME shared helpers mobile uses (sumMicrosFromLoggedMeals /
 * sumDayFiberFromMeals from src/lib/nutrition/microNutrientDisplay.ts), so the
 * aggregate numbers match mobile by construction.
 */
import * as React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("paints the '% of kcal' caption in neutral muted-foreground, NOT the macro hue (ENG-1020 #7)", () => {
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

// --- ENG-837: slot-aggregate mode (web mirror of mobile ?slot=&date=) ---

// Three Breakfast items. The summed totals are hand-computed so the assertions
// pin the EXACT numbers the shared helpers must produce (parity with mobile,
// which sums via the identical sumMicrosFromLoggedMeals / sumDayFiberFromMeals).
//   kcal:    300 + 250 + 150 = 700
//   protein:  20 +  15 +  10 = 45
//   carbs:    30 +  25 +  12 = 67
//   fat:       8 +   6 +   4 = 18
//   fibre:     3 +   2 +   1 = 6
//   sugar:     5 +   4 +   2 = 11g
//   sodium:  200 + 150 +   0 = 350mg
//   iron:      0 +   1 +   0 = 1mg
const SLOT_MEALS: MealNutritionMeal[] = [
  {
    id: "b1",
    name: "Breakfast",
    recipeTitle: "Oats & berries",
    calories: 300,
    protein: 20,
    carbs: 30,
    fat: 8,
    fiberG: 3,
    source: "USDA",
    micros: { sugarG: 5, sodiumMg: 200 },
  },
  {
    id: "b2",
    name: "Breakfast",
    recipeTitle: "Greek yogurt",
    calories: 250,
    protein: 15,
    carbs: 25,
    fat: 6,
    fiberG: 2,
    source: "FatSecret",
    micros: { sugarG: 4, sodiumMg: 150, ironMg: 1 },
  },
  {
    id: "b3",
    name: "Breakfast",
    recipeTitle: "Banana",
    calories: 150,
    protein: 10,
    carbs: 12,
    fat: 4,
    fiberG: 1,
    source: "USDA",
    micros: { sugarG: 2 },
  },
];

describe("MealNutritionDialog (web) — slot-aggregate mode (ENG-837)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("renders the slot label as the dialog title", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Breakfast")).toBeTruthy();
    // Item count in the description line.
    expect(screen.getByText(/3 items in this slot/)).toBeTruthy();
  });

  it("sums the total kcal across every meal in the slot", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    // 300 + 250 + 150 = 700.
    expect(screen.getByTestId("meal-nutrition-kcal")).toHaveTextContent("700 kcal");
  });

  it("sums protein / carbs / fat grams across the slot (shared math — mobile parity)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("45g")).toBeTruthy(); // protein 20+15+10
    expect(screen.getByText("67g")).toBeTruthy(); // carbs   30+25+12
    expect(screen.getByText("18g")).toBeTruthy(); // fat      8+ 6+ 4
  });

  it("renders the combined-macros caption naming the item count", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("meal-nutrition-aggregate-caption")).toHaveTextContent(
      "Combined macros across 3 logged items",
    );
  });

  it("sums micros across the slot via the shared helper (fibre + sugar + sodium + iron)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    const list = screen.getByTestId("meal-nutrition-micros-list");
    // Fibre is summed from the per-entry column (3+2+1 = 6), injected first.
    expect(within(list).getByText("Fiber")).toBeTruthy();
    expect(within(list).getByText("6g")).toBeTruthy();
    // Summed micros: sugar 5+4+2 = 11g, sodium 200+150 = 350mg, iron 1mg.
    expect(within(list).getByText("Sugar")).toBeTruthy();
    expect(within(list).getByText("11g")).toBeTruthy();
    expect(within(list).getByText("Sodium")).toBeTruthy();
    expect(within(list).getByText("350mg")).toBeTruthy();
    expect(within(list).getByText("Iron")).toBeTruthy();
    expect(within(list).getByText("1mg")).toBeTruthy();
    // 4 populated fields, attributed to the slot's items (not a single source).
    expect(
      screen.getByText(/4 of \d+ fields published by your logged items in this slot/),
    ).toBeTruthy();
  });

  it("the aggregate macro percentages sum to exactly 100 (shared Hamilton split)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    const captions = screen.getAllByText(/% of kcal/);
    expect(captions.length).toBe(3);
    const pcts = captions.map((el) => {
      const m = (el.textContent ?? "").match(/(\d+)% of kcal/);
      return m ? Number(m[1]) : 0;
    });
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("never renders the Edit affordance in aggregate mode (no single entry to edit)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
        // Even if a host wired onEdit, aggregate mode must hide it.
        onEdit={() => undefined}
      />,
    );
    expect(screen.queryByTestId("meal-nutrition-edit")).toBeNull();
  });

  it("sums micros even when only SOME meals carry them (never fabricates the rest)", () => {
    // b3 has no sodium/iron; the sum must reflect only the meals that published.
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open
        onClose={() => undefined}
      />,
    );
    const list = screen.getByTestId("meal-nutrition-micros-list");
    // Sodium reflects only b1 + b2 (200 + 150); b3's absence is not invented as 0-filled.
    expect(within(list).getByText("350mg")).toBeTruthy();
  });

  it("renders the slot-empty state when the slot has no items (mobile NO_SLOT_ITEMS parity)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Lunch", meals: [] }}
        open
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("meal-nutrition-slot-empty")).toHaveTextContent("Nothing in Lunch");
    // No breakdown rendered for an empty slot.
    expect(screen.queryByTestId("meal-nutrition-kcal")).toBeNull();
    expect(screen.queryByTestId("meal-nutrition-macro-bar")).toBeNull();
  });

  it("shows the slot-attributed empty micros copy when no slot item published micros", () => {
    const noMicros: MealNutritionMeal[] = [
      { id: "x1", name: "Lunch", recipeTitle: "Plain rice", calories: 200, protein: 4, carbs: 44, fat: 0, micros: null },
      { id: "x2", name: "Lunch", recipeTitle: "Steamed greens", calories: 50, protein: 3, carbs: 8, fat: 0, micros: null },
    ];
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Lunch", meals: noMicros }}
        open
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("meal-nutrition-micros-empty")).toHaveTextContent(
      "None of the entries in this slot included published vitamin or mineral data.",
    );
  });

  it("renders nothing when open is false (aggregate mode)", () => {
    render(
      <MealNutritionDialog
        meal={null}
        slotAggregate={{ slotLabel: "Breakfast", meals: SLOT_MEALS }}
        open={false}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByTestId("meal-nutrition-dialog")).toBeNull();
  });

  it("single-meal mode is unchanged when slotAggregate is omitted", () => {
    // Guard against the aggregate path leaking into single-meal rendering.
    render(<MealNutritionDialog meal={FULL_MEAL} open onClose={() => undefined} />);
    expect(screen.getByText("Salmon teriyaki bowl")).toBeTruthy();
    expect(screen.getByTestId("meal-nutrition-kcal")).toHaveTextContent("620 kcal");
    expect(screen.queryByTestId("meal-nutrition-aggregate-caption")).toBeNull();
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

describe("TodayMealsSection (web) — 'View slot nutrition' header affordance (ENG-837)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
    cleanup();
  });

  it("flag OFF (onOpenSlotNutrition omitted): no slot-nutrition affordance on any header", () => {
    render(<TodayMealsSection {...baseProps()} />);
    // Populated Dinner slot — still no affordance when the host didn't wire it.
    expect(screen.queryByTestId("today-slot-view-nutrition-Dinner")).toBeNull();
  });

  it("flag ON (handler wired): affordance renders on a POPULATED slot and calls the handler with the slot name", () => {
    const onOpenSlotNutrition = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenSlotNutrition })} />);
    const btn = screen.getByTestId("today-slot-view-nutrition-Dinner");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onOpenSlotNutrition).toHaveBeenCalledTimes(1);
    expect(onOpenSlotNutrition).toHaveBeenCalledWith("Dinner");
  });

  it("flag ON: NO affordance on an EMPTY slot (nothing to aggregate)", () => {
    const onOpenSlotNutrition = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenSlotNutrition })} />);
    // Breakfast / Lunch / Snacks are empty in baseProps → no slot-nutrition button.
    expect(screen.queryByTestId("today-slot-view-nutrition-Breakfast")).toBeNull();
    expect(screen.queryByTestId("today-slot-view-nutrition-Lunch")).toBeNull();
    expect(screen.queryByTestId("today-slot-view-nutrition-Snacks")).toBeNull();
  });

  it("clicking the affordance does NOT toggle slot collapse (stopPropagation)", () => {
    const onOpenSlotNutrition = vi.fn();
    const onToggleSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenSlotNutrition, onToggleSlot })} />);
    fireEvent.click(screen.getByTestId("today-slot-view-nutrition-Dinner"));
    expect(onOpenSlotNutrition).toHaveBeenCalledWith("Dinner");
    // The header's own onClick (toggle) must not have fired.
    expect(onToggleSlot).not.toHaveBeenCalled();
  });
});

// --- Source-check: the slot-aggregate affordance + dialog mount are gated ---
// behind `web_meal_nutrition_detail` in the host (ENG-837). The flag is a
// PostHog runtime flag (no static constant to assert), so we pin the gate at the
// source level: this regresses if anyone removes the `isFeatureEnabled` guard
// around either the slot affordance prop or the aggregate dialog mount, which
// would change flag-OFF behaviour (the non-negotiable: flag OFF == byte-identical
// to today). Mirrors the per-meal gate that shipped with gap #15.
describe("NutritionTracker host — slot-aggregate is flag-gated (ENG-837)", () => {
  const hostSource = readFileSync(
    join(process.cwd(), "src/app/components/NutritionTracker.tsx"),
    "utf8",
  );

  it("wires onOpenSlotNutrition only when web_meal_nutrition_detail is on", () => {
    // The slot affordance prop must be gated, falling back to undefined (flag off).
    const gated =
      /onOpenSlotNutrition=\{[\s\S]*?isFeatureEnabled\("web_meal_nutrition_detail"\)[\s\S]*?setSlotNutritionTarget[\s\S]*?:\s*undefined[\s\S]*?\}/;
    expect(hostSource).toMatch(gated);
  });

  it("mounts the slot-aggregate MealNutritionDialog only under web_meal_nutrition_detail", () => {
    // The aggregate dialog mount (the one passing slotAggregate) sits inside an
    // isFeatureEnabled("web_meal_nutrition_detail") guard.
    expect(hostSource).toMatch(/isFeatureEnabled\("web_meal_nutrition_detail"\)/);
    expect(hostSource).toMatch(/slotAggregate=\{/);
  });
});
