/**
 * DailyRing — empty-state track contrast (audit gap 1, 2026-06-09).
 *
 * On a cold open the ring is the largest object on Today, but the default
 * frost-mist track (`--ring-bg`, #EDEAF1 light) sat only ~10 luminance below
 * the card — the ring's defining shape was nearly invisible and read as an
 * unfinished placeholder. Fix: on the EMPTY state the outer track lifts to
 * `--border-strong` (#C9C2D6 light) and a 1px inner hairline ring is drawn so
 * the circle reads as intentional geometry. The FILLED state keeps the soft
 * `--ring-bg` frost-mist so the plum arc holds maximum contrast against it.
 *
 * Mirror of mobile `apps/mobile/tests/unit/calorieRingEmptyTrackContrast.test.tsx`.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

function strokes(container: HTMLElement): { stroke: string | null; strokeWidth: string | null }[] {
  return Array.from(container.querySelectorAll("circle")).map((c) => ({
    stroke: c.getAttribute("stroke"),
    strokeWidth: c.getAttribute("stroke-width"),
  }));
}

describe("DailyRing — empty-state track contrast (gap 1)", () => {
  it("empty ring paints the brand-gradient loop over the stronger track (ENG-1086)", () => {
    const { container } = render(<DailyRing consumed={0} target={2000} />);
    const s = strokes(container);
    // Outer track still lifts to --border-strong on the empty state (audit gap 1).
    expect(s.some((c) => c.stroke === "var(--border-strong)")).toBe(true);
    // ENG-1086 (default-on `ring_empty_gradient_v1`): the empty ring now paints
    // the brand-gradient loop instead of the old 1px grey hairline — the loop is
    // the largest object on cold-open Today, so it must read as a confident
    // brand surface, not a loading skeleton. The 1px hairline is the FLAG-OFF
    // kill-switch path (pinned in source by `ringEmptyGradient.test.ts`).
    expect(s.some((c) => c.stroke === "url(#ringEmptyGradient)")).toBe(true);
    expect(
      s.some((c) => c.stroke === "var(--border-strong)" && c.strokeWidth === "1"),
    ).toBe(false);
  });

  it("keeps the soft --ring-bg track once a value is logged (no over-darkening)", () => {
    const { container } = render(<DailyRing consumed={900} target={2000} />);
    const s = strokes(container);
    // Filled state: the outer track stays the soft frost-mist so the plum arc
    // holds contrast against it.
    expect(s.some((c) => c.stroke === "var(--ring-bg)")).toBe(true);
    // Neither the empty hairline nor the empty gradient loop renders once logged.
    expect(
      s.some((c) => c.stroke === "var(--border-strong)" && c.strokeWidth === "1"),
    ).toBe(false);
    expect(s.some((c) => c.stroke === "url(#ringEmptyGradient)")).toBe(false);
  });
});
