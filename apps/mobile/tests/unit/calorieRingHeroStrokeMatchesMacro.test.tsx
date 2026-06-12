// @vitest-environment jsdom
/**
 * CalorieRing — hero stroke matches the macro stroke (ENG-1064, TF57 F-164/165).
 *
 * Grace flagged this TWICE on build 57 ("Today ring too fat — match macro ring
 * stroke width"). In the MULTI-RING (expanded) state the outer calorie arc was
 * drawn at 0.05·S while the inner protein/carbs/fat arcs were 0.028·S, so the
 * hero band read as a fat outer ring wrapping thin inner hairlines. The fix
 * thins the multi-ring hero stroke to EQUAL the macro stroke.
 *
 * What this test protects (fails if the fat hero band returns):
 *   1. Expanded: the calorie progress arc strokeWidth EQUALS the macro arc
 *      strokeWidth — they are one even family.
 *   2. The collapsed single-ring keeps a confident bolder stroke (no macro
 *      rings on screen to mismatch) — guards against over-correcting the
 *      lone-ring mode to a too-thin hairline.
 *   3. Geometry helper: every adjacent ring gap stays even once the hero
 *      stroke thins (no awkward wide calorie→protein gap) — re-derived radii.
 *
 * Rendered through the `TodayHeroRing` wrapper (matches the sibling
 * `calorieRingOverageArc` / `calorieRingGoalZeroCalibrating` tests — the
 * SVG/Reanimated bits exercise cleanly through the wrapper). The
 * `react-native-svg` test shim forwards `strokeWidth` onto a host node, so a
 * tree walk can read it.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";
import { ringGeometry } from "../../components/charts/CalorieRing";

void React;

/** Collect every numeric `strokeWidth` prop value present anywhere in the tree. */
function collectStrokeWidths(root: any): number[] {
  const out: number[] = [];
  function walk(node: any) {
    if (!node) return;
    const sw = node?.props?.strokeWidth;
    if (typeof sw === "number") out.push(sw);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) walk(c);
  }
  walk(root);
  return out;
}

function renderRing(expanded: boolean) {
  return render(
    <TodayHeroRing
      consumed={1200}
      goal={2000}
      baseGoal={2000}
      textColor="#1A1A1A"
      secondaryColor="#6B6B6B"
      trackColor="#EDEAF1"
      cardBackgroundColor="#F6F5F2"
      borderColor="#E3DFEA"
      proteinPct={0.6}
      carbsPct={0.5}
      fatPct={0.4}
      expanded={expanded}
      onToggleExpanded={() => {}}
      textTertiaryColor="#9A9A9A"
    />,
  );
}

describe("CalorieRing hero stroke parity (F-164/165)", () => {
  it("expanded: the hero calorie arc stroke equals the macro arc stroke", () => {
    const geom = ringGeometry(false, false); // multi-ring (expanded, not bold)
    expect(geom.STROKE).toBe(geom.MACRO_STROKE);

    const { UNSAFE_root } = renderRing(true);
    const widths = collectStrokeWidths(UNSAFE_root);

    // The macro stroke must be present (macro arcs render when expanded)…
    expect(widths).toContain(geom.MACRO_STROKE);
    // …and the hero calorie arc must use the SAME width — never a fatter band.
    const heroWidths = widths.filter((w) => w === geom.STROKE);
    expect(heroWidths.length).toBeGreaterThan(0);
    // Nothing in the expanded ring is fatter than the matched stroke (the old
    // 0.05·S hero band would have been strictly fatter than the 0.028·S macro).
    const fatter = widths.filter((w) => w > geom.MACRO_STROKE && w > 1);
    expect(fatter).toHaveLength(0);
  });

  it("collapsed single-ring keeps a confident bolder stroke", () => {
    const collapsed = ringGeometry(false, true); // bold lone-ring mode
    const expanded = ringGeometry(false, false);
    expect(collapsed.STROKE).toBeGreaterThan(expanded.STROKE);
    expect(collapsed.STROKE).toBe(Math.round(collapsed.SIZE * 0.085));
  });

  it("re-derived radii keep every adjacent ring gap even", () => {
    const g = ringGeometry(false, false);
    const calInner = g.R - g.STROKE / 2;
    const gaps = [
      calInner - (g.MACRO_R[0] + g.MACRO_STROKE / 2),
      g.MACRO_R[0] - g.MACRO_STROKE / 2 - (g.MACRO_R[1] + g.MACRO_STROKE / 2),
      g.MACRO_R[1] - g.MACRO_STROKE / 2 - (g.MACRO_R[2] + g.MACRO_STROKE / 2),
    ];
    const max = Math.max(...gaps);
    const min = Math.min(...gaps);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
