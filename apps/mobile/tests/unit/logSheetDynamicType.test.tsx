// @vitest-environment jsdom
/**
 * logSheetDynamicType (mobile) — ENG-1529 regression net for the LogSheet
 * chrome that clipped at accessibility Dynamic Type sizes (evidence:
 * apps/mobile/screenshots/agent/audit-71-today-a11y.png):
 *
 *  - the v3 method tiles carry NO fixed height (containers grow with
 *    type size) and their labels carry the F-36 clamp
 *    (`maxFontSizeMultiplier={1.2}` — the library.tsx convention) so
 *    single-word labels never clip mid-glyph;
 *  - the LogHub quick-action labels carry the same clamp;
 *  - the Favourites / Recent / My recipes / Saved meals rail is a HORIZONTAL
 *    ScrollView so it pans instead of clipping off-screen;
 *  - the search row uses `minHeight` (not `height`) so the input grows.
 *
 * Why component-level and not the screens-diff harness: the Maestro tour
 * (`test:screens:*`) cannot parameterise content size per-case — Dynamic Type
 * is host-side only (`xcrun simctl ui booted content_size …`) and RN needs a
 * cold launch to pick it up, so a sim AX sweep is a separate harness
 * extension. Harness shape mirrors `logSheetInputModeRowV3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

// The v3 tile grammar reads `sloe_v3_log` (default-ON).
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: () => true,
  track: vi.fn(),
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

// LogSheet → FoodSearchPanel → searchFoods instantiates a Supabase client at
// module load and explodes without SUPABASE_URL. These tests never search.
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
    text: "#221B26",
    textSecondary: "#655C6E",
    textTertiary: "#6E6874",
    tint: "#5E7C5A",
    navPrimary: "#3B2A4D",
    background: "#F7F6FA",
    backgroundSecondary: "#F1F0F4",
    backgroundGrouped: "#F5F4F7",
    card: "#FFFFFF",
    cardBorder: "#EAE7F0",
    border: "#EAE7F0",
    fillQuiet: "#F1F0F4",
    inputBg: "#FFFFFF",
    skeleton: "#EAE7F0",
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

/* eslint-disable import/first -- vi.mock calls must precede the import. */
import {
  LogSheet,
  type LogSheetProps,
} from "../../components/today/LogSheet";
/* eslint-enable import/first */

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

describe("LogSheet Dynamic Type (ENG-1529)", () => {
  it("method tiles carry no fixed height, and tile labels carry the F-36 1.2 clamp", () => {
    // ENG-1532 — `component_grammar_dedup` (mocked ON with every flag here)
    // drops the Scan tile; the loud CTA is the single scanner entry.
    const { getByTestId, getByText } = open();
    for (const key of ["photo", "voice", "describe", "quick"]) {
      const style = StyleSheet.flatten(getByTestId(`log-sheet-method-${key}`).props.style);
      expect(style?.height, `tile ${key} must not fix its height`).toBeUndefined();
    }
    for (const label of ["Photo", "Voice", "Describe", "Quick add"]) {
      expect(getByText(label).props.maxFontSizeMultiplier).toBe(1.2);
    }
  });

  it("LogHub quick-action labels carry the F-36 1.2 clamp", () => {
    const { getByText } = open({
      quickActions: { logUsual: { mealName: "Oats", onTap: () => {} } },
    });
    expect(getByText("Log Oats").props.maxFontSizeMultiplier).toBe(1.2);
  });

  it("browse tab rail is a horizontal ScrollView and keeps its tab handles", () => {
    const { getByTestId } = open();
    expect(getByTestId("log-sheet-browse-tab-scroll").props.horizontal).toBe(true);
    // The testID template-literal refactor must keep the exact handles.
    expect(getByTestId("log-sheet-tab-recent")).toBeTruthy();
    expect(getByTestId("log-sheet-tab-saved")).toBeTruthy();
  });

  it("search row grows with type size — minHeight, never a fixed height", () => {
    const { getByTestId } = open({ search: { onSelect: () => {} } });
    const style = StyleSheet.flatten(getByTestId("log-sheet-search-row").props.style);
    expect(style?.height).toBeUndefined();
    expect(style?.minHeight).toBe(48);
  });
});
