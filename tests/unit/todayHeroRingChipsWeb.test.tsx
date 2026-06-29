/**
 * TodayHeroRing (web) — status indicator present, display toggle RETIRED.
 *
 * web ring parity 2026-06-10 (mobile ring wave): the Remaining/Consumed
 * segmented display toggle is RETIRED (it duplicated the Eaten stat below the
 * ring); only the status indicator remains. Mirrors mobile `TodayHeroRing`.
 *
 * ENG-1247 flipped `today_hero_decard_v3` default-ON (ENG-1264 red main): the
 * hero is now the BARE de-carded block (testid `today-hero-decard`) with the
 * status rendered as a centered `RingStatusLine` BELOW the ring
 * (`today-ring-status-line`), replacing the carded hero's chip-above-the-ring
 * (`today-ring-status-chip`). The first block asserts that now-default v3
 * de-carded surface; the second block forces the flag OFF to keep guarding the
 * legacy carded hero with its status chip (the PostHog kill-switch path).
 *
 * The "Why this number?" pill stays dropped (2026-05-12 round 4) — flag-
 * independent, so it is asserted in both blocks.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
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

function forceDecard(value: boolean): void {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    today_hero_decard_v3: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

// ── v3 default de-carded hero (today_hero_decard_v3 ON — the shipped default) ─
describe("TodayHeroRing (web) — v3 de-carded hero (default)", () => {
  it("renders the bare de-carded hero block (no card chrome)", () => {
    const { getByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(getByTestId("today-hero-decard")).toBeTruthy();
  });

  it("renders the centered status LINE below the ring (not the carded chip)", () => {
    const { getByTestId, queryByTestId } = render(
      // consumed < target → "under" → status line renders (it hides on empty).
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(getByTestId("today-ring-status-line")).toBeTruthy();
    expect(queryByTestId("today-ring-status-chip")).toBeNull();
  });

  it("hides the status line on an empty day (consumed 0)", () => {
    const { queryByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={0}
        onToggleExpanded={() => {}}
      />,
    );
    expect(queryByTestId("today-ring-status-line")).toBeNull();
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

// ── Legacy carded hero (today_hero_decard_v3 forced OFF — kill-switch path) ──
// Forced OFF deliberately: guards the pre-v3 carded hero + its status CHIP
// above the ring, which stays live behind the kill switch. Do not delete.
describe("TodayHeroRing (web) — legacy carded hero (flag forced OFF)", () => {
  it("renders the status chip", () => {
    forceDecard(false);
    const { getByTestId, queryByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(getByTestId("today-ring-status-chip")).toBeTruthy();
    // The de-carded block + its status line are absent in the carded hero.
    expect(queryByTestId("today-hero-decard")).toBeNull();
    expect(queryByTestId("today-ring-status-line")).toBeNull();
  });

  it("does NOT render the Remaining/Consumed segmented display toggle", () => {
    forceDecard(false);
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} onToggleExpanded={() => {}} />,
    );
    expect(queryByTestId("today-ring-display-toggle")).toBeNull();
  });

  it("does NOT render the 'Why this number?' pill even when onPressWhy is provided (2026-05-12 round 4)", () => {
    forceDecard(false);
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
