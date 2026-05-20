/**
 * reduceMotionQAPhase5 — Phase 5 / B6 reduce-motion QA pass.
 *
 * Authority: production design spec §1.1 reduce-motion fallbacks.
 * Coverage: pin behavioural assertions across the components the
 * Phase 1-5 work introduced animation on, so a regression that
 * silently re-enables a spring / translate path under reduce-motion
 * fails CI.
 *
 * Components covered:
 *   - NorthStarBlock — reduce-motion replaces swipe-to-skip with an
 *     `X` button at top-right (already pinned in Phase 3 test; Phase 5
 *     pins additional reduce-motion behaviours).
 *
 * Web-side equivalent: `tests/unit/reduceMotionQAPhase5.test.ts` for
 * any web animations introduced in Phases 1-5 (sheet, modal, ring fill).
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { NorthStarBlock } from "../../components/today/NorthStarBlock";

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
    sourceUsda: "#62b35a",
    sourceOff: "#4c6ce0",
    sourceFatsecret: "#f97316",
    sourceManual: "#94a3b8",
    sourceAi: "#e04888",
    northStarBgFrom: "rgba(76,108,224,0.08)",
    northStarBgTo: "rgba(224,72,136,0.04)",
    northStarBorder: "rgba(76,108,224,0.18)",
    overBudgetFg: "#e0a838",
    overBudgetSoft: "rgba(232,160,32,0.08)",
  }),
}));

// Shared mock state — toggled per-test so we can assert both branches
// of the reduce-motion path in the same file without the module loader
// caching a fixed value.
let mockReduceMotion = false;

vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => mockReduceMotion,
}));

const baseSuggestion = {
  recipeId: "rec-1",
  title: "Tofu poke bowl",
  predictedCalories: 520,
  predictedProtein: 38,
  predictedCarbs: 42,
  predictedFat: 18,
  bandLabel: "Hits within 3%",
  bandTight: true,
};

describe("Phase 5 reduce-motion QA — NorthStarBlock", () => {
  it("renders the swipe-skip area without an X button when reduce-motion is OFF", () => {
    mockReduceMotion = false;
    const tree = render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        onSkip={() => {}}
      />,
    );
    // No accessible "Skip this suggestion" button — the gesture is
    // the affordance.
    expect(tree.queryByLabelText("Skip this suggestion")).toBeNull();
  });

  it("renders the X button (no swipe gesture path) when reduce-motion is ON", () => {
    mockReduceMotion = true;
    const tree = render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        onSkip={() => {}}
      />,
    );
    // The reduce-motion fallback surfaces an explicit, tappable X
    // button at top-right with the "Skip this suggestion" label.
    expect(tree.queryByLabelText("Skip this suggestion")).toBeTruthy();
  });

  it("does NOT render the X button on the over-budget kind regardless of reduce-motion", () => {
    mockReduceMotion = true;
    const tree = render(<NorthStarBlock kind="over-budget" />);
    expect(tree.queryByLabelText("Skip this suggestion")).toBeNull();
  });

  it("does NOT render the X button on the library-empty kind", () => {
    mockReduceMotion = true;
    const tree = render(<NorthStarBlock kind="library-empty" onOpenLibrary={() => {}} />);
    expect(tree.queryByLabelText("Skip this suggestion")).toBeNull();
  });
});
