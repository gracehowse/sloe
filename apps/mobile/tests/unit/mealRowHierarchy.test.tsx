// @vitest-environment jsdom
/**
 * ENG-1524 — meal-row hierarchy (mobile).
 *
 * The tracker's point is the energy figure, but the pre-1524 row whispered it:
 * the kcal value rendered at `Type.caption` (11pt) in secondary ink — the same
 * size as the timestamp and quieter than the food name — while the row divider
 * used a `cardBorderColor + "08"` (≈3% alpha) concat that was effectively
 * invisible, so a slot's food rows read as one undivided block.
 *
 * This pins the corrected hierarchy:
 *   1. The kcal numeral is promoted to `Type.headline` (17pt) in PRIMARY ink,
 *      tabular-nums, anchored to the row's right edge.
 *   2. The "kcal" unit is a small TERTIARY suffix beside the numeral.
 *   3. The food name steps back to the SECONDARY ink tier (still `Type.body`).
 *   4. The row divider is a real hairline of the border token itself — no
 *      alpha-concat.
 *   5. The row's accessibility label folds in the kcal (the row Pressable
 *      aggregates its children for VoiceOver, so the numeral alone isn't read).
 */
import * as React from "react";
import { StyleSheet } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { Type } from "../../constants/theme";
import type { JournalMeal } from "../../lib/nutritionJournal";

vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: () => true,
}));

void React;

const NOOP = () => undefined;

const TEXT = "#221B26";
const TEXT_SECONDARY = "#6A6072";
const TEXT_TERTIARY = "#9B93A3";
const CARD_BORDER = "#E8E2EC";

const HAM_TOASTIE: JournalMeal = {
  id: "m1",
  name: "Breakfast",
  recipeTitle: "Ham and Cheese Toastie",
  time: "08:30",
  calories: 217,
  protein: 12,
  carbs: 20,
  fat: 9,
  fiberG: 0.6,
};

function renderSection() {
  return render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{ Breakfast: [HAM_TOASTIE], Lunch: [], Dinner: [], Snacks: [] }}
      mealsTodayCount={1}
      collapsedSlots={new Set()}
      onToggleSlotCollapse={NOOP}
      onOpenFabForSlot={NOOP}
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
      textColor={TEXT}
      textSecondaryColor={TEXT_SECONDARY}
      textTertiaryColor={TEXT_TERTIARY}
      cardColor="#FFFFFF"
      cardBorderColor={CARD_BORDER}
      savedMeals={[]}
      onLogSavedMeal={NOOP}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={NOOP}
      onAcceptUsualMealHint={NOOP}
    />,
  );
}

describe("TodayMealsSection — ENG-1524 meal-row hierarchy", () => {
  it("promotes the row kcal to a Type.headline primary numeral (tabular-nums)", () => {
    const { getByTestId } = renderSection();
    const kcal = getByTestId("today-meal-kcal-m1");
    const style = StyleSheet.flatten(kcal.props.style) as {
      fontSize?: number;
      color?: string;
      fontVariant?: string[];
    };
    expect(kcal.props.children).toBe(217);
    // Headline weight (17pt), not the whispered caption (11pt).
    expect(style.fontSize).toBe(Type.headline.fontSize);
    // Primary ink — the loudest value on the row.
    expect(style.color).toBe(TEXT);
    expect(style.fontVariant).toContain("tabular-nums");
  });

  it("keeps a small tertiary 'kcal' unit beside the numeral", () => {
    const { getByText } = renderSection();
    // Exact-match: the header chip renders "217 kcal" as one node, so the bare
    // "kcal" node is the meal-row suffix.
    const unit = getByText("kcal");
    const style = StyleSheet.flatten(unit.props.style) as {
      fontSize?: number;
      color?: string;
    };
    expect(style.fontSize).toBe(Type.caption.fontSize);
    expect(style.color).toBe(TEXT_TERTIARY);
  });

  it("demotes the food name to the secondary ink tier (still Type.body)", () => {
    const { getByText } = renderSection();
    const name = getByText("Ham and Cheese Toastie");
    const style = StyleSheet.flatten(name.props.style) as {
      fontSize?: number;
      color?: string;
    };
    expect(style.color).toBe(TEXT_SECONDARY);
    expect(style.fontSize).toBe(Type.body.fontSize);
  });

  it("draws a real hairline row divider from the border token (no alpha-concat)", () => {
    const { getByTestId } = renderSection();
    const row = getByTestId("today-meal-row-m1");
    const style = StyleSheet.flatten(row.props.style) as {
      borderBottomColor?: string;
      borderBottomWidth?: number;
    };
    expect(style.borderBottomColor).toBe(CARD_BORDER);
    // Guard against the old `cardBorderColor + "08"` alpha concat.
    expect(style.borderBottomColor).not.toContain("08");
    expect(style.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
  });

  it("folds the kcal into the row's accessibility label (VoiceOver reads the value)", () => {
    const { getByLabelText } = renderSection();
    expect(
      getByLabelText("Ham and Cheese Toastie, 217 kcal"),
    ).toBeTruthy();
  });
});
