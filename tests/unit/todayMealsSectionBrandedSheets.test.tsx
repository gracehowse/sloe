// @vitest-environment jsdom
/**
 * TodayMealsSection + CopyMealDialog (web) — P5 parity cluster C8
 * (gaps #6, #7, #25, #27).
 *
 * Pairs with apps/mobile/components/today/TodayMealsSection.tsx
 * (MealActionSheet) and mobile's 2026-05-22 removal of the per-meal source
 * badge from the meal row.
 *
 * Asserts the web side of those parity decisions:
 *  - #6/#27: the meal "more actions" dropdown carries a branded header
 *    (SupprMark + thumbnail/title/macro line).
 *  - #7: the copy-meal dialog carries the same branded chrome.
 *  - #25: the per-meal NutritionSourceBadge (✓/✎ dingbats) no longer
 *    renders on the meal row (presence parity with mobile, which removed
 *    it 2026-05-22).
 *
 * ENG-1651 (2026-07-22): `redesign_branded_sheets` collapsed — the flag was
 * permanently ON via REDESIGN_DEFAULT_ON, so the branded chrome is the only
 * path now (the legacy bare-dropdown / plain-header paths are gone). The
 * flag mock below is kept only to prove that (see "gate removed" tests).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Radix's DropdownMenu uses Pointer Events + pointer capture, which jsdom
// does not implement. Stub the three capture methods + scrollIntoView once
// so `userEvent.click` can open the menu the way a real pointer would. This
// is test-local (it does not touch the shared tests/setup.ts).
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
  if (!proto.scrollIntoView) proto.scrollIntoView = () => undefined;
});

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";
import { CopyMealDialog } from "../../src/app/components/suppr/copy-meal-dialog";
import { isFeatureEnabled } from "../../src/lib/analytics/track";

void React;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const DINNER_MEAL: TodayMealSectionMeal = {
  id: "m-dinner",
  name: "Dinner",
  recipeTitle: "Salmon teriyaki bowl",
  calories: 620,
  protein: 42,
  carbs: 58,
  fat: 21,
  // A verified-tier source so the legacy NutritionSourceBadge WOULD render
  // if it were still wired — the strongest signal the badge is truly gone.
  source: "fatsecret",
};

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  return {
    mealsGrouped: [
      { name: "Breakfast", meals: [] },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [DINNER_MEAL] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: [DINNER_MEAL],
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
  await user.click(
    screen.getByLabelText("More actions for Salmon teriyaki bowl"),
  );
}

describe("TodayMealsSection (web) — source badge presence parity (#25)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("does NOT render the per-meal NutritionSourceBadge on the meal row", () => {
    render(<TodayMealsSection {...baseProps()} />);
    // The legacy badge renders "✓ Verified" for a fatsecret source. Its
    // absence is the parity assertion. The meal title still renders.
    expect(screen.getByText("Salmon teriyaki bowl")).toBeTruthy();
    expect(screen.queryByText(/Verified/)).toBeNull();
    expect(screen.queryByText(/✓ Verified/)).toBeNull();
  });

  it("gate removed: badge stays absent regardless of what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "redesign_branded_sheets",
    );
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.queryByText(/Verified/)).toBeNull();
  });
});

describe("TodayMealsSection (web) — branded kebab header (#6, #27)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("kebab dropdown renders SupprMark + title + macro header band", async () => {
    render(<TodayMealsSection {...baseProps()} />);
    await openKebab();
    const header = screen.getByTestId(
      "today-meal-action-branded-header-m-dinner",
    );
    expect(header).toBeTruthy();
    // Title in the branded header.
    expect(within(header).getByText("Salmon teriyaki bowl")).toBeTruthy();
    // Canonical macro trailer line ("620 kcal · 42g P · 58g C · 21g F").
    expect(
      within(header).getByText(/620 kcal · 42g P · 58g C · 21g F/),
    ).toBeTruthy();
    // The brand mark (svg with aria-label "Suppr") is present.
    expect(within(header).getByLabelText("Sloe")).toBeTruthy();
    // Legacy actions remain reachable under the branded chrome.
    expect(screen.getByText("Copy to another day…")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("gate removed: branded header renders regardless of what an isFeatureEnabled mock returns for the retired flag", async () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "redesign_branded_sheets",
    );
    render(<TodayMealsSection {...baseProps()} />);
    await openKebab();
    expect(
      screen.getByTestId("today-meal-action-branded-header-m-dinner"),
    ).toBeTruthy();
  });
});

describe("TodayMealsSection (web) — usual-picker brand mark (#6/#27) + motion (#22)", () => {
  const SAVED = {
    id: "saved-x",
    name: "Usual dinner",
    defaultMealSlot: "Dinner",
    items: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    lastLoggedAt: "2026-05-10T00:00:00.000Z",
    logCount: 2,
  };
  const SECOND = { ...SAVED, id: "saved-y", name: "Other usual" };

  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("opening the 2+ usual picker shows the SupprMark in the header", () => {
    render(
      <TodayMealsSection
        {...baseProps({ savedMeals: [SAVED, SECOND] })}
      />,
    );
    // 2+ saved meals open the picker rather than logging directly.
    fireEvent.click(
      screen.getByTestId("today-log-usual-pill-Dinner"),
    );
    expect(screen.getByTestId("usual-picker-branded-mark")).toBeTruthy();
  });
});

describe("CopyMealDialog (web) — branded chrome (#7)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("branded header with SupprMark + title + macro line", () => {
    render(
      <CopyMealDialog
        open
        onOpenChange={() => undefined}
        sourceDayKey="2026-05-20"
        mealLabel="Salmon teriyaki bowl"
        mealMacros={{ calories: 620, protein: 42, carbs: 58, fat: 21 }}
        onConfirm={() => undefined}
      />,
    );
    const header = screen.getByTestId("copy-meal-branded-header");
    expect(within(header).getByText("Salmon teriyaki bowl")).toBeTruthy();
    expect(
      within(header).getByText(/620 kcal · 42g P · 58g C · 21g F/),
    ).toBeTruthy();
    expect(within(header).getByLabelText("Sloe")).toBeTruthy();
  });

  it("gate removed: branded header renders regardless of what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "redesign_branded_sheets",
    );
    render(
      <CopyMealDialog
        open
        onOpenChange={() => undefined}
        sourceDayKey="2026-05-20"
        mealLabel="Salmon teriyaki bowl"
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByTestId("copy-meal-branded-header")).toBeTruthy();
  });
});
