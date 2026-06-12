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

  // ENG-1064 (TF57 F-164/165, Grace TWICE "Today ring too fat — match macro
  // ring stroke width"): the multi-ring hero stroke now equals the macro stroke
  // exactly. If this regresses, the hero band reads visibly fatter than its
  // inner arcs again — the exact complaint.
  it("multi-ring hero stroke matches the macro stroke exactly (F-164/165)", () => {
    for (const size of [160, 207, 230]) {
      const g = calorieRingGeometryFromSize(size);
      expect(g.strokeWidth).toBe(g.macroStroke);
      expect(g.strokeWidth).toBe(Math.max(4, Math.round(size * 0.028)));
    }
  });

  // The COLLAPSED single-ring mode keeps the confident bold stroke (no macro
  // rings on screen to mismatch) — mirrors mobile `ringGeometry`'s `bold` branch.
  it("exposes a bold collapsed stroke distinct from the matched multi-ring stroke", () => {
    const g = calorieRingGeometryFromSize(230);
    expect(g.strokeWidthBold).toBe(Math.round(230 * 0.085));
    expect(g.strokeWidthBold).toBeGreaterThan(g.strokeWidth);
  });

  it("desktop hero uses the even-gap macro radii at size 160", () => {
    const g = calorieRingGeometryFromSize(160);
    expect(g.macroRadii).toEqual([
      Math.round(160 * 0.3855),
      Math.round(160 * 0.331),
      Math.round(160 * 0.2765),
    ]);
  });

  // The even-gap re-derivation (ENG-1064): once the hero stroke thins to match
  // the macro stroke, every adjacent ring gap must stay even (no awkward wide
  // calorie→protein gap). Assert all three gaps are within 1px of each other.
  it("keeps even gaps between every adjacent ring once the hero stroke thins", () => {
    const g = calorieRingGeometryFromSize(230);
    const ms = g.macroStroke;
    const calInner = g.radius - g.strokeWidth / 2;
    const gaps = [
      calInner - (g.macroRadii[0] + ms / 2),
      g.macroRadii[0] - ms / 2 - (g.macroRadii[1] + ms / 2),
      g.macroRadii[1] - ms / 2 - (g.macroRadii[2] + ms / 2),
    ];
    const max = Math.max(...gaps);
    const min = Math.min(...gaps);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
