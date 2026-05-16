// @vitest-environment jsdom
/**
 * `TodayMealsSection` flag-gated `Log usual` row test (2026-05-15
 * crowder task).
 *
 * Coverage:
 *   1. Flag OFF (default) — chip renders inside the section header
 *      via the existing `Log usual: <name>` accessibilityLabel.
 *      Verifies the off-branch is unchanged from Ship M1.
 *   2. Flag ON — chip relocates to a dedicated row below the header.
 *      Same accessibilityLabel still resolves (one Pressable carrying
 *      that label).
 *   3. Flag ON — tapping the chip with exactly one saved meal calls
 *      `onLogSavedMeal(savedMeal, slot)`.
 *   4. Flag ON — affordance is reachable from a collapsed slot.
 *
 * The shim alias for `@/lib/analytics` is shadowed by the broader
 * `@` prefix alias in `vitest.config.ts`, so `vi.mock` per-file is the
 * reliable way to stub `isFeatureEnabled` here. Mirror pattern used by
 * `foodSearchNoResultLoopMobile.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { isFeatureEnabled } from "@/lib/analytics";
import type { JournalMeal } from "../../lib/nutritionJournal";
import type { SavedMeal } from "../../../../src/lib/nutrition/savedMeals";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

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
  onLogSavedMeal?: (meal: SavedMeal, slot: string) => void;
}) {
  const onLogSavedMeal = overrides.onLogSavedMeal ?? vi.fn();
  const utils = render(
    <TodayMealsSection
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
      mealGroups={{
        Breakfast: [],
        Lunch: [],
        Dinner: [],
        Snacks: [BASE_MEAL],
      }}
      mealsTodayCount={1}
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
      onLogSavedMeal={onLogSavedMeal}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
  return { ...utils, onLogSavedMeal };
}

describe("TodayMealsSection — today_log_usual_row_v2 flag", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("flag OFF (default): the Log usual pill renders for the slot", () => {
    flagFn.mockImplementation(() => false);
    const { getByLabelText } = renderSection({});
    expect(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    ).toBeTruthy();
  });

  it("flag ON: the Log usual pill still resolves by accessibilityLabel (relocated row)", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const { getByLabelText } = renderSection({});
    expect(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    ).toBeTruthy();
  });

  it("flag ON: tapping the pill calls onLogSavedMeal(savedMeal, slot)", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const onLogSavedMeal = vi.fn();
    const { getByLabelText } = renderSection({ onLogSavedMeal });
    fireEvent.press(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    );
    expect(onLogSavedMeal).toHaveBeenCalledTimes(1);
    expect(onLogSavedMeal).toHaveBeenCalledWith(
      PEANUT_BUTTER_SMOOTHIE,
      "Snacks",
    );
  });

  it("flag ON: the pill stays reachable when the slot is collapsed", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const { getByLabelText } = renderSection({
      collapsedSlots: new Set(["Snacks"]),
    });
    expect(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    ).toBeTruthy();
  });

  it("flag ON: testIDs are present (Maestro contract)", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const { getByTestId, queryByTestId } = renderSection({});
    // Stable locators for the Maestro validation flow at
    // apps/mobile/.maestro/validation/today_snacks_v2.yaml. If these
    // names change, update the flow too.
    expect(getByTestId("today-slot-Snacks")).toBeTruthy();
    expect(getByTestId("today-slot-header-Snacks")).toBeTruthy();
    expect(getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
    // Flag-on must NOT render the in-header variant.
    expect(queryByTestId("today-log-usual-pill-in-header-Snacks")).toBeNull();
  });

  it("flag OFF: the in-header pill testID is the one present", () => {
    flagFn.mockImplementation(() => false);
    const { getByTestId, queryByTestId } = renderSection({});
    expect(getByTestId("today-log-usual-pill-in-header-Snacks")).toBeTruthy();
    expect(queryByTestId("today-log-usual-row-Snacks")).toBeNull();
    expect(queryByTestId("today-log-usual-pill-Snacks")).toBeNull();
  });
});
