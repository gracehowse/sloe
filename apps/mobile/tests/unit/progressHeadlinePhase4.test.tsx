/**
 * progressHeadlinePhase4 — mobile mirror of
 * tests/unit/progressHeadlinePhase4.test.tsx.
 *
 * Authority: D-2026-04-27-12 + D-2026-04-27-17.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { ProgressHeadline } from "../../components/today/ProgressHeadline";
import {
  generateProgressCommentary,
  type ProgressCommentaryTdee,
} from "@/lib/progressCommentary";

// Render unit tests must neutralise analytics: ProgressHeadline's flag-aware
// subtree otherwise calls the real `isFeatureEnabled`, which fires a floating
// PostHog/AsyncStorage read that rejects *after* the test completes — Vitest
// reports it as an "unhandled rejection" and exits non-zero even though every
// assertion passes. Canonical mobile-test pattern (matches mealActionSheetBranded,
// todayLogAgainRow, digestBlended, …). Root-cause robustness of isFeatureEnabled
// (floating promise) tracked in ENG-841.
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
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
    confidenceNeutral: "#475569",
  }),
}));

function tdee(
  overrides: Partial<ProgressCommentaryTdee> = {},
): ProgressCommentaryTdee {
  return {
    tdee: 2100,
    confidence: "medium",
    loggingDays: 21,
    ...overrides,
  };
}

describe("<ProgressHeadline /> (mobile) — Surface E hero", () => {
  it("renders eyebrow + headline + body for the adjustment regime", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2160 }),
      prevWeekTdee: 2100,
      avgIntakeOnLossWeeksKcal: 1840,
    });
    const { getByText, getAllByText } = render(
      <ProgressHeadline commentary={commentary} />,
    );
    expect(getByText("THIS WEEK")).toBeTruthy();
    expect(getByText("Your maintenance adjusted up by 60 kcal")).toBeTruthy();
    // Both numerals appear inline as highlighted nodes
    expect(getAllByText("1,840 kcal").length).toBeGreaterThan(0);
    expect(getAllByText("2,160 kcal").length).toBeGreaterThan(0);
  });

  it("renders the ConfidenceChip below the body — D-2026-04-27-12 always-on", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2110 }),
      prevWeekTdee: 2100,
    });
    const { getByText } = render(<ProgressHeadline commentary={commentary} />);
    expect(getByText("Medium confidence")).toBeTruthy();
  });

  it("calibrating regime — welcome copy + chip still present", () => {
    const commentary = generateProgressCommentary({
      current: null,
      loggingDays: 1,
    });
    const { getByText } = render(<ProgressHeadline commentary={commentary} />);
    expect(
      getByText("Welcome — we'll start estimating maintenance after your first week"),
    ).toBeTruthy();
    expect(getByText("Low confidence")).toBeTruthy();
  });

  it("steady regime — 'held steady' headline + High confidence chip", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2100, confidence: "high", loggingDays: 28 }),
    });
    const { getByText } = render(<ProgressHeadline commentary={commentary} />);
    expect(getByText("Maintenance held steady this week")).toBeTruthy();
    expect(getByText("High confidence")).toBeTruthy();
  });

  it("ENG-1034 — stored medium confidence renders a Medium chip even when the range day count is low", () => {
    // Reproduces Grace's account: profiles.adaptive_tdee_confidence = "medium"
    // (1,699) but the weekly Progress view passes a range-scoped day count (≤7).
    // The card must show the medium-confidence variant — NOT "still calibrating"
    // + a Low chip (the THIS-WEEK ↔ Maintenance-card contradiction, ENG-1034).
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 1699, confidence: "medium", loggingDays: 5 }),
      loggingDays: 5,
    });
    const { getByText, queryByText } = render(
      <ProgressHeadline commentary={commentary} />,
    );
    expect(getByText("Medium confidence")).toBeTruthy();
    expect(queryByText("Low confidence")).toBeNull();
    expect(queryByText("We're still calibrating your maintenance")).toBeNull();
    expect(getByText("Maintenance held steady this week")).toBeTruthy();
  });
});
