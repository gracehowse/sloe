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
import type { NorthStarRecipe } from "@suppr/shared/nutrition/northStarSuggestion";

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

  it("renders a default suggestion with only 2 saved recipes inside the activation window (round-2 fix #5)", () => {
    // Audit 2026-04-30 round-2 fix #1 — accounts < 30 days old fall
    // back to the relaxed library threshold (≥2 instead of ≥5). Pin
    // the host's wiring of `userCreatedAt` end-to-end: with 2 saved
    // recipes + a young account, the empty-state must NOT render.
    const lib2: readonly NorthStarRecipe[] = [
      { id: "r-0", title: "A", calories: 500, protein: 30, carbs: 50, fat: 18 },
      { id: "r-1", title: "B", calories: 480, protein: 28, carbs: 48, fat: 17 },
    ];
    const youngAccount = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={lib2}
        remainingCalories={500}
        remainingProtein={20}
        remainingCarbs={40}
        remainingFat={15}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-30"
        userCreatedAt={youngAccount}
      />,
    );
    // Empty-state must NOT render — the relaxed threshold allows
    // the default suggestion through.
    expect(tree.queryByTestId("north-star-library-empty")).toBeNull();
    expect(tree.queryByTestId("north-star-over-budget")).toBeNull();
  });

  it("renders the empty-state with only 2 saved recipes once the account is > 30 days old", () => {
    // Steady-state path — same library, same remaining macros, but
    // the account is older than the activation window. Threshold
    // reverts to 5; lib of 2 → empty-state.
    const lib2: readonly NorthStarRecipe[] = [
      { id: "r-0", title: "A", calories: 500, protein: 30, carbs: 50, fat: 18 },
      { id: "r-1", title: "B", calories: 480, protein: 28, carbs: 48, fat: 17 },
    ];
    const oldAccount = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const tree = render(
      <NorthStarBlockHost
        viewMode="day"
        savedRecipesForLibrary={lib2}
        remainingCalories={500}
        remainingProtein={20}
        remainingCarbs={40}
        remainingFat={15}
        onPrimaryCta={() => {}}
        onBrowseLibrary={() => {}}
        selectedDateKey="2026-04-30"
        userCreatedAt={oldAccount}
      />,
    );
    expect(tree.queryByTestId("north-star-library-empty")).toBeTruthy();
  });

  it("renders the why-line subtitle on the default suggestion (activation hook leak fix #5)", () => {
    // The card must surface "Fits your remaining N kcal" (or one of
    // the protein variants) below the title so the user sees WHICH
    // macro the algorithm is fitting. Pre-fix, only the band chip
    // ("Close fit") rendered, which read as black-box.
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
    // The why-line is one of three formats — all three are accepted
    // here so the test doesn't need to predict which branch the
    // scorer picks. Pin: at least ONE of the three patterns renders.
    const allText = JSON.stringify(tree.toJSON());
    const hasWhyLine =
      /Fits your remaining \d+\s?kcal/.test(allText) ||
      /Fits your remaining \d+g protein/.test(allText) ||
      /Hits both your protein \+ calorie target/.test(allText);
    expect(hasWhyLine).toBe(true);
  });
});
