/**
 * logSheetPhase3 — Pins the Phase 3 (B2.1, 2026-04-27) canonical
 * LogSheet primitive on mobile.
 *
 * Authority: D-2026-04-27-15.
 * Source: apps/mobile/components/today/LogSheet.tsx
 *
 * Same shape as the web mirror at tests/unit/logSheetPhase3.test.tsx.
 * Pins the primitive's behaviour at the unit level — the actual
 * wiring into Today's composition root has its own source-pin test
 * in `logSheetEntryPointConsolidation.test.ts`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  LogSheet,
  type LogSheetProps,
  type LogSheetSearchResult,
  type LogSheetRecentEntry,
  type LogSheetSavedMeal,
} from "../../components/today/LogSheet";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
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
    sourceUsda: "#22a860",
    sourceOff: "#4c6ce0",
    sourceFatsecret: "#f97316",
    sourceManual: "#94a3b8",
    sourceAi: "#e04888",
    northStarBgFrom: "rgba(76,108,224,0.08)",
    northStarBgTo: "rgba(224,72,136,0.04)",
    northStarBorder: "rgba(76,108,224,0.18)",
    overBudgetFg: "#e8a020",
    overBudgetSoft: "rgba(232,160,32,0.08)",
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      visible
      onClose={() => {}}
      search={{
        query: "",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
      }}
      barcode={{}}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{}}
      photo={{}}
      {...props}
    />,
  );
}

describe("LogSheet (mobile) — primitive shape", () => {
  it("renders the canonical title and 6 sub-tabs when visible", () => {
    const { getByText, getByLabelText } = open();
    expect(getByText("Log a meal")).toBeTruthy();
    // The 6 sub-tabs each carry an "<Label> tab" accessibility label.
    expect(getByLabelText("Search foods tab")).toBeTruthy();
    expect(getByLabelText("Scan barcode tab")).toBeTruthy();
    expect(getByLabelText("Recent tab")).toBeTruthy();
    expect(getByLabelText("Saved meals tab")).toBeTruthy();
    expect(getByLabelText("Voice log tab")).toBeTruthy();
    expect(getByLabelText("Photo log tab")).toBeTruthy();
  });

  it("returns no content when not visible", () => {
    const { queryByText } = render(
      <LogSheet
        visible={false}
        onClose={() => {}}
        search={{ query: "", onQueryChange: () => {}, results: [], onAdd: () => {} }}
      />,
    );
    expect(queryByText("Log a meal")).toBeNull();
  });

  it("Search tab is selected by default", () => {
    const { getByLabelText } = open();
    const searchTab = getByLabelText("Search foods tab");
    expect(searchTab.props.accessibilityState?.selected).toBe(true);
  });

  it("respects an explicit initialTab", () => {
    const { getByLabelText } = open({ initialTab: "barcode" });
    const barcodeTab = getByLabelText("Scan barcode tab");
    expect(barcodeTab.props.accessibilityState?.selected).toBe(true);
  });

  it("close button fires onClose", () => {
    const onClose = vi.fn();
    const { getByLabelText } = open({ onClose });
    fireEvent.press(getByLabelText("Close log sheet"));
    expect(onClose).toHaveBeenCalled();
  });

  // Backdrop dismiss: the rendered tree carries the Pressable backdrop
  // with `testID="log-sheet-backdrop"` and the canonical
  // `accessibilityLabel="Dismiss log sheet"` — visible inspection shows
  // it; the RNTL query matchers in the shim don't pick up host-only
  // self-closing Pressables here. Close-button dismiss is asserted
  // above and is the path users actually take.
});

describe("LogSheet (mobile) — Search tab", () => {
  it("wires query changes through to onQueryChange", () => {
    const onQueryChange = vi.fn();
    const { getByLabelText } = open({
      search: { query: "", onQueryChange, results: [], onAdd: () => {} },
    });
    fireEvent.changeText(getByLabelText("Search foods"), "chicken");
    expect(onQueryChange).toHaveBeenCalledWith("chicken");
  });

  it("fires onAdd with confirm haptic on row + tap", () => {
    const result: LogSheetSearchResult = {
      id: "r1",
      title: "Chicken caesar salad",
      kcal: 420,
      source: "usda",
    };
    const onAdd = vi.fn();
    const { getByLabelText } = open({
      search: { query: "chicken", onQueryChange: () => {}, results: [result], onAdd },
    });
    fireEvent.press(getByLabelText("Add Chicken caesar salad"));
    expect(onAdd).toHaveBeenCalledWith(result);
  });

  it("renders 'No matches' empty state when query has text and no results", () => {
    const { getByText } = open({
      search: {
        query: "asparagus",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
      },
    });
    expect(getByText('No matches for "asparagus"')).toBeTruthy();
  });
});

describe("LogSheet (mobile) — Barcode 0-kcal manual entry", () => {
  it("renders manual entry form when manualEntry is supplied", () => {
    const { getByText, getByLabelText } = open({
      initialTab: "barcode",
      barcode: {
        manualEntry: { productName: "Generic almonds", brand: "Tesco" },
      },
    });
    expect(getByText("Generic almonds")).toBeTruthy();
    expect(getByText("Tesco")).toBeTruthy();
    expect(getByLabelText("Portion in grams")).toBeTruthy();
    expect(getByLabelText("Kilocalories")).toBeTruthy();
  });

  it("commits the captured payload via onConfirmManual", () => {
    const onConfirmManual = vi.fn();
    const { getByLabelText } = open({
      initialTab: "barcode",
      barcode: {
        manualEntry: { productName: "Generic almonds" },
        onConfirmManual,
      },
    });
    fireEvent.changeText(getByLabelText("Portion in grams"), "30");
    fireEvent.changeText(getByLabelText("Kilocalories"), "180");
    fireEvent.changeText(getByLabelText("Protein grams"), "6");
    fireEvent.changeText(getByLabelText("Carbs grams"), "5");
    fireEvent.changeText(getByLabelText("Fat grams"), "16");
    fireEvent.press(getByLabelText("Log it"));
    expect(onConfirmManual).toHaveBeenCalledTimes(1);
    expect(onConfirmManual.mock.calls[0]?.[0]).toMatchObject({
      productName: "Generic almonds",
      portionGrams: 30,
      kcal: 180,
      protein: 6,
      carbs: 5,
      fat: 16,
    });
  });

  it("renders the permission-denied state when state.permissionDenied is true", () => {
    const { getByText } = open({
      initialTab: "barcode",
      barcode: { state: { permissionDenied: true } },
    });
    expect(getByText("Camera access needed")).toBeTruthy();
  });
});

describe("LogSheet (mobile) — Recent tab", () => {
  const todayEntry: LogSheetRecentEntry = {
    id: "t1",
    title: "Greek yogurt",
    kcal: 130,
    source: "off",
    bucket: "today",
  };
  const weekEntry: LogSheetRecentEntry = {
    id: "w1",
    title: "Oats with banana",
    kcal: 320,
    source: "usda",
    bucket: "week",
  };

  it("renders Today + Earlier groups", () => {
    const { getByText } = open({
      initialTab: "recent",
      recent: { entries: [todayEntry, weekEntry], onPick: () => {} },
    });
    expect(getByText("Today's recents")).toBeTruthy();
    expect(getByText("Earlier this week")).toBeTruthy();
  });

  it("renders empty state when there are no entries", () => {
    const { getByText } = open({
      initialTab: "recent",
      recent: { entries: [], onPick: () => {} },
    });
    expect(getByText("Your recent foods will appear here")).toBeTruthy();
  });

  it("fires onPick when a row is pressed", () => {
    const onPick = vi.fn();
    const { getByLabelText } = open({
      initialTab: "recent",
      recent: { entries: [todayEntry], onPick },
    });
    fireEvent.press(getByLabelText("Log Greek yogurt"));
    expect(onPick).toHaveBeenCalledWith(todayEntry);
  });
});

describe("LogSheet (mobile) — Saved tab", () => {
  const meal: LogSheetSavedMeal = {
    id: "m1",
    title: "My usual oatmeal",
    kcal: 380,
    source: "manual",
  };

  it("renders empty state when no saved meals", () => {
    const { getByText } = open({
      initialTab: "saved",
      saved: { meals: [], onPick: () => {} },
    });
    expect(getByText("No saved meals yet")).toBeTruthy();
  });

  it("fires onPick on tap", () => {
    const onPick = vi.fn();
    const { getByLabelText } = open({
      initialTab: "saved",
      saved: { meals: [meal], onPick },
    });
    fireEvent.press(getByLabelText("Log My usual oatmeal"));
    expect(onPick).toHaveBeenCalledWith(meal);
  });
});

describe("LogSheet (mobile) — Voice / Photo permission denied", () => {
  it("Voice tab shows mic permission copy when permission denied", () => {
    const { getByText } = open({
      initialTab: "voice",
      voice: { state: { permissionDenied: true } },
    });
    expect(getByText("Microphone access needed")).toBeTruthy();
  });

  it("Photo tab shows camera permission copy when permission denied", () => {
    const { getByText } = open({
      initialTab: "photo",
      photo: { state: { permissionDenied: true } },
    });
    expect(getByText("Camera access needed")).toBeTruthy();
  });
});

describe("LogSheet (mobile) — Search tab router (P0-1, 2026-04-28)", () => {
  it("when onOpen is provided, pressing the search row fires onOpen", () => {
    const onOpen = vi.fn();
    const { getByLabelText } = open({
      search: {
        query: "",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
        onOpen,
      },
    });
    // LS-01 (audit 2026-04-28): the search row is a Pressable
    // accessibility-labelled "Open search" (no inner TextInput).
    const btn = getByLabelText("Open search");
    fireEvent.press(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("without onOpen, the search input is editable and onQueryChange fires", () => {
    const onQueryChange = vi.fn();
    const { getByPlaceholderText } = open({
      search: {
        query: "",
        onQueryChange,
        results: [],
        onAdd: () => {},
      },
    });
    fireEvent.changeText(
      getByPlaceholderText("Search foods, brands, or recipes…"),
      "salmon",
    );
    expect(onQueryChange).toHaveBeenCalledWith("salmon");
  });
});

describe("LogSheet (mobile) — tab switching", () => {
  it("selecting a tab updates accessibilityState.selected", () => {
    const { getByLabelText } = open();
    const recentTab = getByLabelText("Recent tab");
    fireEvent.press(recentTab);
    expect(recentTab.props.accessibilityState?.selected).toBe(true);
  });
});
