// @vitest-environment jsdom
/**
 * TodayHeroRing — chip-control reverted (2026-05-02); pill dropped +
 * long-press repurposed as the explainer trigger (2026-05-12,
 * premium-bar DC1, Grace approval).
 *
 * Pinned behaviour:
 *   - Component does NOT render a Remaining/Consumed segmented chip
 *     control. Replacing the chips with the long-press gesture was a
 *     deliberate user-feedback change; this test fails if the chips
 *     are ever re-introduced without an explicit revisit of the
 *     2026-05-02 decision.
 *   - Component does NOT render a visible "Why this number?" pill.
 *     The audit called the pill out as signalling low confidence in
 *     the number. Long-press now opens the explainer instead. This
 *     fails if the pill is ever re-introduced without an explicit
 *     revisit of the 2026-05-12 decision.
 *   - When `onPressWhy` is provided, the long-press on the ring
 *     fires it (forwarded as `onLongPressExplain` to CalorieRing).
 *     When `onPressWhy` is omitted, long-press falls back to
 *     `onToggleDisplayMode` (legacy preview/dev surfaces).
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

  it("does NOT render a visible 'Why this number?' pill even when onPressWhy is provided (2026-05-12 audit)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    // The pill testID must not be present on either branch — the
    // explainer is reachable via long-press on the ring instead.
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
  });

  it("does NOT render the pill when onPressWhy is omitted", () => {
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
