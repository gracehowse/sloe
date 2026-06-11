// @vitest-environment jsdom
/**
 * Swipe-to-delete on Today meal rows — Figma 654 layout (production default).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TodayMealsSection from "../../components/today/TodayMealsSection";
import type { JournalMeal } from "@/lib/nutritionJournal";

void React;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag === "today_meals_figma_654",
}));

const NOOP = () => undefined;

function journalMeal(over: Partial<JournalMeal> & { id: string }): JournalMeal {
  return {
    recipeTitle: "Oats",
    calories: 200,
    protein: 8,
    carbs: 30,
    fat: 4,
    name: "Breakfast",
    time: "08:00",
    ...over,
  } as JournalMeal;
}

describe("TodayMealsSection (mobile) — swipe delete on Figma layout", () => {
  it("exposes Remove meal on expanded rows when two items differ from header title", () => {
    const onDeleteMeal = vi.fn();
    const primary = journalMeal({ id: "m1", recipeTitle: "Oats" });
    const secondary = journalMeal({ id: "m2", recipeTitle: "Eggs", calories: 140 });
    render(
      <TodayMealsSection
        slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
        mealGroups={{ Breakfast: [primary, secondary], Lunch: [], Dinner: [], Snacks: [] }}
        mealsTodayCount={2}
        collapsedSlots={new Set()}
        onToggleSlotCollapse={NOOP}
        onOpenFabForSlot={NOOP}
        onOpenSaveUsualMealForSlot={NOOP}
        onOpenDuplicateDay={NOOP}
        onPressMeal={NOOP}
        onLongPressEdit={NOOP}
        onRequestCopyMeal={NOOP}
        onDeleteMeal={onDeleteMeal}
        showMealTimestamps={false}
        formatMealMacroDetail={() => ""}
        formatMealTimeDisplay={() => ""}
        formatMealSourceLabelForRow={() => null}
        textColor="#111"
        textSecondaryColor="#666"
        textTertiaryColor="#999"
        cardColor="#fff"
        cardBorderColor="#ddd"
        savedMeals={[]}
        onLogSavedMeal={NOOP}
        hintVisibleForSlot={() => false}
        onDismissUsualMealHint={NOOP}
        onAcceptUsualMealHint={NOOP}
      />,
    );
    const removeButtons = screen.getAllByLabelText("Remove meal");
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.press(removeButtons[0]!);
    expect(onDeleteMeal).toHaveBeenCalledWith("m1");
  });

  it("opens meal nutrition when the Figma summary row is tapped", () => {
    const onPressMeal = vi.fn();
    const only = journalMeal({ id: "solo", recipeTitle: "Greek yogurt" });
    render(
      <TodayMealsSection
        slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
        mealGroups={{ Breakfast: [only], Lunch: [], Dinner: [], Snacks: [] }}
        mealsTodayCount={1}
        collapsedSlots={new Set()}
        onToggleSlotCollapse={NOOP}
        onOpenFabForSlot={NOOP}
        onOpenSaveUsualMealForSlot={NOOP}
        onOpenDuplicateDay={NOOP}
        onPressMeal={onPressMeal}
        onLongPressEdit={NOOP}
        onRequestCopyMeal={NOOP}
        onDeleteMeal={NOOP}
        showMealTimestamps={false}
        formatMealMacroDetail={() => ""}
        formatMealTimeDisplay={() => ""}
        formatMealSourceLabelForRow={() => null}
        textColor="#111"
        textSecondaryColor="#666"
        textTertiaryColor="#999"
        cardColor="#fff"
        cardBorderColor="#ddd"
        savedMeals={[]}
        onLogSavedMeal={NOOP}
        hintVisibleForSlot={() => false}
        onDismissUsualMealHint={NOOP}
        onAcceptUsualMealHint={NOOP}
      />,
    );
    fireEvent.press(screen.getByTestId("today-meals-figma-meal-row-Breakfast"));
    expect(onPressMeal).toHaveBeenCalledWith("solo");
  });

  it("exposes Remove meal on the summary card when a slot has only one item", () => {
    const onDeleteMeal = vi.fn();
    const only = journalMeal({ id: "solo", recipeTitle: "Greek yogurt" });
    render(
      <TodayMealsSection
        slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
        mealGroups={{ Breakfast: [only], Lunch: [], Dinner: [], Snacks: [] }}
        mealsTodayCount={1}
        collapsedSlots={new Set()}
        onToggleSlotCollapse={NOOP}
        onOpenFabForSlot={NOOP}
        onOpenSaveUsualMealForSlot={NOOP}
        onOpenDuplicateDay={NOOP}
        onPressMeal={NOOP}
        onLongPressEdit={NOOP}
        onRequestCopyMeal={NOOP}
        onDeleteMeal={onDeleteMeal}
        showMealTimestamps={false}
        formatMealMacroDetail={() => ""}
        formatMealTimeDisplay={() => ""}
        formatMealSourceLabelForRow={() => null}
        textColor="#111"
        textSecondaryColor="#666"
        textTertiaryColor="#999"
        cardColor="#fff"
        cardBorderColor="#ddd"
        savedMeals={[]}
        onLogSavedMeal={NOOP}
        hintVisibleForSlot={() => false}
        onDismissUsualMealHint={NOOP}
        onAcceptUsualMealHint={NOOP}
      />,
    );
    fireEvent.press(screen.getByLabelText("Remove meal"));
    expect(onDeleteMeal).toHaveBeenCalledWith("solo");
  });
});
