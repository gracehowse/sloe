/**
 * TodayHeroRing (web) — status chip present, display toggle RETIRED.
 *
 * web ring parity 2026-06-10 (mobile ring wave): the Remaining/Consumed
 * segmented display toggle is RETIRED (it duplicated the Eaten stat below the
 * ring); only the status chip remains in the header row. Mirrors mobile
 * `TodayHeroRing`. This supersedes the 2026-06-04 "Figma-restored toggle" pin.
 *
 * The "Why this number?" pill stays dropped (2026-05-12 round 4).
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import { TodayHeroRing } from "../../src/app/components/suppr/today-hero-ring";

const baseProps = {
  consumed: 1200,
  target: 2000,
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
};

describe("TodayHeroRing (web) — chip present, display toggle retired (2026-06-10)", () => {
  it("renders the status chip", () => {
    const { getByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(getByTestId("today-ring-status-chip")).toBeTruthy();
  });

  it("does NOT render the Remaining/Consumed segmented display toggle", () => {
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(queryByTestId("today-ring-display-toggle")).toBeNull();
  });

  it("does NOT render the 'Why this number?' pill even when onPressWhy is provided (2026-05-12 round 4)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
    expect(onPressWhy).not.toHaveBeenCalled();
  });
});
