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
import { generateProgressCommentary } from "@/lib/progressCommentary";
import type { AdaptiveTdeeResult } from "../../../../src/lib/nutrition/adaptiveTdee";

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

function tdee(overrides: Partial<AdaptiveTdeeResult> = {}): AdaptiveTdeeResult {
  return {
    tdee: 2100,
    confidence: "medium",
    loggingDays: 21,
    weighInCount: 6,
    avgDailyIntake: 1900,
    smoothedWeightChangeKgPerDay: -0.025,
    windowDays: 28,
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
});
