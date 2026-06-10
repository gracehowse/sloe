import { describe, expect, it } from "vitest";
import {
  calorieRingGeometryForViewport,
  calorieRingGeometryFromSize,
} from "../../src/lib/nutrition/calorieRingGeometry";

describe("calorieRingGeometry", () => {
  it("matches mobile viewport formula (53% width, cap 230)", () => {
    const g = calorieRingGeometryForViewport(390);
    expect(g.size).toBe(207);
    expect(g.strokeWidth).toBe(10);
    expect(g.radius).toBe(Math.round(207 * 0.44));
  });

  it("caps size at 230 for wide viewports", () => {
    expect(calorieRingGeometryForViewport(500).size).toBe(230);
  });

  it("desktop hero uses proportional radii at size 160", () => {
    const g = calorieRingGeometryFromSize(160);
    expect(g.macroRadii[0]).toBe(Math.round(160 * 0.368));
  });
});
