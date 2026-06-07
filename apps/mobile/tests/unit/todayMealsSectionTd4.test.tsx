// @vitest-environment jsdom
/**
 * `TodayMealsSection` — Sloe TD4 · Meal log re-skin (Today re-skin unit 2,
 * 2026-06-03). Figma 481:2 / `docs/prototypes/stitch-sloe/today-meallog.html`.
 *
 * The TD4 frame turns each meal slot into its own card with: a Newsreader
 * meal name + total kcal + per-meal coloured macro grams, a Log-usual pill,
 * food rows (dot · name · kcal · chevron), and an in-card `+ Add food` action.
 *
 * This file pins the NEW behaviour the re-skin introduced (the pre-existing
 * contracts — slot colours, add-more, Log-usual, Log-again, branded sheet —
 * stay covered by their own files, all still green):
 *   1. A populated, open slot renders an in-card `Add food` action
 *      (`today-add-food-{slot}`) that routes through `onOpenFabForSlot(slot)`
 *      — the SAME handler the empty-slot header tap fires (no new data path).
 *   2. That action is absent on an EMPTY slot (empty slots keep their
 *      header-as-tap-target; no card body) and absent when the slot is
 *      COLLAPSED (the body is hidden).
 *   3. The slot header renders the per-meal macro grams + total kcal (the
 *      `SlotMacroChips` row) for a populated slot.
 *   4. The empty-slot header tap STILL calls `onOpenFabForSlot` via the
 *      `"{slot} — add food"` label (the TD4 card must not regress the
 *      empty-slot add path).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import type { JournalMeal } from "../../lib/nutritionJournal";

vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag !== "today_meals_figma_654",
}));

void React;

const NOOP = () => undefined;

const HAM_TOASTIE: JournalMeal = {
  id: "m1",
  name: "Breakfast",
  recipeTitle: "McAlister's Deli · Ham and Cheese Toastie",
  time: "08:30",
  calories: 217,
  protein: 12,
  carbs: 20,
  fat: 9,
  fiberG: 0.6,
};

function renderSection(overrides: {
  breakfast?: JournalMeal[];
  collapsedSlots?: Set<string>;
  onOpenFabForSlot?: (slot: string) => void;
}) {
  const onOpenFabForSlot = overrides.onOpenFabForSlot ?? vi.fn();
  const utils = render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{
        Breakfast: overrides.breakfast ?? [HAM_TOASTIE],
        Lunch: [],
        Dinner: [],
        Snacks: [],
      }}
      mealsTodayCount={(overrides.breakfast ?? [HAM_TOASTIE]).length}
      collapsedSlots={overrides.collapsedSlots ?? new Set()}
      onToggleSlotCollapse={NOOP}
      onOpenFabForSlot={onOpenFabForSlot}
      onOpenSaveUsualMealForSlot={NOOP}
      onOpenDuplicateDay={NOOP}
      onPressMeal={NOOP}
      onLongPressEdit={NOOP}
      onRequestCopyMeal={NOOP}
      onDeleteMeal={NOOP}
      showMealTimestamps={false}
      formatMealMacroDetail={() => ""}
      formatMealTimeDisplay={() => ""}
      formatMealSourceLabelForRow={() => null}
      textColor="#221B26"
      textSecondaryColor="#6A6072"
      textTertiaryColor="#9B93A3"
      cardColor="#F6F5F2"
      cardBorderColor="#E8E2EC"
      savedMeals={[]}
      onLogSavedMeal={NOOP}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={NOOP}
      onAcceptUsualMealHint={NOOP}
    />,
  );
  return { ...utils, onOpenFabForSlot };
}

describe("TodayMealsSection — TD4 in-card Add food action", () => {
  it("renders an Add food action on a populated, open slot", () => {
    const { getByTestId } = renderSection({});
    expect(getByTestId("today-add-food-Breakfast")).toBeTruthy();
  });

  it("Add food routes through onOpenFabForSlot(slot) — the canonical add-to-slot handler", () => {
    const onOpenFabForSlot = vi.fn();
    const { getByTestId } = renderSection({ onOpenFabForSlot });
    fireEvent.press(getByTestId("today-add-food-Breakfast"));
    expect(onOpenFabForSlot).toHaveBeenCalledTimes(1);
    expect(onOpenFabForSlot).toHaveBeenCalledWith("Breakfast");
  });

  it("does NOT render an Add food action on an empty slot", () => {
    const { queryByTestId } = renderSection({});
    // Lunch is empty in the base fixture — its card is header-only.
    expect(queryByTestId("today-add-food-Lunch")).toBeNull();
  });

  it("does NOT render an Add food action when the slot is collapsed", () => {
    const { queryByTestId } = renderSection({
      collapsedSlots: new Set(["Breakfast"]),
    });
    expect(queryByTestId("today-add-food-Breakfast")).toBeNull();
  });

  it("Add food carries an explicit per-slot accessibility label", () => {
    const { getByLabelText } = renderSection({});
    expect(getByLabelText("Add food to Breakfast")).toBeTruthy();
  });
});

describe("TodayMealsSection — TD4 per-meal macro grams", () => {
  it("renders the slot total kcal + per-macro grams in the header", () => {
    const { getByText, queryAllByText } = renderSection({});
    // Total kcal for the slot (single 217 kcal meal).
    expect(getByText("217 kcal")).toBeTruthy();
    // Coloured macro grams (protein 12g, carbs 20g, fat 9g). The food row
    // also shows the meal's own kcal, so we assert the gram chips exist.
    expect(queryAllByText("12g").length).toBeGreaterThan(0);
    expect(queryAllByText("20g").length).toBeGreaterThan(0);
    expect(queryAllByText("9g").length).toBeGreaterThan(0);
    // Fibre chip (0.6g) renders only when > 0 — it is here.
    expect(queryAllByText("0.6g").length).toBeGreaterThan(0);
  });

  it("omits the fibre chip when the slot has no fibre", () => {
    const noFibre: JournalMeal = { ...HAM_TOASTIE, fiberG: 0, micros: null };
    const { queryByText } = renderSection({ breakfast: [noFibre] });
    expect(queryByText("0.6g")).toBeNull();
    // Protein/carbs/fat still present.
    expect(queryByText("12g")).toBeTruthy();
  });
});

describe("TodayMealsSection — TD4 empty-slot add path preserved", () => {
  it("tapping an empty slot header still calls onOpenFabForSlot", () => {
    const onOpenFabForSlot = vi.fn();
    const { getByLabelText } = renderSection({ onOpenFabForSlot });
    fireEvent.press(getByLabelText("Lunch — add food"));
    expect(onOpenFabForSlot).toHaveBeenCalledWith("Lunch");
  });
});

describe("TodayMealsSection — no forbidden 'Today's Meals' section title", () => {
  // The Sloe prototype shows a "Today's Meals" header, but that exact string
  // is on FORBIDDEN_TODAY_PHRASES (calm-tone + landing-parity lock). The
  // convention is per-slot headers only. This pins that we did NOT introduce
  // the forbidden generic title (which `todayCopyParity.test.ts` would also
  // catch) and that the per-slot Newsreader headers carry the meals section.
  it("does not render a generic 'Today's Meals' / 'Today’s Meals' title", () => {
    const { queryByText, getByText } = renderSection({});
    expect(queryByText("Today's Meals")).toBeNull();
    expect(queryByText("Today’s Meals")).toBeNull();
    // The per-slot header (Breakfast) is the meals-section affordance instead.
    expect(getByText("Breakfast")).toBeTruthy();
  });
});
