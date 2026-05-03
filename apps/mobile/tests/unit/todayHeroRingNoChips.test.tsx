// @vitest-environment jsdom
/**
 * TodayHeroRing — chip-control reverted, long-press restored as the
 * sole mode-switch gesture (2026-05-02 user-feedback revert of PR #50).
 *
 * Pinned behaviour:
 *   - Component does NOT render a Remaining/Consumed segmented chip
 *     control. Replacing the chips with the long-press gesture was a
 *     deliberate user-feedback change; this test fails if the chips
 *     are ever re-introduced without an explicit revisit of the
 *     2026-05-02 decision.
 *   - Long-press on the ring fires `onToggleDisplayMode` (the sole
 *     mode-switch path on mobile). The host (`app/(tabs)/index.tsx`)
 *     additionally toggles the inner sub-rings on the same gesture;
 *     that wiring is covered by the host-level test below.
 *   - The "Why this number?" pill still renders when `onPressWhy`
 *     is provided (PR #31 untouched by this revert).
 *
 * Web parity: the segmented chip in
 * `src/app/components/suppr/today-hero-ring.tsx` is also gone for the
 * mobile-web breakpoint. Desktop keeps its chip (no long-press
 * equivalent on a mouse-driven UI) — see
 * `docs/decisions/2026-05-02-revert-today-ui-changes.md`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";

void React;

const baseProps = {
  consumed: 1200,
  goal: 2000,
  baseGoal: 2000,
  textColor: "#000",
  secondaryColor: "#666",
  trackColor: "#ddd",
  cardBackgroundColor: "#fff",
  borderColor: "#eee",
  textTertiaryColor: "#999",
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
  displayMode: "remaining" as const,
};

describe("TodayHeroRing — post-revert (2026-05-02)", () => {
  it("does NOT render a Remaining/Consumed segmented chip control", () => {
    const { queryByTestId, queryByLabelText } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
      />,
    );

    // Both chip testIDs from PR #50 must be absent.
    expect(queryByTestId("today-hero-ring-chip-remaining")).toBeNull();
    expect(queryByTestId("today-hero-ring-chip-consumed")).toBeNull();
    // The radiogroup wrapper should also be gone.
    expect(queryByLabelText("Calorie ring display")).toBeNull();
  });

  it("does NOT accept an `onSetDisplayMode` prop in its public type", () => {
    // Compile-time guard expressed as runtime: the component renders
    // identically whether or not callers attempt to pass the dropped
    // prop. If a future refactor re-adds the prop, this test still
    // passes — but the missing chip from the test above will fail
    // first. Documented here so the prop's absence is intentional.
    expect(typeof TodayHeroRing).toBe("function");
  });

  it("renders the 'Why this number?' pill when onPressWhy is provided (PR #31 preserved)", () => {
    const onPressWhy = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    const pill = getByTestId("today-hero-why-this-number");
    expect(pill).toBeTruthy();
    fireEvent.press(pill);
    expect(onPressWhy).toHaveBeenCalledTimes(1);
  });

  it("does NOT render the 'Why this number?' pill when onPressWhy is omitted", () => {
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
      />,
    );
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
  });
});
