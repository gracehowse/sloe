// @vitest-environment jsdom
/**
 * `TodayMealsSection` (mobile) — ENG-799 branded meal action sheet.
 *
 * Long-pressing a meal row opens the branded cream sheet
 * (`meal-action-sheet`) with a thumbnail/name/macro header and four action
 * rows (Edit / Copy / Share / Delete). Each action closes the sheet and
 * defers to the matching host handler.
 *
 * ENG-1651 (2026-07-22): `redesign_branded_sheets` collapsed — the flag was
 * permanently ON via REDESIGN_DEFAULT_ON, so the branded sheet is the only
 * long-press path now (the legacy raw iOS `Alert.alert` path is gone).
 *
 * These tests pin: the open path, the macro-preview header, the four rows,
 * and that Edit / Copy / Delete call the host handlers.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { isFeatureEnabled } from "@/lib/analytics";
import type { JournalMeal } from "../../lib/nutritionJournal";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const PORRIDGE: JournalMeal = {
  id: "m1",
  name: "Breakfast",
  recipeTitle: "Overnight oats & berries",
  time: "08:30",
  calories: 312,
  protein: 14,
  carbs: 46,
  fat: 8,
};

function renderSection(overrides: {
  onLongPressEdit?: (m: JournalMeal) => void;
  onRequestCopyMeal?: (id: string) => void;
  onDeleteMeal?: (id: string) => void;
}) {
  return render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{ Breakfast: [PORRIDGE], Lunch: [], Dinner: [], Snacks: [] }}
      mealsTodayCount={1}
      collapsedSlots={new Set()}
      onToggleSlotCollapse={() => undefined}
      onOpenFabForSlot={() => undefined}
      onOpenSaveUsualMealForSlot={() => undefined}
      onOpenDuplicateDay={() => undefined}
      onPressMeal={() => undefined}
      onLongPressEdit={overrides.onLongPressEdit ?? (() => undefined)}
      onRequestCopyMeal={overrides.onRequestCopyMeal ?? (() => undefined)}
      onDeleteMeal={overrides.onDeleteMeal ?? (() => undefined)}
      showMealTimestamps={false}
      formatMealMacroDetail={() => "312 kcal · 14g P · 46g C · 8g F"}
      formatMealTimeDisplay={() => ""}
      formatMealSourceLabelForRow={() => null}
      textColor="#221B26"
      textSecondaryColor="#6A6072"
      textTertiaryColor="#9B93A3"
      cardColor="#ffffff"
      cardBorderColor="#E8E2EC"
      savedMeals={[]}
      onLogSavedMeal={() => undefined}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
}

describe("TodayMealsSection (mobile) — ENG-799 branded meal action sheet", () => {
  beforeEach(() => {
    flagFn.mockReset();
    flagFn.mockImplementation(() => false);
  });

  it("long-press opens the branded sheet with the four action rows", () => {
    const { getByText, getByTestId } = renderSection({});
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    expect(getByTestId("meal-action-sheet")).toBeTruthy();
    expect(getByTestId("meal-action-edit")).toBeTruthy();
    expect(getByTestId("meal-action-copy")).toBeTruthy();
    expect(getByTestId("meal-action-share")).toBeTruthy();
    expect(getByTestId("meal-action-delete")).toBeTruthy();
    expect(getByTestId("meal-action-cancel")).toBeTruthy();
  });

  it("gate removed: opens the branded sheet regardless of what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation((f: string) => f === "redesign_branded_sheets");
    const { getByText, getByTestId } = renderSection({});
    fireEvent(getByText("Overnight oats & berries"), "longPress");
    expect(getByTestId("meal-action-sheet")).toBeTruthy();
  });

  it("the sheet header shows the meal name + kcal·P/C/F preview", () => {
    const { getByText, getAllByText } = renderSection({});
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    // Name appears both on the row and in the sheet header.
    expect(getAllByText("Overnight oats & berries").length).toBeGreaterThanOrEqual(1);
    // Canonical macro trailer built from the meal's own macros.
    expect(getByText("312 kcal · 14g P · 46g C · 8g F")).toBeTruthy();
    // Delete sublabel surfaces the kcal removed.
    expect(getByText("Removes 312 kcal from today")).toBeTruthy();
  });

  it("Edit row closes the sheet and calls onLongPressEdit(meal)", () => {
    const onLongPressEdit = vi.fn();
    const { getByText, getByTestId, queryByTestId } = renderSection({ onLongPressEdit });
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    fireEvent.press(getByTestId("meal-action-edit"));
    expect(onLongPressEdit).toHaveBeenCalledTimes(1);
    expect(onLongPressEdit).toHaveBeenCalledWith(PORRIDGE);
    expect(queryByTestId("meal-action-sheet")).toBeNull();
  });

  it("Copy row calls onRequestCopyMeal(id)", () => {
    const onRequestCopyMeal = vi.fn();
    const { getByText, getByTestId } = renderSection({ onRequestCopyMeal });
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    fireEvent.press(getByTestId("meal-action-copy"));
    expect(onRequestCopyMeal).toHaveBeenCalledWith("m1");
  });

  it("Delete row calls onDeleteMeal(id)", () => {
    const onDeleteMeal = vi.fn();
    const { getByText, getByTestId } = renderSection({ onDeleteMeal });
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    fireEvent.press(getByTestId("meal-action-delete"));
    expect(onDeleteMeal).toHaveBeenCalledWith("m1");
  });

  it("Cancel closes the sheet without calling any host action", () => {
    const onDeleteMeal = vi.fn();
    const onLongPressEdit = vi.fn();
    const { getByText, getByTestId, queryByTestId } = renderSection({
      onDeleteMeal,
      onLongPressEdit,
    });
    fireEvent(getByText("Overnight oats & berries"), "longPress");

    fireEvent.press(getByTestId("meal-action-cancel"));
    expect(queryByTestId("meal-action-sheet")).toBeNull();
    expect(onDeleteMeal).not.toHaveBeenCalled();
    expect(onLongPressEdit).not.toHaveBeenCalled();
  });
});
