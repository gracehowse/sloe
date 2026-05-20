/**
 * northStarBlockPhase3 — pins the Phase 3 (B2.2, 2026-04-27) mobile
 * `<NorthStarBlock>` primitive. Mirrors `tests/unit/northStarBlockPhase3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  NorthStarBlock,
  type NorthStarBlockSuggestion,
} from "../../components/today/NorthStarBlock";

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

vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => false,
}));

const baseSuggestion: NorthStarBlockSuggestion = {
  recipeId: "rec-1",
  title: "Tofu poke bowl",
  predictedCalories: 520,
  predictedProtein: 38,
  predictedCarbs: 42,
  predictedFat: 18,
  bandLabel: "Hits within 3%",
  bandTight: true,
};

describe("NorthStarBlock (mobile) — default kind", () => {
  it("renders the eyebrow, title, band chip and macro caption", () => {
    const { getByText } = render(
      <NorthStarBlock kind="default" suggestion={baseSuggestion} ctaLabel="Log it" />,
    );
    expect(getByText("What to eat next")).toBeTruthy();
    expect(getByText("Tofu poke bowl")).toBeTruthy();
    expect(getByText("Hits within 3%")).toBeTruthy();
    // 2026-05-12 (premium-bar audit cross-cutting): macro format
    // unified to `520 kcal · 38g P · 42g C · 18g F`.
    expect(getByText(/520 kcal · 38g P · 42g C · 18g F/)).toBeTruthy();
  });

  it("primary CTA fires onPrimaryCta on press", () => {
    const onPrimaryCta = vi.fn();
    const { getByLabelText } = render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        ctaLabel="Cook it →"
        onPrimaryCta={onPrimaryCta}
      />,
    );
    fireEvent.press(getByLabelText("Cook it →"));
    expect(onPrimaryCta).toHaveBeenCalled();
  });

  it("default kind without suggestion renders nothing", () => {
    const { toJSON } = render(<NorthStarBlock kind="default" />);
    expect(toJSON()).toBeNull();
  });
});

describe("NorthStarBlock (mobile) — non-default kinds", () => {
  it("library-empty: renders invitation copy + Open Library button", () => {
    const onOpenLibrary = vi.fn();
    const { getByText, getByLabelText } = render(
      <NorthStarBlock kind="library-empty" onOpenLibrary={onOpenLibrary} />,
    );
    expect(getByText(/Pick a few recipes you'd actually cook/)).toBeTruthy();
    fireEvent.press(getByLabelText("Open Library"));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it("over-budget: renders calm caption", () => {
    const { getByText } = render(<NorthStarBlock kind="over-budget" />);
    expect(
      getByText(
        /You've hit your calories for today — eat freely, or save for tomorrow\./,
      ),
    ).toBeTruthy();
  });

  it("no-fit: renders caption + Browse button", () => {
    const onBrowse = vi.fn();
    const { getByText, getByLabelText } = render(
      <NorthStarBlock kind="no-fit" onBrowse={onBrowse} />,
    );
    expect(
      getByText(/Library has nothing under your remaining macros today\./),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Browse"));
    expect(onBrowse).toHaveBeenCalled();
  });
});

describe("NorthStarBlock (mobile) — reduce-motion swipe-to-skip fallback", () => {
  it("renders an X button when reduce-motion is on AND onSkip is supplied", async () => {
    vi.resetModules();
    vi.doMock("@/hooks/use-reduce-motion", () => ({
      useReduceMotion: () => true,
    }));

    const { NorthStarBlock: BlockReduced } = await import(
      "../../components/today/NorthStarBlock"
    );
    const onSkip = vi.fn();
    const { getByLabelText } = render(
      <BlockReduced kind="default" suggestion={baseSuggestion} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText("Skip this suggestion"));
    expect(onSkip).toHaveBeenCalled();

    vi.doUnmock("@/hooks/use-reduce-motion");
  });
});
