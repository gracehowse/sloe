// @vitest-environment jsdom
/**
 * logSheetInputModeRowV3 (mobile) — ENG-1303 v3 method-grid tile grammar for
 * the LogSheet input-method row, gated on `sloe_v3_log` (default-ON).
 *
 * Mounts the real `<LogSheet>` and asserts:
 *   - FLAG ON  → the four method tiles (Photo / Voice / Describe / Quick add)
 *     render with their `log-sheet-method-*` handles, a frost lock
 *     badge on the locked AI method, and NO "PRO" text pill.
 *   - FLAG OFF → the legacy circular chips: a "PRO" text pill on the locked AI
 *     method, no v3 tile handles, no lock-badge handle, no Describe tile.
 *   - the header copy swaps "Log a meal" → "Add to today" with the flag.
 *   - the Describe tile expands the inline describe flow (unlocked) / paywalls
 *     (locked).
 *   - ENG-1532 (`component_grammar_dedup`, default-ON) — the Scan tile/chip is
 *     dropped from BOTH renders (the loud CTA is the single scanner entry);
 *     the dedup kill switch (OFF) restores the Scan tile, byte-intact.
 *
 * Mirror of `tests/unit/logSheetInputModeRowV3.test.tsx` (web).
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

// Flag toggles — the InputModeRow + LogSheet header read
// `isFeatureEnabled("sloe_v3_log")` from `@/lib/analytics`; ENG-1532 adds
// `component_grammar_dedup` (drops the Scan tile — default-ON) as a
// separately-toggleable kill switch.
let flagOn = true;
let dedupOn = true;
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "component_grammar_dedup" ? dedupOn : flagOn,
  track: vi.fn(),
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

// `LogSheet.tsx` → `<FoodSearchPanel>` → `searchFoods` instantiates a Supabase
// client at module load and explodes with no SUPABASE_URL. These tests never
// touch search.
vi.mock("@/lib/verifyRecipe", () => ({
  splitFoodSearchResults: (_query: string, rows: unknown[]) => ({
    best: rows ?? [],
    more: [],
  }),
  searchFoods: vi.fn(async () => []),
  getFoodMacros: vi.fn(async () => null),
  scaleMacrosByGrams: vi.fn(() => ({
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiberG: 0, sugarG: 0, sodiumMg: 0,
  })),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#655C6E",
    textTertiary: "#6E6874",
    navPrimary: "#3B2A4D",
    background: "#F7F6FA",
    backgroundSecondary: "#F1F0F4",
    backgroundGrouped: "#F5F4F7",
    card: "#FFFFFF",
    cardBorder: "#EAE7F0",
    border: "#EAE7F0",
    fillQuiet: "#F1F0F4",
    inputBg: "#FFFFFF",
    sourceUsda: "#5E7C5A",
    sourceOff: "#4A7878",
    sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8",
    sourceAi: "#6A4B7A",
    northStarBgFrom: "rgba(59,42,77,0.08)",
    northStarBgTo: "rgba(200,121,78,0.05)",
    northStarBorder: "rgba(59,42,77,0.18)",
    overBudgetFg: "#925812",
    overBudgetSoft: "rgba(201,137,44,0.12)",
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/* eslint-disable import/first -- the vi.mock calls + `flagOn` toggle must
 * precede the module-under-test import (vi.mock is hoisted; the flag var is
 * read through the mock factory). */
import {
  LogSheet,
  type LogSheetProps,
} from "../../components/today/LogSheet";
/* eslint-enable import/first */

beforeEach(() => {
  flagOn = true;
  dedupOn = true;
});

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      visible
      onClose={() => {}}
      search={{ onOpen: () => {} }}
      barcode={{ onOpen: () => {} }}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{ onStart: () => {}, locked: true }}
      photo={{ onCapture: () => {}, locked: false }}
      onAddManually={() => {}}
      describe={{ onParse: async () => ({ ok: true, items: [] }), onCommit: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet input-method row — v3 tile grammar (mobile)", () => {
  it("renders the four method tiles when the flag is ON (default) — no Scan tile (ENG-1532)", () => {
    const { getByTestId, queryByTestId } = open();
    for (const key of ["photo", "voice", "describe", "quick"]) {
      expect(getByTestId(`log-sheet-method-${key}`)).toBeTruthy();
    }
    // ENG-1532 — the loud "Scan barcode" CTA is the single scanner entry.
    expect(queryByTestId("log-sheet-method-scan")).toBeNull();
  });

  it("shows the frost lock badge (not a PRO text pill) on the locked AI method when flag ON", () => {
    const { getByTestId, queryByText } = open({ voice: { onStart: () => {}, locked: true } });
    expect(getByTestId("log-sheet-method-lock-voice")).toBeTruthy();
    expect(queryByText("PRO")).toBeNull();
  });

  it("renders the Describe tile only when the host wires `describe` (flag ON)", () => {
    const withoutDescribe = open({ describe: undefined });
    expect(withoutDescribe.queryByTestId("log-sheet-method-describe")).toBeNull();
    withoutDescribe.unmount();
    const withDescribe = open();
    expect(withDescribe.getByTestId("log-sheet-method-describe")).toBeTruthy();
  });

  it("renders the legacy circular chips + PRO pill when the flag is OFF", () => {
    flagOn = false;
    const { getByText, queryByText, queryByTestId } = open({ voice: { onStart: () => {}, locked: true } });
    expect(getByText("PRO")).toBeTruthy();
    // No v3 tile / lock-badge handles, and Describe is not a legacy chip.
    expect(queryByTestId("log-sheet-method-voice")).toBeNull();
    expect(queryByTestId("log-sheet-method-lock-voice")).toBeNull();
    expect(queryByTestId("log-sheet-method-describe")).toBeNull();
    // The input-mode row itself still renders (legacy variant) — minus the
    // Scan chip (ENG-1532, `component_grammar_dedup` default-ON).
    expect(getByText("Voice")).toBeTruthy();
    expect(queryByText("Scan")).toBeNull();
  });

  it("ENG-1532 kill switch — `component_grammar_dedup` OFF restores the Scan tile (v3) and chip (legacy)", () => {
    dedupOn = false;
    const onScanOpen = vi.fn();
    // v3 grid: the Scan tile leads the five-tile set and still opens the scanner.
    const v3Render = open({ barcode: { onOpen: onScanOpen } });
    expect(v3Render.getByTestId("log-sheet-method-scan")).toBeTruthy();
    fireEvent.press(v3Render.getByTestId("log-sheet-method-scan"));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
    v3Render.unmount();
    // Legacy chips: the Scan chip renders again too.
    flagOn = false;
    const legacyRender = open();
    expect(legacyRender.getByText("Scan")).toBeTruthy();
  });

  it("swaps the header copy to 'Add to today' when flag ON and 'Log a meal' when OFF", () => {
    const on = open();
    expect(on.getByText("Add to today")).toBeTruthy();
    expect(on.queryByText("Log a meal")).toBeNull();
    on.unmount();

    flagOn = false;
    const off = open();
    expect(off.getByText("Log a meal")).toBeTruthy();
    expect(off.queryByText("Add to today")).toBeNull();
  });

  it("expands the inline describe flow when the Describe tile is tapped (flag ON, unlocked)", () => {
    const { getAllByLabelText, getByTestId, queryByTestId } = open({
      describe: { locked: false, onParse: async () => ({ ok: true, items: [] }), onCommit: () => {} },
    });
    expect(queryByTestId("log-sheet-describe-input")).toBeNull();
    expect(queryByTestId("log-sheet-describe-expand")).toBeNull();
    expect(getAllByLabelText("Describe")).toHaveLength(1);
    fireEvent.press(getByTestId("log-sheet-method-describe"));
    expect(getByTestId("log-sheet-describe-input")).toBeTruthy();
  });

  it("lets an active search query own the sheet and restores method chrome when cleared", () => {
    const { getByLabelText, getByTestId, queryByTestId } = open({
      search: { onSelect: () => {} },
      showBarcodeFreePromise: true,
    });
    expect(getByTestId("log-sheet-input-mode-row")).toBeTruthy();
    expect(getByTestId("log-sheet-loud-barcode-cta")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Search foods"), "yogurt");
    expect(queryByTestId("log-sheet-input-mode-row")).toBeNull();
    expect(queryByTestId("log-sheet-loud-barcode-cta")).toBeNull();
    expect(queryByTestId("log-sheet-describe-expand")).toBeNull();

    fireEvent.changeText(getByLabelText("Search foods"), "");
    expect(getByTestId("log-sheet-input-mode-row")).toBeTruthy();
    expect(getByTestId("log-sheet-loud-barcode-cta")).toBeTruthy();
  });

  it("paywalls (does not expand) when the Describe tile is tapped while locked (flag ON)", () => {
    const onPaywall = vi.fn();
    const { getByTestId, queryByTestId } = open({
      describe: { locked: true, onParse: async () => ({ ok: true, items: [] }), onCommit: () => {}, onPaywall },
    });
    fireEvent.press(getByTestId("log-sheet-method-describe"));
    expect(onPaywall).toHaveBeenCalledTimes(1);
    expect(queryByTestId("log-sheet-describe-input")).toBeNull();
  });
});
