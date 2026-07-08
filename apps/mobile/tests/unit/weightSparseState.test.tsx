// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — WeightSparseState render contract (mobile).
 *
 * The Progress weight card mounts this component whenever there are fewer
 * than 2 real weigh-ins (superseding the narrower ENG-1225 #22 gate, which
 * only covered the 0-point case). ALWAYS renders a chart frame (law 1):
 *   - 0 points → axis + optional goal band + a filled CTA inside the plot.
 *   - 1 point  → the point + a dotted projection toward the goal +
 *     "One more weigh-in unlocks your trend."
 * Web parity twin is `src/app/components/suppr/progress-weight-empty-state.tsx`.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    card: "#fff",
    border: "#ddd",
    surfaceWarm: "#F9F3EB",
  }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#A0552E" }),
}));

import { WeightSparseState } from "../../components/progress/WeightSparseState";
import type { WeightPoint } from "@/lib/progress/weightTrend";

const pt = (dateISO: string, kg: number): WeightPoint => ({ dateISO, kg, source: "manual" });

describe("WeightSparseState — 0 weigh-ins (mobile)", () => {
  it("always renders the chart frame ground (warm-tint, law 1) with the CTA inside the plot area", () => {
    const onLogWeight = vi.fn();
    const { getByTestId, getByText } = render(
      <WeightSparseState points={[]} onLogWeight={onLogWeight} />,
    );
    expect(getByTestId("weight-sparse-state")).toBeTruthy();
    expect(getByText("Log your first weigh-in")).toBeTruthy();
    fireEvent.press(getByText("Log your first weigh-in"));
    expect(onLogWeight).toHaveBeenCalledTimes(1);
  });

  it("renders a dashed goal band + goal caption when a goal is set", () => {
    const { getByText } = render(
      <WeightSparseState points={[]} goalKg={68} onLogWeight={vi.fn()} />,
    );
    expect(getByText(/Goal 68\.0 kg/)).toBeTruthy();
  });
});

describe("WeightSparseState — 1 weigh-in (mobile)", () => {
  it("renders the point + 'unlocks your trend' copy (no trend claim yet)", () => {
    const onLogWeight = vi.fn();
    const { getByText } = render(
      <WeightSparseState points={[pt("2026-06-01", 72.4)]} onLogWeight={onLogWeight} />,
    );
    expect(getByText(/72\.4/)).toBeTruthy();
    expect(getByText("One more weigh-in unlocks your trend.")).toBeTruthy();
    fireEvent.press(getByText("Log weight"));
    expect(onLogWeight).toHaveBeenCalledTimes(1);
  });

  it("renders without crashing when a goal is set (dotted projection toward the goal marker)", () => {
    const { getByTestId } = render(
      <WeightSparseState points={[pt("2026-06-01", 72.4)]} goalKg={68} onLogWeight={vi.fn()} />,
    );
    expect(getByTestId("weight-sparse-state")).toBeTruthy();
  });
});
