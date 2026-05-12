/**
 * Withings-style chart header (Grace TF feedback 2026-05-11).
 *
 * Pins:
 *   - "WEIGHT: Stable" / "Down" / "Up" / "No data" status word
 *   - "TREND: +0.4 kg" / "−0.6 kg" / "—" signed delta
 *   - kg vs lb formatting honoured
 *   - Period label rendered when provided
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  ArrowRight: () => null,
  TrendingDown: () => null,
  TrendingUp: () => null,
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#111",
    textSecondary: "#666",
    textTertiary: "#999",
    border: "#eee",
  }),
}));

import { WeightTrendHeader } from "../../components/progress/WeightTrendHeader";

describe("<WeightTrendHeader>", () => {
  it("renders 'Down' status with negative delta (kg)", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "down", trendDeltaKg: -0.6 }}
        isImperial={false}
      />,
    );
    expect(getByText("Down")).toBeTruthy();
    // Minus sign is the typographic minus, formatted to 1 dp.
    expect(getByText("−0.6 kg")).toBeTruthy();
  });

  it("renders 'Up' status with positive delta", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "up", trendDeltaKg: 0.4 }}
        isImperial={false}
      />,
    );
    expect(getByText("Up")).toBeTruthy();
    expect(getByText("+0.4 kg")).toBeTruthy();
  });

  it("renders 'Stable' status with near-zero delta", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "stable", trendDeltaKg: 0.05 }}
        isImperial={false}
      />,
    );
    expect(getByText("Stable")).toBeTruthy();
    expect(getByText("+0.1 kg")).toBeTruthy();
  });

  it("renders the no-data placeholder when no MA endpoints", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "no_data", trendDeltaKg: null }}
        isImperial={false}
      />,
    );
    expect(getByText("No data")).toBeTruthy();
    expect(getByText("—")).toBeTruthy();
  });

  it("formats in lb when isImperial", () => {
    // -0.6 kg → -1.3 lb (0.6 × 2.20462 = 1.3)
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "down", trendDeltaKg: -0.6 }}
        isImperial
      />,
    );
    expect(getByText("−1.3 lb")).toBeTruthy();
  });

  it("renders the period label when provided", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "down", trendDeltaKg: -0.6 }}
        isImperial={false}
        periodLabel="Last 30 days"
      />,
    );
    expect(getByText("Last 30 days")).toBeTruthy();
  });

  it("omits the period label row when not provided", () => {
    const { queryByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "down", trendDeltaKg: -0.6 }}
        isImperial={false}
      />,
    );
    expect(queryByText(/Last/)).toBeNull();
  });

  it("always shows the WEIGHT and TREND small labels", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "stable", trendDeltaKg: 0 }}
        isImperial={false}
      />,
    );
    expect(getByText("WEIGHT")).toBeTruthy();
    expect(getByText("TREND")).toBeTruthy();
  });
});
