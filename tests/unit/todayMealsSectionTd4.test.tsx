// @vitest-environment jsdom
/**
 * TodayMealsSection (web) — Sloe TD4 per-slot cards parity with mobile.
 *
 * After ENG-1096 (2026-06-17) the off-by-default `today_meals_figma_layout`
 * summary layout was deleted; the per-slot card list pinned here is the SOLE
 * Today meals layout. The source-pin block at the bottom locks the deletion.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  TodayMealsSection,
  type TodayMealSectionMeal,
  type TodayMealsSectionProps,
} from "../../src/app/components/suppr/today-meals-section";

// All flags on = the live production posture (the figma flag no longer exists).
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

function baseProps(
  overrides: Partial<TodayMealsSectionProps> = {},
): TodayMealsSectionProps {
  const breakfast = overrides.mealsGrouped?.[0]?.meals ?? [HAM];
  return {
    mealsGrouped: overrides.mealsGrouped ?? [
      { name: "Breakfast", meals: breakfast },
      { name: "Lunch", meals: [] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [] },
    ],
    mealsForSelectedDate: overrides.mealsForSelectedDate ?? breakfast,
    effectiveCalorieTarget: 2000,
    fiberTarget: 30,
    collapsedSlots: overrides.collapsedSlots ?? new Set(),
    onToggleSlot: vi.fn(),
    onOpenAddForSlot: overrides.onOpenAddForSlot ?? vi.fn(),
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

describe("TodayMealsSection — TD4 per-slot cards (web)", () => {
  it("renders Sloe TD4 section title (Newsreader Today's Meals)", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-meals-section-header")).toHaveTextContent(
      "Today's Meals",
    );
  });

  it("renders each slot as its own card with today-add-food on populated open slots", () => {
    render(<TodayMealsSection {...baseProps()} />);
    expect(screen.getByTestId("today-slot-Breakfast")).toBeTruthy();
    expect(screen.getByTestId("today-slot-Lunch")).toBeTruthy();
    expect(screen.getByTestId("today-add-food-Breakfast")).toBeTruthy();
    expect(screen.queryByTestId("today-add-food-Lunch")).toBeNull();
  });

  it("Add food routes through onOpenAddForSlot(slot)", () => {
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-add-food-Breakfast"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Breakfast");
  });

  it("empty slot header tap opens add for slot", () => {
    const onOpenAddForSlot = vi.fn();
    render(<TodayMealsSection {...baseProps({ onOpenAddForSlot })} />);
    fireEvent.click(screen.getByTestId("today-slot-header-Lunch"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Lunch");
  });

  it("hides Add food when slot is collapsed", () => {
    render(
      <TodayMealsSection
        {...baseProps({ collapsedSlots: new Set(["Breakfast"]) })}
      />,
    );
    expect(screen.queryByTestId("today-add-food-Breakfast")).toBeNull();
  });

  // F-160 / flat-card surfaces (2026-06-12 decision) — the in-card Add food
  // affordance is the FIRST quiet-fill adoption (web `bg-fill-quiet` ↔ mobile
  // `colors.fillQuiet`). With the card now FLAT a bare text link floats; the
  // action sits on the quiet-fill token inside a contained borderless pill.
  // This pins the quiet-fill class and that no card-surface border is drawn.
  it("Add food is a quiet-fill pill (bg-fill-quiet, no border) — flat-card surfaces parity", () => {
    render(<TodayMealsSection {...baseProps()} />);
    const addFood = screen.getByTestId("today-add-food-Breakfast");
    expect(addFood.className).toContain("bg-fill-quiet");
    expect(addFood.className).toContain("rounded-lg");
    // No surface border class — separation is the quiet fill, not an edge.
    expect(addFood.className).not.toMatch(/\bborder\b/);
  });
});

describe("ENG-1096 — dead Figma summary layout is fully removed (web + mobile)", () => {
  const ROOT = resolve(__dirname, "../..");
  const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
  const WEB_SECTION = read("src/app/components/suppr/today-meals-section.tsx");
  const MOBILE_SECTION = read(
    "apps/mobile/components/today/TodayMealsSection.tsx",
  );

  it("neither section reads the today_meals_figma_layout flag", () => {
    expect(WEB_SECTION).not.toMatch(/today_meals_figma_layout/);
    expect(MOBILE_SECTION).not.toMatch(/today_meals_figma_layout/);
  });

  it("neither section imports the deleted TodayMealsFigmaLayout component", () => {
    expect(WEB_SECTION).not.toMatch(/TodayMealsFigmaLayout/);
    expect(MOBILE_SECTION).not.toMatch(/TodayMealsFigmaLayout/);
  });

  it("the dead figma layout component files no longer exist", () => {
    const exists = (rel: string) => {
      try {
        readFileSync(resolve(ROOT, rel), "utf8");
        return true;
      } catch {
        return false;
      }
    };
    expect(exists("src/app/components/suppr/today-meals-figma-layout.tsx")).toBe(
      false,
    );
    expect(
      exists("apps/mobile/components/today/TodayMealsFigmaLayout.tsx"),
    ).toBe(false);
  });
});
