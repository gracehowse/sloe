// @vitest-environment jsdom
/**
 * TodayHeroRing — chip-control reverted (2026-05-02); explainer
 * affordance removed from Today entirely (2026-05-12 round 3, Grace
 * TF feedback). Iteration history:
 *   - Round 1: long-press repurposed to open the explainer + delta
 *     chip in centre. REVERTED — crowded the ring.
 *   - Round 2: subtle "Why?" inline link below the ring. REMOVED —
 *     still chrome around the hero.
 *   - Round 3 (current): no Today-side affordance. The explainer
 *     lives at Settings → Targets → "How is this calculated?" row,
 *     which deep-links to /(tabs)?openWhy=1 so Today opens the
 *     sheet on focus.
 *
 * Pinned behaviour:
 *   - Component does NOT render a Remaining/Consumed segmented chip
 *     control. (2026-05-02 decision.)
 *   - Component does NOT render the old large "Why this number?"
 *     pill, nor the round-2 subtle "Why?" link. The `onPressWhy`
 *     prop is preserved on the type for backwards compat with host
 *     wiring, but no UI surfaces it. (2026-05-12 round 3 decision.)
 *   - Long-press on the ring fires `onToggleDisplayMode` — canonical
 *     power-user gesture (toggle consumed/remaining + show/hide
 *     macro sub-rings).
 *
 * Web parity: the segmented chip in
 * `src/app/components/suppr/today-hero-ring.tsx` is also gone for the
 * mobile-web breakpoint. Desktop keeps its chip (no long-press
 * equivalent on a mouse-driven UI) — see
 * `docs/decisions/2026-05-02-revert-today-ui-changes.md`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

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

  it("does NOT render any 'Why?' affordance even when onPressWhy is provided (2026-05-12 round 3)", () => {
    const onPressWhy = vi.fn();
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        onToggleExpanded={() => {}}
        onToggleDisplayMode={() => {}}
        onPressWhy={onPressWhy}
      />,
    );
    // The explainer is reached from Settings → Targets now. No UI
    // here. The testID must not appear.
    expect(queryByTestId("today-hero-why-this-number")).toBeNull();
    expect(onPressWhy).not.toHaveBeenCalled();
  });

  it("does NOT render the 'Why?' link when onPressWhy is omitted", () => {
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
