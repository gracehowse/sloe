// @vitest-environment jsdom

/**
 * ENG-1225 #22 — WeightSparseState render contract (mobile).
 *
 * The Progress weight card now mounts this component (was dead code) for
 * never-/barely-logged users in place of the broken "—" hero + dashes stat
 * row. These tests pin the three sparse branches it must cover and that its
 * built-in CTA fires the caller's `onLogWeight`. Web parity twin is
 * `src/app/components/suppr/progress-weight-empty-state.tsx` (0-branch only,
 * behind `web_progress_weight_empty`).
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    card: "#fff",
  }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#A0552E" }),
}));

import { WeightSparseState } from "../../components/progress/WeightSparseState";
import type { WeightPoint } from "@/lib/progress/weightTrend";

const pt = (dateISO: string, kg: number): WeightPoint => ({ dateISO, kg, source: "manual" });

describe("WeightSparseState — 0 weigh-ins (mobile)", () => {
  it("renders the empty prompt and fires onLogWeight from its CTA", () => {
    const onLogWeight = vi.fn();
    const { getByText } = render(<WeightSparseState points={[]} onLogWeight={onLogWeight} />);
    expect(getByText("No weigh-ins yet")).toBeTruthy();
    expect(getByText("Log your first weight to start a trend.")).toBeTruthy();
    fireEvent.press(getByText("Log weight"));
    expect(onLogWeight).toHaveBeenCalledTimes(1);
  });
});

describe("WeightSparseState — 1 weigh-in (mobile)", () => {
  it("renders the single-value hero + 'one weigh-in' copy", () => {
    const { getByText } = render(
      <WeightSparseState points={[pt("2026-06-01", 72.4)]} onLogWeight={vi.fn()} />,
    );
    // Hero numeral nests "72.4" + a sans " kg" in one Text node ("72.4 kg").
    expect(getByText(/72\.4/)).toBeTruthy();
    expect(getByText("One weigh-in logged")).toBeTruthy();
    expect(getByText("Add two more to see a trend line.")).toBeTruthy();
  });
});

describe("WeightSparseState — 2 weigh-ins (mobile)", () => {
  it("renders the two-point caption (trend appears at 3)", () => {
    const { getByText } = render(
      <WeightSparseState
        points={[pt("2026-06-01", 72.4), pt("2026-06-08", 71.8)]}
        onLogWeight={vi.fn()}
      />,
    );
    expect(getByText("Trend appears after 3 weigh-ins.")).toBeTruthy();
    expect(getByText("Log weight")).toBeTruthy();
  });
});
