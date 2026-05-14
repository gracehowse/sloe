/**
 * TodayHeroRing (mobile-web) — chip-control reverted (2026-05-02);
 * pill dropped (2026-05-12 round 4, Grace TF, web parity with mobile).
 *
 * Pinned behaviour:
 *   - The mobile-web variant no longer renders the Remaining/Consumed
 *     segmented chip control (2026-05-02 decision).
 *   - The mobile-web variant no longer renders the "Why this number?"
 *     pill, even when the host provides `onPressWhy`. The audit called
 *     the pill out as signalling low confidence in the number. The
 *     explainer is now reached from /home?view=targets → "How is this
 *     calculated?" row, which opens the dialog inline on Targets. The
 *     `onPressWhy` prop is preserved on the type for backwards compat
 *     with host wiring, but no UI surfaces it.
 *   - Mode-switching at this breakpoint still flows through the
 *     long-press gesture inside the underlying ring.
 *
 * Desktop (`>= md`) keeps its own chip control inside `TodayHeroStats`
 * — that divergence is documented in
 * `docs/decisions/2026-05-02-revert-today-ui-changes.md`.
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

  it("does NOT render the 'Why this number?' pill even when onPressWhy is provided (2026-05-12 round 4)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onDisplayModeChange={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    // The pill testID must not appear on Today. The explainer lives
    // on /home?view=targets now.
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
    expect(onPressWhy).not.toHaveBeenCalled();
  });
});
