/**
 * DailyRing — empty-state track contrast (audit gap 1, 2026-06-09).
 *
 * On a cold open the ring is the largest object on Today, but the default
 * frost-mist track (`--ring-bg`, #EDEAF1 light) sat only ~10 luminance below
 * the card — the ring's defining shape was nearly invisible and read as an
 * unfinished placeholder. Fix: on the EMPTY state the outer track lifts to
 * `--border-strong` (#C9C2D6 light) and a 1px inner hairline ring is drawn so
 * the circle reads as intentional geometry. The FILLED/logged state now uses a
 * saturated 24% plum tint (`--ring-track-bold`) for the same reason — the old
 * frost-mist `--ring-bg` was ~10/255 off the white card, so a partly-logged
 * ring read as empty (design-director 2026-06-16, Apple "greyed-full" grammar).
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

  it("uses the bold plum-tint track once a value is logged (Apple greyed-full grammar, 2026-06-16)", () => {
    const { container } = render(<DailyRing consumed={900} target={2000} />);
    const s = strokes(container);
    // Filled/logged state: the outer track is now a saturated 24% plum tint
    // (--ring-track-bold) so the UNFILLED arc reads as a confident "greyed-full"
    // ring, not the near-invisible frost-mist --ring-bg it used to be.
    expect(s.some((c) => c.stroke === "var(--ring-track-bold)")).toBe(true);
    expect(s.some((c) => c.stroke === "var(--ring-bg)")).toBe(false);
    // Neither the empty hairline nor the empty gradient loop renders once logged.
    expect(
      s.some((c) => c.stroke === "var(--border-strong)" && c.strokeWidth === "1"),
    ).toBe(false);
    expect(s.some((c) => c.stroke === "url(#ringEmptyGradient)")).toBe(false);
  });
});
