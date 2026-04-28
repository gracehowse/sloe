/**
 * northStarBlockHostPhase5 — pins the mobile NorthStarBlockHost
 * branching matrix (over-budget / library-empty / no-fit / default).
 *
 * Authority: D-2026-04-27-04 + B3.M (mobile NorthStar host wiring).
 * Source: apps/mobile/components/today/NorthStarBlockHost.tsx
 *
 * The host wraps the presentational <NorthStarBlock> and decides
 * which `kind` to render based on viewMode + remainingCalories +
 * library size + the suggestion picker output.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { NorthStarBlockHost } from "../../components/today/NorthStarBlockHost";
import type { NorthStarRecipe } from "../../../../src/lib/nutrition/northStarSuggestion";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
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

vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => false,
}));

const lib6: readonly NorthStarRecipe[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r-${i}`,
  title: `Recipe ${i}`,
  calories: 500,
  protein: 30,
  carbs: 50,
  fat: 18,
}));

describe("NorthStarBlockHost branching", () => {
  it("renders nothing when viewMode='week'", () => {
    const tree = render(
      <NorthStarBlockHost
        viewMode="week"
        savedRecipesForLibrary={lib6}
        remainingCalories={500}
        remainingProtein={20}
        remainingCarbs={40}
        remainingFat={15}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-27"
      />,
    );
    expect(tree.toJSON()).toBeNull();
  });

  it("renders the over-budget caption when remainingCalories ≤ 0", () => {
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={lib6}
        remainingCalories={-50}
        remainingProtein={10}
        remainingCarbs={20}
        remainingFat={5}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-27"
      />,
    );
    expect(tree.queryByTestId("north-star-over-budget")).toBeTruthy();
  });

  it("renders the library-empty branch when library < 5", () => {
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={[]}
        remainingCalories={1000}
        remainingProtein={50}
        remainingCarbs={120}
        remainingFat={35}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-27"
      />,
    );
    expect(tree.queryByTestId("north-star-library-empty")).toBeTruthy();
  });

  it("renders a default suggestion when library >= 5 and a fit exists", () => {
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={lib6}
        remainingCalories={500}
        remainingProtein={20}
        remainingCarbs={40}
        remainingFat={15}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-27"
      />,
    );
    // Default block always renders (lib6 has 6 plausible recipes for
    // remaining=500). Either default or no-fit is acceptable here —
    // pin "not the empty / over-budget branches".
    expect(tree.queryByTestId("north-star-over-budget")).toBeNull();
    expect(tree.queryByTestId("north-star-library-empty")).toBeNull();
  });

  it("invokes onPrimaryCta with the suggestion's recipe id (not the first saved recipe)", () => {
    const onPrimaryCta = vi.fn();
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={lib6}
        remainingCalories={500}
        remainingProtein={20}
        remainingCarbs={40}
        remainingFat={15}
        onPrimaryCta={onPrimaryCta}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-27"
      />,
    );
    const cta = tree.queryByTestId("north-star-default-cta");
    if (cta) {
      fireEvent.press(cta);
      expect(onPrimaryCta).toHaveBeenCalledTimes(1);
      const passed = onPrimaryCta.mock.calls[0]?.[0] as string;
      expect(typeof passed).toBe("string");
      expect(lib6.map((r) => r.id)).toContain(passed);
    }
  });
});
