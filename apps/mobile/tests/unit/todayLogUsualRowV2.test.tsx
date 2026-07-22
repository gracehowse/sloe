// @vitest-environment jsdom
/**
 * `TodayMealsSection` dedicated `Log usual` row test (2026-05-15
 * crowder task).
 *
 * ENG-1651 (round 2, slice 3, 2026-07-22): the `today_log_usual_row_v2`
 * flag gate was collapsed — the dedicated-row layout (chip below the
 * section header, not inline in the header trailing cluster) now ships
 * unconditionally and the legacy in-header pill is gone.
 *
 * Coverage:
 *   1. The chip renders in the dedicated row below the header via the
 *      `Log usual: <name>` accessibilityLabel.
 *   2. Tapping the chip with exactly one saved meal calls
 *      `onLogSavedMeal(savedMeal, slot)`.
 *   3. The affordance is reachable from a collapsed slot.
 *   4. Rendering does not depend on what an `isFeatureEnabled` mock
 *      returns for the retired flag name (gate removed).
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
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";

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

// Second Snacks usual — present only in the ENG-783 picker test so the
// pill resolves to ≥2 options and opens the usual-picker Modal instead
// of logging the single primary directly.
const TRAIL_MIX_SNACK: SavedMeal = {
  id: "saved-2",
  name: "Trail Mix",
  defaultMealSlot: "Snacks",
  items: [],
  createdAt: "2026-05-02T00:00:00.000Z",
  lastLoggedAt: "2026-05-05T00:00:00.000Z",
  logCount: 1,
};

function renderSection(overrides: {
  collapsedSlots?: Set<string>;
  onLogSavedMeal?: (meal: SavedMeal, slot: string) => void;
  /** ENG-783 — host passes this only when `today-edit-entry-v2` is on. */
  onRequestPortion?: (meal: SavedMeal, slot: string) => void;
  savedMeals?: readonly SavedMeal[];
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
      savedMeals={overrides.savedMeals ?? [PEANUT_BUTTER_SMOOTHIE]}
      onLogSavedMeal={onLogSavedMeal}
      onRequestPortion={overrides.onRequestPortion}
      hintVisibleForSlot={() => false}
      onDismissUsualMealHint={() => undefined}
      onAcceptUsualMealHint={() => undefined}
    />,
  );
  return { ...utils, onLogSavedMeal };
}

describe("TodayMealsSection — empty day (ENG-635)", () => {
  beforeEach(() => {
    flagFn.mockReturnValue(false);
  });

  it("hides Log usual pills when mealsTodayCount is 0 even if saved meals exist", () => {
    const { queryByLabelText } = render(
      <TodayMealsSection
        slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
        mealGroups={{ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }}
        mealsTodayCount={0}
        collapsedSlots={new Set()}
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
        hintVisibleForSlot={() => false}
        onDismissUsualMealHint={() => undefined}
        onAcceptUsualMealHint={() => undefined}
      />,
    );
    expect(queryByLabelText(/Log usual/i)).toBeNull();
  });
});

describe("TodayMealsSection — Log usual row (ENG-1651: today_log_usual_row_v2 permanently ON)", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("the Log usual pill renders for the slot in the dedicated row", () => {
    const { getByLabelText } = renderSection({});
    expect(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    ).toBeTruthy();
  });

  it("tapping the pill calls onLogSavedMeal(savedMeal, slot)", () => {
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

  it("the pill stays reachable when the slot is collapsed", () => {
    const { getByLabelText } = renderSection({
      collapsedSlots: new Set(["Snacks"]),
    });
    expect(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    ).toBeTruthy();
  });

  it("testIDs are present (Maestro contract); the in-header variant never renders", () => {
    const { getByTestId, queryByTestId } = renderSection({});
    // Stable locators for the Maestro validation flow at
    // apps/mobile/.maestro/validation/today_snacks_v2.yaml. If these
    // names change, update the flow too.
    expect(getByTestId("today-slot-Snacks")).toBeTruthy();
    expect(getByTestId("today-slot-header-Snacks")).toBeTruthy();
    expect(getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
    // The legacy in-header pill was removed with the flag (ENG-1651).
    expect(queryByTestId("today-log-usual-pill-in-header-Snacks")).toBeNull();
  });

  it("gate removed: rendering is unaffected by what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation(
      (flag: string) => flag === "today_log_usual_row_v2",
    );
    const { getByTestId, queryByTestId } = renderSection({});
    expect(getByTestId("today-log-usual-row-Snacks")).toBeTruthy();
    expect(getByTestId("today-log-usual-pill-Snacks")).toBeTruthy();
    expect(queryByTestId("today-log-usual-pill-in-header-Snacks")).toBeNull();
  });
});

/**
 * ENG-783 — saved-meal portion editor wiring (today-edit-entry-v2).
 *
 * The host passes `onRequestPortion` ONLY when `today-edit-entry-v2` is on
 * (see `app/(tabs)/_today/TodayScreen.tsx` → `onRequestPortion={isFeatureEnabled(...) ?
 * openPortionConfirm : undefined}`). The component itself doesn't read that
 * flag — it just routes saved-meal taps through `onRequestPortion ??
 * onLogSavedMeal`. So these tests don't mock `today-edit-entry-v2`; they
 * simulate the host by passing / omitting `onRequestPortion`.
 *
 * Coverage — both saved-meal tap sites on the dedicated row:
 *   1. dedicated-row pill     (1 saved meal)
 *   2. usual-picker Modal row (≥2 saved meals → picker opens first)
 * Each tested with the prop wired (portion editor) AND omitted (instant-log
 * fallback) so neither path can silently regress.
 */
describe("TodayMealsSection — ENG-783 saved-meal portion editor", () => {
  beforeEach(() => {
    flagFn.mockImplementation(() => false);
  });

  it("row pill, prop wired: tapping opens the portion editor and does NOT instant-log", () => {
    const onRequestPortion = vi.fn();
    const onLogSavedMeal = vi.fn();
    const { getByLabelText } = renderSection({
      onRequestPortion,
      onLogSavedMeal,
    });
    fireEvent.press(
      getByLabelText("Log usual Snacks: Peanut Butter Smoothie"),
    );
    expect(onRequestPortion).toHaveBeenCalledTimes(1);
    expect(onRequestPortion).toHaveBeenCalledWith(
      PEANUT_BUTTER_SMOOTHIE,
      "Snacks",
    );
    expect(onLogSavedMeal).not.toHaveBeenCalled();
  });

  it("row pill, prop omitted: tapping falls back to the instant onLogSavedMeal log", () => {
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

  it("usual-picker (≥2 saved), prop wired: picking a row opens the portion editor for that meal", () => {
    const onRequestPortion = vi.fn();
    const onLogSavedMeal = vi.fn();
    const { getByLabelText } = renderSection({
      savedMeals: [PEANUT_BUTTER_SMOOTHIE, TRAIL_MIX_SNACK],
      onRequestPortion,
      onLogSavedMeal,
    });
    // With two Snacks usuals the pill opens the chooser instead of logging.
    fireEvent.press(
      getByLabelText("Log a usual Snacks — choose from 2 saved meals"),
    );
    // Pick the second option from the now-open Modal.
    fireEvent.press(getByLabelText(/^Log Trail Mix —/));
    expect(onRequestPortion).toHaveBeenCalledTimes(1);
    expect(onRequestPortion).toHaveBeenCalledWith(TRAIL_MIX_SNACK, "Snacks");
    expect(onLogSavedMeal).not.toHaveBeenCalled();
  });

  it("usual-picker (≥2 saved), prop omitted: picking a row falls back to instant log", () => {
    const onLogSavedMeal = vi.fn();
    const { getByLabelText } = renderSection({
      savedMeals: [PEANUT_BUTTER_SMOOTHIE, TRAIL_MIX_SNACK],
      onLogSavedMeal,
    });
    fireEvent.press(
      getByLabelText("Log a usual Snacks — choose from 2 saved meals"),
    );
    fireEvent.press(getByLabelText(/^Log Peanut Butter Smoothie —/));
    expect(onLogSavedMeal).toHaveBeenCalledTimes(1);
    expect(onLogSavedMeal).toHaveBeenCalledWith(
      PEANUT_BUTTER_SMOOTHIE,
      "Snacks",
    );
  });
});
