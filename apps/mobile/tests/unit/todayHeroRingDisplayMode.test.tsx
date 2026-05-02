// @vitest-environment jsdom
/**
 * TodayHeroRing — display-mode segmented control (Wave 8a parity, ui-critic
 * finding #9, 2026-05-01).
 *
 * Pinned behaviour:
 *   - Two chips render with labels "Remaining" and "Consumed".
 *   - Tapping a chip calls `onSetDisplayMode` with that mode.
 *   - The active chip is communicated via `accessibilityState.selected`.
 *   - Long-press still calls `onToggleDisplayMode` on the ring (no
 *     regression of the legacy gesture).
 *
 * The web equivalent lives in `src/app/components/suppr/today-hero-ring.tsx`
 * (lines 61-79) and is covered by `tests/unit/todayHeroStats.test.tsx` —
 * keep these two suites in lockstep when the chip behaviour changes.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react-native";

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
  carbsPct: 0.4,
  fatPct: 0.3,
  expanded: false,
  onToggleExpanded: () => {},
};

describe("TodayHeroRing display-mode segmented control", () => {
  it("renders both chips with the canonical labels", () => {
    const { getByTestId, getByText } = render(
      <TodayHeroRing
        {...baseProps}
        displayMode="remaining"
        onToggleDisplayMode={() => {}}
        onSetDisplayMode={() => {}}
      />,
    );

    expect(getByTestId("today-hero-ring-chip-remaining")).toBeTruthy();
    expect(getByTestId("today-hero-ring-chip-consumed")).toBeTruthy();
    // Labels are upper-cased visually via textTransform but the source
    // string in the node is title-case — assert on the source string so
    // the test isn't tied to the casing CSS.
    expect(getByText("Remaining")).toBeTruthy();
    expect(getByText("Consumed")).toBeTruthy();
  });

  it("marks the active chip via accessibilityState.selected", () => {
    const { getByTestId, rerender } = render(
      <TodayHeroRing
        {...baseProps}
        displayMode="remaining"
        onToggleDisplayMode={() => {}}
        onSetDisplayMode={() => {}}
      />,
    );

    const remaining = getByTestId("today-hero-ring-chip-remaining");
    const consumed = getByTestId("today-hero-ring-chip-consumed");

    expect(remaining.props.accessibilityState).toEqual({ selected: true });
    expect(consumed.props.accessibilityState).toEqual({ selected: false });

    act(() => {
      rerender(
        <TodayHeroRing
          {...baseProps}
          displayMode="consumed"
          onToggleDisplayMode={() => {}}
          onSetDisplayMode={() => {}}
        />,
      );
    });

    expect(remaining.props.accessibilityState).toEqual({ selected: false });
    expect(consumed.props.accessibilityState).toEqual({ selected: true });
  });

  it("calls onSetDisplayMode('consumed') when the Consumed chip is tapped", () => {
    const onSetDisplayMode = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        displayMode="remaining"
        onToggleDisplayMode={() => {}}
        onSetDisplayMode={onSetDisplayMode}
      />,
    );

    fireEvent.press(getByTestId("today-hero-ring-chip-consumed"));

    expect(onSetDisplayMode).toHaveBeenCalledTimes(1);
    expect(onSetDisplayMode).toHaveBeenCalledWith("consumed");
  });

  it("calls onSetDisplayMode('remaining') when the Remaining chip is tapped", () => {
    const onSetDisplayMode = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        displayMode="consumed"
        onToggleDisplayMode={() => {}}
        onSetDisplayMode={onSetDisplayMode}
      />,
    );

    fireEvent.press(getByTestId("today-hero-ring-chip-remaining"));

    expect(onSetDisplayMode).toHaveBeenCalledTimes(1);
    expect(onSetDisplayMode).toHaveBeenCalledWith("remaining");
  });

  it("does not regress the long-press gesture on the ring", () => {
    // The long-press handler is wired on the ring's central Pressable
    // inside `CalorieRing`. We don't have a stable testID on it, but we
    // can prove the prop is still flowing through by inspecting the rendered
    // tree for a node whose onLongPress equals our spy. This guards against
    // accidental removal of the legacy gesture when the chip control was
    // added.
    const onToggleDisplayMode = vi.fn();
    const { UNSAFE_root } = render(
      <TodayHeroRing
        {...baseProps}
        displayMode="remaining"
        onToggleDisplayMode={onToggleDisplayMode}
        onSetDisplayMode={() => {}}
      />,
    );

    const matches = UNSAFE_root.findAll(
      (node) => node.props && node.props.onLongPress === onToggleDisplayMode,
    );
    expect(matches.length).toBeGreaterThan(0);

    // And firing the long-press calls the host's toggle.
    fireEvent(matches[0], "longPress");
    expect(onToggleDisplayMode).toHaveBeenCalledTimes(1);
  });
});
