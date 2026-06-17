import { describe, expect, it } from "vitest";
import {
  calorieRingGeometryForViewport,
  calorieRingGeometryFromSize,
} from "../../src/lib/nutrition/calorieRingGeometry";

describe("calorieRingGeometry", () => {
  it("matches mobile viewport formula (53% width, cap 230)", () => {
    const g = calorieRingGeometryForViewport(390);
    expect(g.size).toBe(207);
    expect(g.radius).toBe(Math.round(207 * 0.44));
  });

  it("caps size at 230 for wide viewports", () => {
    expect(calorieRingGeometryForViewport(500).size).toBe(230);
  });

  // 2026-06-16 (founder, REVERSES ENG-1064): the calorie hero stroke (0.05·S) is
  // a deliberate step ABOVE the macro stroke (0.028·S) — the hierarchy. The
  // build-57 "too fat" read was a hero over an invisible track; the new bold
  // greyed-full track makes it read as intentional. Founder approved 0.05·S in-sim.
  it("calorie hero stroke is a step above the macro stroke (0.05·S vs 0.028·S)", () => {
    for (const size of [160, 207, 230]) {
      const g = calorieRingGeometryFromSize(size);
      expect(g.strokeWidth).toBe(Math.round(size * 0.05));
      expect(g.macroStroke).toBe(Math.max(4, Math.round(size * 0.028)));
      expect(g.strokeWidth).toBeGreaterThan(g.macroStroke);
    }
  });

  // Founder constraint 2026-06-16: the calorie ring is ONE thickness whether
  // macros are shown or hidden — the collapsed stroke EQUALS the expanded one.
  it("collapsed stroke equals the expanded calorie stroke (no jump on toggle)", () => {
    const g = calorieRingGeometryFromSize(230);
    expect(g.strokeWidthBold).toBe(g.strokeWidth);
    expect(g.strokeWidthBold).toBe(Math.round(230 * 0.05));
  });

  it("desktop hero uses the even-gap macro radii at size 160", () => {
    const g = calorieRingGeometryFromSize(160);
    expect(g.macroRadii).toEqual([
      Math.round(160 * 0.3855),
      Math.round(160 * 0.331),
      Math.round(160 * 0.2765),
    ]);
  });

  // The ENG-1064 concern was an awkward WIDE calorie→protein gap; the thicker
  // 0.05·S hero only TIGHTENS it. Guard: no overlap, and the hero sits no
  // further from its first macro than the inter-macro gaps.
  it("the thicker hero does not open a wide calorie→protein gap", () => {
    const g = calorieRingGeometryFromSize(230);
    const ms = g.macroStroke;
    const calInner = g.radius - g.strokeWidth / 2;
    const calToProtein = calInner - (g.macroRadii[0] + ms / 2);
    const interMacro = [
      g.macroRadii[0] - ms / 2 - (g.macroRadii[1] + ms / 2),
      g.macroRadii[1] - ms / 2 - (g.macroRadii[2] + ms / 2),
    ];
    expect(calToProtein).toBeGreaterThan(0);
    expect(calToProtein).toBeLessThanOrEqual(Math.max(...interMacro) + 1);
  });
});
