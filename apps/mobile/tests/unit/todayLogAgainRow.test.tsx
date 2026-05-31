// @vitest-environment jsdom
/**
 * `TodayMealsSection` (mobile) — ENG-786 "Log this/these again" row.
 *
 * The host passes `onLogAgain` ONLY when the `today_log_again` flag is on
 * (see `app/(tabs)/index.tsx` → `onLogAgain={isFeatureEnabled(...) ?
 * logAgainSlot : undefined}`). The component itself doesn't read the flag —
 * it renders the row iff `hasMeals && isOpen && onLogAgain`. So these tests
 * simulate the host by passing / omitting `onLogAgain`.
 *
 * Pairs with tests/unit/todayMealsSectionLogAgain.test.tsx (web). Same
 * matrix on both sides so the testID + label + flag-on/off contract can't
 * drift between platforms.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { isFeatureEnabled } from "@/lib/analytics";
import type { JournalMeal } from "../../lib/nutritionJournal";
import type { SavedMeal } from "@suppr/shared/nutrition/savedMeals";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const GREEK_YOGURT: JournalMeal = {
  id: "m1",
  name: "Snacks",
  recipeTitle: "Waitrose Greek yogurt",
  time: "08:30",
  calories: 62,
  protein: 6,
  carbs: 4,
  fat: 3,
};

const ALMOND_BUTTER: JournalMeal = {
  id: "m2",
  name: "Snacks",
  recipeTitle: "Almond butter",
  time: "08:31",
  calories: 98,
  protein: 3,
  carbs: 3,
  fat: 9,
};

const PEANUT_BUTTER_SMOOTHIE: SavedMeal = {
  id: "saved-1",
  name: "Peanut Butter Smoothie",
  defaultMealSlot: "Snacks",
  items: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  lastLoggedAt: "2026-05-10T00:00:00.000Z",
  logCount: 3,
};

function renderSection(overrides: {
  collapsedSlots?: Set<string>;
  onLogAgain?: (slot: string) => void;
  snackMeals?: JournalMeal[];
}) {
  const snackMeals = overrides.snackMeals ?? [GREEK_YOGURT];
  const utils = render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{
        Breakfast: [],
        Lunch: [],
        Dinner: [],
        Snacks: snackMeals,
      }}
      mealsTodayCount={snackMeals.length}
      collapsedSlots={overrides.collapsedSlots ?? new Set()}
      onToggleSlotCollapse={() => undefined}
      onOpenFabForSlot={() => undefined}
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
      savedMeals={[PEANUT_BUTTER_SMOOTHIE]}
      onLogSavedMeal={() => undefined}
      onLogAgain={overrides.onLogAgain}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
  return utils;
}

describe("TodayMealsSection (mobile) — ENG-786 Log again row", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("prop omitted (flag off): the Log again row is absent", () => {
    const { queryByTestId } = renderSection({});
    expect(queryByTestId("today-log-again-Snacks")).toBeNull();
  });

  it("prop wired, single item: row renders with 'Log this again'", () => {
    const { getByTestId, getByText } = renderSection({ onLogAgain: vi.fn() });
    expect(getByTestId("today-log-again-Snacks")).toBeTruthy();
    expect(getByText("Log this again")).toBeTruthy();
  });

  it("prop wired, multiple items: row renders with 'Log these again'", () => {
    const { getByTestId, getByText } = renderSection({
      onLogAgain: vi.fn(),
      snackMeals: [GREEK_YOGURT, ALMOND_BUTTER],
    });
    expect(getByTestId("today-log-again-Snacks")).toBeTruthy();
    expect(getByText("Log these again")).toBeTruthy();
  });

  it("prop wired: tapping the row calls onLogAgain(slot)", () => {
    const onLogAgain = vi.fn();
    const { getByTestId } = renderSection({ onLogAgain });
    fireEvent.press(getByTestId("today-log-again-Snacks"));
    expect(onLogAgain).toHaveBeenCalledTimes(1);
    expect(onLogAgain).toHaveBeenCalledWith("Snacks");
  });

  it("prop wired but slot collapsed: the row is absent (mirrors web)", () => {
    const { queryByTestId } = renderSection({
      onLogAgain: vi.fn(),
      collapsedSlots: new Set(["Snacks"]),
    });
    expect(queryByTestId("today-log-again-Snacks")).toBeNull();
  });

  it("prop wired but slot empty: no row for an empty slot", () => {
    const { queryByTestId } = renderSection({
      onLogAgain: vi.fn(),
      snackMeals: [],
    });
    expect(queryByTestId("today-log-again-Snacks")).toBeNull();
  });
});
