// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — ProgressWeightEmptyState render contract (web).
 * Mobile parity: `apps/mobile/tests/unit/weightSparseState.test.tsx`.
 */

import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { ProgressWeightEmptyState } from "../../src/app/components/suppr/progress-weight-empty-state";

describe("ProgressWeightEmptyState — 0 weigh-ins (web)", () => {
  it("always renders the chart-frame ground with the CTA inside the plot area", () => {
    const onLogWeight = vi.fn();
    const { getByTestId, getByText } = render(
      <ProgressWeightEmptyState points={[]} onLogWeight={onLogWeight} />,
    );
    expect(getByTestId("progress-weight-empty")).toBeTruthy();
    const cta = getByText("Log your first weigh-in");
    expect(cta).toBeTruthy();
    fireEvent.click(cta);
    expect(onLogWeight).toHaveBeenCalledTimes(1);
  });

  it("renders a dashed goal band + caption when a goal is set", () => {
    const { getByText } = render(
      <ProgressWeightEmptyState points={[]} goalKg={68} onLogWeight={vi.fn()} />,
    );
    expect(getByText(/Goal 68\.0 kg/)).toBeTruthy();
  });
});

describe("ProgressWeightEmptyState — 1 weigh-in (web)", () => {
  it("renders the point + 'unlocks your trend' copy (no trend claim yet)", () => {
    const onLogWeight = vi.fn();
    const { getByText } = render(
      <ProgressWeightEmptyState points={[{ kg: 72.4 }]} onLogWeight={onLogWeight} />,
    );
    expect(getByText(/72\.4/)).toBeTruthy();
    expect(getByText("One more weigh-in unlocks your trend.")).toBeTruthy();
    fireEvent.click(getByText("Log weight"));
    expect(onLogWeight).toHaveBeenCalledTimes(1);
  });
});
