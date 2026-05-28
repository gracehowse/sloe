// @vitest-environment jsdom
/**
 * TrendSummaryCard (mobile) — ENG-755.
 *
 * Mobile port of web's `TrendSummaryCardWeb`. Pins:
 *   1. The flag gate — nothing renders when
 *      `progress-trend-summary-mobile` is off.
 *   2. The three always-present "X of Y" rows (calorie / protein /
 *      weigh-ins) render with the right counts.
 *   3. The projected-goal row appears only when `goalWeightDisplay`
 *      is provided, and is hidden otherwise.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

import { TrendSummaryCard } from "../../components/progress/TrendSummaryCard";
import { isFeatureEnabled } from "@/lib/analytics";

void React;

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
    accent: "#22c55e",
  }),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

describe("TrendSummaryCard (mobile)", () => {
  beforeEach(() => {
    flagFn.mockReset();
  });

  it("renders nothing when the flag is off", () => {
    flagFn.mockReturnValue(false);
    const { toJSON } = render(
      <TrendSummaryCard
        daysHitCalorieTarget={4}
        totalDaysInWindow={7}
        daysHitProteinTarget={3}
        weighInsThisWeek={2}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the three core rows with X of Y values", () => {
    flagFn.mockReturnValue(true);
    const { getByText } = render(
      <TrendSummaryCard
        daysHitCalorieTarget={4}
        totalDaysInWindow={7}
        daysHitProteinTarget={3}
        weighInsThisWeek={2}
      />,
    );
    expect(getByText("Days hit calorie target")).toBeTruthy();
    expect(getByText("4 of 7")).toBeTruthy();
    expect(getByText("Days hit protein target")).toBeTruthy();
    expect(getByText("3 of 7")).toBeTruthy();
    expect(getByText("Weigh-ins")).toBeTruthy();
    expect(getByText("2 of 7")).toBeTruthy();
  });

  it("hides the projected-goal row when no goal display is provided", () => {
    flagFn.mockReturnValue(true);
    const { queryByText } = render(
      <TrendSummaryCard
        daysHitCalorieTarget={4}
        totalDaysInWindow={7}
        daysHitProteinTarget={3}
        weighInsThisWeek={2}
      />,
    );
    expect(queryByText(/Projected/)).toBeNull();
  });

  it("renders the projected-goal row when goal display + date are provided", () => {
    flagFn.mockReturnValue(true);
    const { getByText } = render(
      <TrendSummaryCard
        daysHitCalorieTarget={4}
        totalDaysInWindow={7}
        daysHitProteinTarget={3}
        weighInsThisWeek={2}
        goalWeightDisplay="72 kg"
        goalDateLabel="12 Aug"
      />,
    );
    expect(getByText("Projected 72 kg by")).toBeTruthy();
    expect(getByText("12 Aug")).toBeTruthy();
  });
});
