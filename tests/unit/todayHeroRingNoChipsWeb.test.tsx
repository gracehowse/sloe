/**
 * TodayHeroRing (mobile-web) — chip-control reverted (2026-05-02).
 *
 * Pinned behaviour:
 *   - The `<md` (mobile-web) variant of the calorie ring no longer
 *     renders the Remaining/Consumed segmented chip control.
 *   - Mode-switching at this breakpoint flows through the long-press
 *     gesture inside the underlying ring (mirrors mobile parity).
 *   - The "Why this number?" pill (PR #31) still renders when the
 *     host provides `onPressWhy`.
 *
 * Desktop (`>= md`) intentionally keeps its own chip control inside
 * `TodayHeroStats` (no long-press equivalent on a mouse-driven UI) —
 * that divergence is documented in
 * `docs/decisions/2026-05-02-revert-today-ui-changes.md` and tested
 * separately.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { TodayHeroRing } from "../../src/app/components/suppr/today-hero-ring";

const baseProps = {
  consumed: 1200,
  target: 2000,
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
  displayMode: "remaining" as const,
};

describe("TodayHeroRing (mobile-web) — post-revert (2026-05-02)", () => {
  it("does NOT render the Remaining/Consumed segmented chip group", () => {
    const { queryByRole, queryByText } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onDisplayModeChange={() => {}}
      />,
    );
    // The chip group used `role="group"` with the
    // "Calorie ring display" aria-label.
    expect(queryByRole("group", { name: "Calorie ring display" })).toBeNull();
    // Both chip labels must be absent at this breakpoint.
    expect(queryByText("Remaining")).toBeNull();
    expect(queryByText("Consumed")).toBeNull();
  });

  it("renders the 'Why this number?' pill when onPressWhy is provided", () => {
    const onPressWhy = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onDisplayModeChange={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    const pill = getByTestId("today-hero-why-this-number");
    fireEvent.click(pill);
    expect(onPressWhy).toHaveBeenCalledTimes(1);
  });
});
