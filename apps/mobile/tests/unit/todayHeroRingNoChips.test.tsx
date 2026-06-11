// @vitest-environment jsdom
/**
 * TodayHeroRing — SLOE redesign (2026-06-03, `01 · Today` frame).
 *
 * History:
 *   - 2026-05-02: a Remaining/Consumed segmented chip was added (PR #50)
 *     then REVERTED — found redundant with the ring long-press.
 *   - 2026-05-12 round 3: the "Why this number?" affordance was removed
 *     from Today entirely (it lives at Settings → Targets now).
 *   - 2026-06-03 (THIS): the SLOE redesign reinstates the visible
 *     Remaining/Consumed toggle (it's in the approved `01 · Today`
 *     frame, chip-right) per rollout-plan O-2 ("the Sloe prototype
 *     ring wins"). The toggle is the visible counterpart to the ring
 *     long-press; both fire `onToggleDisplayMode`.
 *
 * Pinned behaviour after the redesign:
 *   - Component RENDERS the Sloe Remaining/Consumed toggle
 *     (`today-ring-display-toggle`) + the status chip
 *     (`today-ring-status-chip`).
 *   - Tapping the toggle fires `onToggleDisplayMode`.
 *   - Component still does NOT render the old "Why this number?" pill
 *     nor the round-2 subtle "Why?" link, even when `onPressWhy` is
 *     provided (that affordance stayed removed). The `onPressWhy` prop
 *     remains on the type for backwards compat with host wiring.
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

describe("TodayHeroRing — SLOE redesign (2026-06-03)", () => {
  it("renders the status chip with NO Remaining/Consumed toggle (retired 2026-06-10)", () => {
    const { queryByTestId, queryByText } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(queryByTestId("today-ring-display-toggle")).toBeNull();
    expect(queryByText("Remaining")).toBeNull();
    expect(queryByText("Consumed")).toBeNull();
  });

  it("ignores the deprecated onToggleDisplayMode prop (no toggle to press)", () => {
    const fn = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} onToggleDisplayMode={fn} />,
    );
    expect(queryByTestId("today-ring-display-toggle")).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("does NOT render any 'Why?' affordance even when onPressWhy is provided (2026-05-12 round 3, kept)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
    expect(onPressWhy).not.toHaveBeenCalled();
  });
});
