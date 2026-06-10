/**
 * logSheetSlotSelector (mobile) — render harness for the ENG-773
 * log-time meal-slot selector.
 *
 * 2026-05-08 build-47 follow-up — Grace TF (open feedback):
 *
 *   "items keep getting added to fields by time of day rather than for
 *   the meal i am trying to add them to for example i clikc + for
 *   breakfast but its the afternoon it adds it as snack"
 *
 * The source-grep suites (`logSheetSlotHonoured.test.ts`,
 * `tests/unit/logSheetWebMobileParity.test.ts`) pin the wiring
 * statically. This file mounts the real `<LogSheet>` and exercises the
 * rendered selector: the 4 slot radios appear only when the host wires
 * the `slot` prop (the flag-gated path), the active slot announces its
 * selected state, and pressing a slot calls `onChange` with that slot.
 *
 * Same shape as the web mirror at
 * `tests/unit/logSheetSlotSelector.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  LogSheet,
  type LogSheetProps,
} from "../../components/today/LogSheet";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

// `LogSheet.tsx` imports `<FoodSearchPanel>` → `searchFoods` from
// `@/lib/verifyRecipe`, which instantiates a Supabase client at module
// load and explodes with no SUPABASE_URL in the test env. The selector
// tests never touch search — a narrow stub is enough (same as
// logSheetPhase3).
vi.mock("@/lib/verifyRecipe", () => ({
  searchFoods: vi.fn(async () => []),
  getFoodMacros: vi.fn(async () => null),
  scaleMacrosByGrams: vi.fn(() => ({
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiberG: 0, sugarG: 0, sodiumMg: 0,
  })),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    backgroundSecondary: "#fafafa",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    sourceUsda: "#5E7C5A",
    sourceOff: "#4A7878",
    sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8",
    sourceAi: "#6A4B7A",
    northStarBgFrom: "rgba(88,140,228,0.08)",
    northStarBgTo: "rgba(223,94,188,0.04)",
    northStarBorder: "rgba(88,140,228,0.18)",
    overBudgetFg: "#C0533F",
    overBudgetSoft: "rgba(247,138,50,0.08)",
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      visible
      onClose={() => {}}
      search={{ onOpen: () => {} }}
      barcode={{ onOpen: () => {} }}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{ onStart: () => {} }}
      photo={{ onCapture: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet slot selector (mobile) — render", () => {
  it("renders no slot row when the host omits the `slot` prop (flag OFF path)", () => {
    const { queryByTestId } = open();
    expect(queryByTestId("log-sheet-slot-row")).toBeNull();
    for (const s of SLOTS) {
      expect(queryByTestId(`log-sheet-slot-${s.toLowerCase()}`)).toBeNull();
    }
  });

  it("renders all four slot radios inside a radiogroup when wired", () => {
    const { getByTestId } = open({
      slot: { current: "Breakfast", options: SLOTS, onChange: () => {} },
    });
    const row = getByTestId("log-sheet-slot-row");
    expect(row.props.accessibilityRole).toBe("radiogroup");
    expect(row.props.accessibilityLabel).toBe("Meal to log to");
    for (const s of SLOTS) {
      const pill = getByTestId(`log-sheet-slot-${s.toLowerCase()}`);
      expect(pill).toBeTruthy();
      expect(pill.props.accessibilityRole).toBe("radio");
    }
  });

  it("marks only the current slot accessibilityState.selected", () => {
    const { getByTestId } = open({
      slot: { current: "Lunch", options: SLOTS, onChange: () => {} },
    });
    expect(
      getByTestId("log-sheet-slot-lunch").props.accessibilityState.selected,
    ).toBe(true);
    for (const s of SLOTS.filter((x) => x !== "Lunch")) {
      expect(
        getByTestId(`log-sheet-slot-${s.toLowerCase()}`).props
          .accessibilityState.selected,
      ).toBe(false);
    }
  });

  it("calls onChange with the tapped slot (not the current one)", () => {
    const onChange = vi.fn();
    const { getByTestId } = open({
      slot: { current: "Breakfast", options: SLOTS, onChange },
    });
    fireEvent.press(getByTestId("log-sheet-slot-dinner"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("Dinner");
  });

  it("re-pressing the already-current slot still forwards that slot", () => {
    // The host owns idempotency — the control fires onChange on every
    // press so a deliberate re-select of the active slot is observable.
    const onChange = vi.fn();
    const { getByTestId } = open({
      slot: { current: "Snacks", options: SLOTS, onChange },
    });
    fireEvent.press(getByTestId("log-sheet-slot-snacks"));
    expect(onChange).toHaveBeenCalledWith("Snacks");
  });
});
