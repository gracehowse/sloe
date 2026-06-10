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
  it("lifts the empty outer track to --border-strong and draws a 1px inner hairline", () => {
    const { container } = render(<DailyRing consumed={0} target={2000} />);
    const s = strokes(container);
    // Outer track + empty progress arc both reference the stronger token.
    expect(s.some((c) => c.stroke === "var(--border-strong)")).toBe(true);
    // A 1px inner hairline at --border-strong is present on the empty ring.
    expect(
      s.some((c) => c.stroke === "var(--border-strong)" && c.strokeWidth === "1"),
    ).toBe(true);
  });

  it("keeps the soft --ring-bg track once a value is logged (no over-darkening)", () => {
    const { container } = render(<DailyRing consumed={900} target={2000} />);
    const s = strokes(container);
    // Filled state: the outer track stays the soft frost-mist so the plum arc
    // holds contrast against it.
    expect(s.some((c) => c.stroke === "var(--ring-bg)")).toBe(true);
    // The 1px empty hairline is gone once logged.
    expect(
      s.some((c) => c.stroke === "var(--border-strong)" && c.strokeWidth === "1"),
    ).toBe(false);
  });
});
