/**
 * Withings-style chart header (Grace TF feedback 2026-05-11).
 *
 * Pins:
 *   - "WEIGHT: Stable" / "Losing weight" / "Gaining weight" / "—" status word
 *   - 2026-05-12 (Withings parity round 4): "Down" / "Up" renamed to
 *     "Losing weight" / "Gaining weight" — the Withings phrase carries
 *     the verdict; "Down" alone read as direction without context.
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
  it("renders 'Losing weight' status with negative delta (kg)", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "down", trendDeltaKg: -0.6 }}
        isImperial={false}
      />,
    );
    expect(getByText("Losing weight")).toBeTruthy();
    // Minus sign is the typographic minus, formatted to 1 dp.
    expect(getByText("−0.6 kg")).toBeTruthy();
  });

  it("renders 'Gaining weight' status with positive delta", () => {
    const { getByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "up", trendDeltaKg: 0.4 }}
        isImperial={false}
      />,
    );
    expect(getByText("Gaining weight")).toBeTruthy();
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

  it("renders dashes for both fields when truly no data (defensive — parent gates this out)", () => {
    // 2026-05-11 (Grace TF feedback — "only show no data where there
    // is none at all"): the status label for "no_data" is "—" (dash)
    // now, not the text "No data". The chart-card parent already
    // gates render on `points.length >= 1`, so this branch is
    // effectively unreachable; keeping the dash means if it ever does
    // render, it doesn't read as broken state.
    const { queryAllByText, queryByText } = render(
      <WeightTrendHeader
        trend={{ trendStatus: "no_data", trendDeltaKg: null }}
        isImperial={false}
      />,
    );
    // Two dashes — one in the status slot, one in the trend slot.
    expect(queryAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(queryByText("No data")).toBeNull();
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
