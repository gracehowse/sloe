/**
 * progressHeadlinePhase4 — render rules for the Progress story
 * headline (Surface E hero) on web. Authority: D-2026-04-27-12 +
 * D-2026-04-27-17.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProgressHeadline } from "../../src/app/components/suppr/progress-headline";
import { generateProgressCommentary } from "../../src/lib/nutrition/progressCommentary";
import type { AdaptiveTdeeResult } from "../../src/lib/nutrition/adaptiveTdee";

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

describe("<ProgressHeadline /> — Surface E hero", () => {
  it("renders the eyebrow 'THIS WEEK', the headline, and the engine body", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2160 }),
      prevWeekTdee: 2100,
      avgIntakeOnLossWeeksKcal: 1840,
    });

    render(<ProgressHeadline commentary={commentary} />);
    expect(screen.getByText(/THIS WEEK/)).toBeDefined();
    expect(
      screen.getByText("Your maintenance adjusted up by 60 kcal"),
    ).toBeDefined();
    // Both numerals appear inline
    expect(screen.getByText("1,840 kcal")).toBeDefined();
    expect(screen.getByText("2,160 kcal")).toBeDefined();
  });

  it("renders the ConfidenceChip inline at the end of the body — D-2026-04-27-12", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2110 }),
      prevWeekTdee: 2100,
    });
    render(<ProgressHeadline commentary={commentary} />);
    // The ConfidenceChip writes data-slot="confidence-chip"
    const chip = document.querySelector('[data-slot="confidence-chip"]');
    expect(chip).toBeTruthy();
    expect(chip?.getAttribute("data-level")).toBe("medium");
  });

  it("calibrating regime renders welcome copy when no data", () => {
    const commentary = generateProgressCommentary({
      current: null,
      loggingDays: 1,
    });
    render(<ProgressHeadline commentary={commentary} />);
    expect(
      screen.getByText(/Welcome — we'll start estimating maintenance/),
    ).toBeDefined();
    // Confidence chip is still present — D-2026-04-27-12 (always-on).
    const chip = document.querySelector('[data-slot="confidence-chip"]');
    expect(chip).toBeTruthy();
  });

  it("steady regime renders 'held steady' with high-confidence chip when warranted", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2100, confidence: "high", loggingDays: 28 }),
    });
    render(<ProgressHeadline commentary={commentary} />);
    expect(screen.getByText("Maintenance held steady this week")).toBeDefined();
    const chip = document.querySelector('[data-slot="confidence-chip"]');
    expect(chip?.getAttribute("data-level")).toBe("high");
  });

  it("data-regime attribute reflects the regime — for snapshot QA", () => {
    const commentary = generateProgressCommentary({
      current: tdee({ tdee: 2160 }),
      prevWeekTdee: 2100,
    });
    const { container } = render(<ProgressHeadline commentary={commentary} />);
    const root = container.querySelector('[data-slot="progress-headline"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute("data-regime")).toBe("adjustment");
  });
});
