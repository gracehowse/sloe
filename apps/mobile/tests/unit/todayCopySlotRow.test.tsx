// @vitest-environment jsdom
/**
 * `TodayMealsSection` (mobile) — ENG-786 rebuild "Copy to another day" row.
 *
 * Replaces `todayLogAgainRow.test.tsx` (deleted) — the old instant
 * same-slot-same-day "Log again" is gone. The host passes `onCopySlot`
 * ONLY when the `today_log_again` flag is on (flag key deliberately
 * unchanged per an explicit product ruling, even though the behavior it
 * gates is the rebuilt copy-to-another-day flow, not the old instant
 * relog — see `app/(tabs)/_today/TodayScreen.tsx` →
 * `onCopySlot={isFeatureEnabled("today_log_again") ? ... : undefined}`).
 * The component itself doesn't read the flag — it renders the row iff
 * `hasMeals && isOpen && onCopySlot`. So these tests simulate the host by
 * passing / omitting `onCopySlot`.
 *
 * Unlike the old row, the label no longer depends on `meals.length`
 * (always "Copy to another day" — it opens a destination sheet rather
 * than instantly cloning in place, so there's no singular/plural "this
 * item"/"these items" distinction to make).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { isFeatureEnabled } from "@/lib/analytics";
import type { JournalMeal } from "../../lib/nutritionJournal";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";

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
  onCopySlot?: (slot: string) => void;
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
      onCopySlot={overrides.onCopySlot}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
  return utils;
}

describe("TodayMealsSection (mobile) — ENG-786 rebuild Copy to another day row", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("prop omitted (flag off): the Copy row is absent", () => {
    const { queryByTestId } = renderSection({});
    expect(queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });

  it("prop wired, single item: row renders with 'Copy to another day'", () => {
    const { getByTestId, getByText } = renderSection({ onCopySlot: vi.fn() });
    expect(getByTestId("today-copy-slot-Snacks")).toBeTruthy();
    expect(getByText("Copy to another day")).toBeTruthy();
  });

  it("prop wired, multiple items: label stays 'Copy to another day' (no plural split)", () => {
    const { getByTestId, getByText } = renderSection({
      onCopySlot: vi.fn(),
      snackMeals: [GREEK_YOGURT, ALMOND_BUTTER],
    });
    expect(getByTestId("today-copy-slot-Snacks")).toBeTruthy();
    expect(getByText("Copy to another day")).toBeTruthy();
  });

  it("prop wired: tapping the row calls onCopySlot(slot)", () => {
    const onCopySlot = vi.fn();
    const { getByTestId } = renderSection({ onCopySlot });
    fireEvent.press(getByTestId("today-copy-slot-Snacks"));
    expect(onCopySlot).toHaveBeenCalledTimes(1);
    expect(onCopySlot).toHaveBeenCalledWith("Snacks");
  });

  it("prop wired but slot collapsed: the row is absent (mirrors web)", () => {
    const { queryByTestId } = renderSection({
      onCopySlot: vi.fn(),
      collapsedSlots: new Set(["Snacks"]),
    });
    expect(queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });

  it("prop wired but slot empty: no row for an empty slot", () => {
    const { queryByTestId } = renderSection({
      onCopySlot: vi.fn(),
      snackMeals: [],
    });
    expect(queryByTestId("today-copy-slot-Snacks")).toBeNull();
  });
});
