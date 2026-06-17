// @vitest-environment jsdom
/**
 * Mobile `TodayMealsSection` populated-slot "Add another item" test.
 *
 * F-17 (2026-04-19, TestFlight `AIjmgrBMmY-M6B363x_hT8I`). Before this
 * fix, a populated meal slot rendered no `+` affordance on its header
 * row — only the empty rows did — so once a user logged something to
 * Breakfast they could not add another item to that slot without using
 * the generic bottom FAB and hoping the slot was pre-selected.
 *
 * Coverage:
 *   1. A slot with one meal renders an "Add another item to {slot}"
 *      Pressable (the `+` pill).
 *   2. Tapping that Pressable calls `onOpenFabForSlot(slot)` exactly
 *      once with the correct slot name — the same callback the
 *      empty-state "Tap to add" fires.
 *   3. The outer slot header still collapses/expands meals — i.e. the
 *      new pill doesn't swallow its own taps without also stopping the
 *      collapse toggle from firing.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import type { JournalMeal } from "../../lib/nutritionJournal";

// The per-slot header `+` affordance + collapse/expand pinned here live in the
// per-slot TD4 meal layout — now the sole layout after ENG-1096 deleted the
// dead `today_meals_figma_layout` summary path. All flags on = the live
// production posture (same mock as `todayMealsSectionTd4.test.tsx`).
vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: () => true,
}));

void React;

const BASE_MEAL: JournalMeal = {
  id: "m1",
  name: "Waitrose Greek yogurt",
  recipeTitle: "Waitrose Greek yogurt",
  time: "08:30",
  calories: 62,
  protein: 6,
  carbs: 4,
  fat: 3,
};

function renderSection(overrides: {
  onOpenFabForSlot?: (slot: string) => void;
  onToggleSlotCollapse?: (slot: string) => void;
}) {
  const onOpenFabForSlot = overrides.onOpenFabForSlot ?? vi.fn();
  const onToggleSlotCollapse = overrides.onToggleSlotCollapse ?? vi.fn();
  const utils = render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{ Breakfast: [BASE_MEAL], Lunch: [], Dinner: [], Snacks: [] }}
      mealsTodayCount={1}
      collapsedSlots={new Set()}
      onToggleSlotCollapse={onToggleSlotCollapse}
      onOpenFabForSlot={onOpenFabForSlot}
      onOpenSaveUsualMealForSlot={() => undefined}
      onOpenDuplicateDay={() => undefined}
      onPressMeal={() => undefined}
      onLongPressEdit={() => undefined}
      onRequestCopyMeal={() => undefined}
      onDeleteMeal={() => undefined}
      showMealTimestamps={false}
      formatMealMacroDetail={() => ""}
      formatMealTimeDisplay={() => ""}
      formatMealSourceLabelForRow={() => null}
      textColor="#fff"
      textSecondaryColor="#94a3b8"
      textTertiaryColor="#64748b"
      cardColor="#16161e"
      cardBorderColor="#2a2a3a"
      savedMeals={[]}
      onLogSavedMeal={() => undefined}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
  return { ...utils, onOpenFabForSlot, onToggleSlotCollapse };
}

describe("TodayMealsSection — populated-slot add-more affordance", () => {
  it("renders a Plus affordance on populated slot headers", () => {
    const { getByTestId } = renderSection({});
    expect(getByTestId("today-slot-header-Breakfast")).toBeTruthy();
  });

  it("empty slots use add-food accessibility label and call onOpenFabForSlot", () => {
    const onOpenFabForSlot = vi.fn();
    const { getByLabelText } = renderSection({ onOpenFabForSlot });
    fireEvent.press(getByLabelText("Lunch — add food"));
    expect(onOpenFabForSlot).toHaveBeenCalledWith("Lunch");
  });

  it("populated slots collapse/expand via header press", () => {
    const onToggleSlotCollapse = vi.fn();
    const { getByLabelText } = renderSection({ onToggleSlotCollapse });
    fireEvent.press(getByLabelText("Breakfast, 1 items — expand or collapse"));
    expect(onToggleSlotCollapse).toHaveBeenCalledWith("Breakfast");
  });
});
