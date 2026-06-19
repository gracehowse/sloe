/**
 * ProgressPeriodControl (mobile) — Apple Health range grammar (ENG-1030).
 *
 * Behaviour pins for the live picker the user touches:
 *   - renders all five D/W/M/6M/Y segments + the period label
 *   - tapping a segment changes type and resets to the current period
 *   - the active segment carries selected a11y state
 *   - the ‹ chevron pages back, the › chevron pages forward (clamped)
 *   - on the current period the forward chevron is disabled (no future)
 *   - the label reflects the selected period via the shared helper
 *
 * The window/label maths itself is pinned exhaustively in
 * `tests/unit/progressPeriod.test.ts`; this file pins the wiring.
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    card: "#fff",
    text: "#111",
    textSecondary: "#666",
    inputBg: "#f4f4f6",
  }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primarySolid: "#7A5C8A", primarySoft: "rgba(122,92,138,0.18)" }),
}));

import { ProgressPeriodControl } from "../../components/progress/ProgressPeriodControl";
import type { ProgressPeriod } from "@suppr/nutrition-core/progressPeriod";

// Wed 10 Jun 2026 — fixed clock so labels are deterministic.
const NOW = new Date(2026, 5, 10, 14, 30, 0);

function renderControl(
  period: ProgressPeriod,
  onChange = vi.fn(),
) {
  const utils = render(
    <ProgressPeriodControl
      period={period}
      weekStart="monday"
      onChange={onChange}
      now={NOW}
    />,
  );
  return { ...utils, onChange };
}

describe("ProgressPeriodControl (mobile)", () => {
  it("renders all five segments and the period label", () => {
    const { getByTestId } = renderControl({ type: "W", offset: 0 });
    for (const seg of ["D", "W", "M", "6M", "Y"]) {
      expect(getByTestId(`progress-period-segment-${seg}`)).toBeTruthy();
    }
    // Current week containing Wed 10 Jun (monday-start) → "8–14 Jun".
    expect(getByTestId("progress-period-label").props.children).toBe("8–14 Jun");
  });

  it("tapping a segment switches type and resets to the current period", () => {
    const { getByTestId, onChange } = renderControl({ type: "W", offset: -3 });
    fireEvent.press(getByTestId("progress-period-segment-M"));
    expect(onChange).toHaveBeenCalledWith({ type: "M", offset: 0 });
  });

  it("tapping the already-selected segment is a no-op", () => {
    const { getByTestId, onChange } = renderControl({ type: "W", offset: 0 });
    fireEvent.press(getByTestId("progress-period-segment-W"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the active segment carries selected a11y state", () => {
    const { getByTestId } = renderControl({ type: "M", offset: 0 });
    expect(getByTestId("progress-period-segment-M").props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(getByTestId("progress-period-segment-W").props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("the prev chevron pages one period back", () => {
    const { getByTestId, onChange } = renderControl({ type: "W", offset: 0 });
    fireEvent.press(getByTestId("progress-period-prev"));
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("the next chevron pages forward when not at the present", () => {
    const { getByTestId, onChange } = renderControl({ type: "W", offset: -2 });
    fireEvent.press(getByTestId("progress-period-next"));
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("the next chevron is disabled on the current period (no future)", () => {
    const { getByTestId, onChange } = renderControl({ type: "W", offset: 0 });
    const next = getByTestId("progress-period-next");
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the label updates for a past period", () => {
    const { getByTestId } = renderControl({ type: "M", offset: -1 });
    expect(getByTestId("progress-period-label").props.children).toBe("May 2026");
  });
});
