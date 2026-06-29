/**
 * logSheetAiMethodTooltip (mobile) — render harness for the ENG-1252
 * first-session AI-method discoverability tooltip ("AI logging — available
 * with Pro.") under the locked Voice / Snap chip in `InputModeRow`.
 *
 * The pure gate matrix (flag × session × tier) is pinned in the shared
 * suite `tests/unit/aiMethodTooltipGate.test.ts`. This file mounts the real
 * `<LogSheet>` and asserts the rendered behaviour the host controls via
 * `aiMethodTooltipVisible`:
 *   - tooltip renders under a LOCKED Voice chip when visible
 *   - tooltip is absent when not visible (default)
 *   - tooltip never renders under an UNLOCKED chip (Pro user)
 *   - exactly ONE tooltip renders even when both AI chips are locked
 *
 * Same shape as the web mirror at
 * `tests/unit/logSheetAiMethodTooltip.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";

import {
  LogSheet,
  type LogSheetProps,
} from "../../components/today/LogSheet";
import { AI_METHOD_TOOLTIP_TEXT } from "@suppr/shared/today/aiMethodTooltip";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

// `LogSheet.tsx` imports `<FoodSearchPanel>` → `searchFoods`, which
// instantiates a Supabase client at module load and explodes with no
// SUPABASE_URL in the test env. The tooltip tests never touch search.
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
      {...props}
    />,
  );
}

describe("LogSheet AI-method tooltip (mobile)", () => {
  it("renders the tooltip under the locked Voice chip when visible", () => {
    const { getByTestId } = open({ aiMethodTooltipVisible: true });
    const tip = getByTestId("log-sheet-ai-method-tooltip");
    expect(tip).toBeTruthy();
    expect(tip.props.children).toBe(AI_METHOD_TOOLTIP_TEXT);
  });

  it("does NOT render the tooltip by default (prop omitted)", () => {
    const { queryByTestId } = open();
    expect(queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("does NOT render the tooltip when explicitly false", () => {
    const { queryByTestId } = open({ aiMethodTooltipVisible: false });
    expect(queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("does NOT render the tooltip when no AI chip is locked (Pro user)", () => {
    const { queryByTestId } = open({
      aiMethodTooltipVisible: true,
      voice: { onStart: () => {}, locked: false },
      photo: { onCapture: () => {}, locked: false },
    });
    expect(queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("renders EXACTLY ONE tooltip even when both Voice and Photo are locked", () => {
    const { getAllByTestId } = open({
      aiMethodTooltipVisible: true,
      voice: { onStart: () => {}, locked: true },
      photo: { onCapture: () => {}, locked: true },
    });
    expect(getAllByTestId("log-sheet-ai-method-tooltip")).toHaveLength(1);
  });
});
