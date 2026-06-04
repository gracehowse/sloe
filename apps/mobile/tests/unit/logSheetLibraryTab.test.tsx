/**
 * logSheetLibraryTab -- pins the LogSheet's Library tab.
 *
 * Sourced from TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8`
 * + sibling reports ("No way to add recipes saved to library from
 * here", "Need to be more obvious ways to access the library"),
 * 2026-05-01.
 *
 * Behaviour pinned:
 *   - Library appears in the browse tab strip in the order
 *     Recent / Library / Saved meals.
 *   - Tab pill carries the canonical "Library" accessibility label.
 *   - Tab content lists each recipe with title, kcal/portion, and an
 *     optional meal-type pill.
 *   - Tap on a row fires `onPick` with the canonical recipe payload.
 *   - Empty state surfaces the friendly copy + "Browse recipes" CTA
 *     when the user has no saved recipes.
 *   - Empty-state CTA fires `onBrowseRecipes` (host wires this to
 *     /(tabs)/library).
 *
 * Same shape as the web mirror at `tests/unit/logSheetLibraryTab.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  LogSheet,
  type LogSheetLibraryRecipe,
} from "../../components/today/LogSheet";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

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

const greekSalad: LogSheetLibraryRecipe = {
  id: "rec-greek",
  title: "Greek salad",
  kcalPerPortion: 320,
  thumbnail: null,
  mealTag: "Lunch",
};
const oats: LogSheetLibraryRecipe = {
  id: "rec-oats",
  title: "Banana oats",
  kcalPerPortion: 410,
  thumbnail: null,
  mealTag: "Breakfast",
};

describe("LogSheet (mobile) -- Library tab (TestFlight Build 40)", () => {
  it("renders the Library pill alongside Recent and Saved meals", () => {
    const { getByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    expect(getByLabelText("Recent")).toBeTruthy();
    expect(getByLabelText("Library")).toBeTruthy();
    expect(getByLabelText("Saved meals")).toBeTruthy();
  });

  it("hides the Library pill when no library prop is wired (host opted out)", () => {
    const { queryByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    expect(queryByLabelText("Library")).toBeNull();
  });

  it("renders Library content (title + kcal + tag) after switching to the Library tab", () => {
    const { getByLabelText, getByText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad, oats], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.press(getByLabelText("Library"));
    expect(getByText("Greek salad")).toBeTruthy();
    expect(getByText("320 kcal")).toBeTruthy();
    expect(getByText("Lunch")).toBeTruthy();
    expect(getByText("Banana oats")).toBeTruthy();
    expect(getByText("Breakfast")).toBeTruthy();
  });

  it("library row tap fires onPick with the canonical recipe payload", () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad], onPick }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.press(getByLabelText("Library"));
    fireEvent.press(getByLabelText("Log Greek salad"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(greekSalad);
  });

  it("renders the friendly empty state when the user has no saved recipes", () => {
    const { getByLabelText, getByText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.press(getByLabelText("Library"));
    expect(getByText("No saved recipes yet")).toBeTruthy();
    expect(
      getByText(
        /Save recipes from the Recipes tab to see them here\. We.ll show your most-cooked recipes first\./,
      ),
    ).toBeTruthy();
  });

  it("empty-state Browse recipes CTA fires onBrowseRecipes", () => {
    const onBrowseRecipes = vi.fn();
    const { getByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {}, onBrowseRecipes }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.press(getByLabelText("Library"));
    fireEvent.press(getByLabelText("Browse recipes"));
    expect(onBrowseRecipes).toHaveBeenCalledTimes(1);
  });

  it("empty-state Browse recipes CTA is hidden when onBrowseRecipes is undefined", () => {
    const { getByLabelText, queryByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.press(getByLabelText("Library"));
    expect(queryByLabelText("Browse recipes")).toBeNull();
  });

  it("library content renders directly when only library is wired (no toggle needed)", () => {
    const { getByText, queryByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        library={{ recipes: [greekSalad], onPick: () => {} }}
      />,
    );
    expect(queryByLabelText("Recent")).toBeNull();
    expect(queryByLabelText("Saved meals")).toBeNull();
    expect(getByText("Greek salad")).toBeTruthy();
  });
});
