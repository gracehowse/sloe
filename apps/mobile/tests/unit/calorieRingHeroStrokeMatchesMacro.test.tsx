// @vitest-environment jsdom
/**
 * CalorieRing — calorie hero stroke: a consistent step above the macros.
 *
 * HISTORY / REVERSAL (read this): build 57 (ENG-1064, TF57 F-164/165) thinned
 * the EXPANDED calorie arc to EQUAL the macro stroke after Grace flagged "Today
 * ring too fat" twice — but at the time the calorie track was the near-invisible
 * frost-mist, so a 0.05·S hero just looked like a fat band wrapping thin
 * hairlines. On 2026-06-16 Grace REOPENED the ring; with the new saturated
 * "greyed-full" track (docs/decisions/2026-06-16-ring-track-contrast.md) the
 * hero reads as intentional hierarchy, not a fat band. After an in-sim
 * prototype she approved **0.05·S (~11px) for the calorie ring in BOTH states**
 * (single ring + expanded hero), with macros staying 0.028·S. So:
 *   - the calorie ring is ONE thickness whether macros are shown or hidden (her
 *     explicit constraint — it must not jump on toggle);
 *   - the calorie ring is a deliberate step ABOVE the macros (hierarchy), no
 *     longer equal to them.
 *
 * What this test now protects:
 *   1. Expanded: calorie stroke (0.05·S) > macro stroke (0.028·S) — the hero
 *      hierarchy. (Reverses the old "must be equal" pin.)
 *   2. Consistency: collapsed single-ring stroke EQUALS the expanded calorie
 *      stroke — one width across the toggle (founder constraint 2026-06-16).
 *   3. Geometry: the thicker hero does not open an awkward WIDE calorie→protein
 *      gap — it sits no further from its first macro than the inter-macro gaps.
 *
 * Rendered through `CalorieRing` directly. The Today hero now defaults to the
 * v3 `CalorieRingDial` (the `sloe_v3_ring` flag is default-ON, no concentric
 * stroke arcs), so the stroke-width hierarchy is pinned by exercising the
 * still-shipping `CalorieRing` component itself. The `react-native-svg` test
 * shim forwards `strokeWidth` onto a host node, so a tree walk can read it.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import CalorieRing from "../../components/charts/CalorieRing";
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
    <CalorieRing
      consumed={1200}
      goal={2000}
      baseGoal={2000}
      textColor="#1A1A1A"
      secondaryColor="#6B6B6B"
      trackColor="#EDEAF1"
      proteinPct={0.6}
      carbsPct={0.5}
      fatPct={0.4}
      expanded={expanded}
      onToggle={() => {}}
    />,
  );
}

describe("CalorieRing hero stroke parity (F-164/165)", () => {
  it("expanded: the calorie hero stroke is a deliberate step above the macro stroke", () => {
    const geom = ringGeometry(false, false); // multi-ring (expanded)
    // Hierarchy (reverses the old ENG-1064 "must equal" pin, founder-approved
    // 2026-06-16): calorie hero 0.05·S > macro satellites 0.028·S.
    expect(geom.STROKE).toBe(Math.round(geom.SIZE * 0.05));
    expect(geom.MACRO_STROKE).toBe(Math.max(4, Math.round(geom.SIZE * 0.028)));
    expect(geom.STROKE).toBeGreaterThan(geom.MACRO_STROKE);

    const { UNSAFE_root } = renderRing(true);
    const widths = collectStrokeWidths(UNSAFE_root);
    // Both widths present: the thicker hero calorie stroke AND the thinner macro.
    expect(widths).toContain(geom.STROKE);
    expect(widths).toContain(geom.MACRO_STROKE);
  });

  it("calorie stroke is consistent collapsed vs expanded (no jump on toggle)", () => {
    // Founder constraint 2026-06-16: the calorie ring is ONE thickness whether
    // macros are shown or hidden — it no longer drops from 0.085·S to the macro
    // stroke when the single ring expands.
    const collapsed = ringGeometry(false, true);
    const expanded = ringGeometry(false, false);
    expect(collapsed.STROKE).toBe(expanded.STROKE);
    expect(collapsed.STROKE).toBe(Math.round(collapsed.SIZE * 0.05));
  });

  it("the thicker hero does not open an awkward WIDE calorie→protein gap", () => {
    const g = ringGeometry(false, false);
    const calInner = g.R - g.STROKE / 2;
    const calToProtein = calInner - (g.MACRO_R[0] + g.MACRO_STROKE / 2);
    const interMacro = [
      g.MACRO_R[0] - g.MACRO_STROKE / 2 - (g.MACRO_R[1] + g.MACRO_STROKE / 2),
      g.MACRO_R[1] - g.MACRO_STROKE / 2 - (g.MACRO_R[2] + g.MACRO_STROKE / 2),
    ];
    // The ENG-1064 concern was an awkward WIDE calorie→protein gap; the thicker
    // hero only TIGHTENS it. Guard: no overlap, and it sits no further from its
    // first macro than the inter-macro gaps.
    expect(calToProtein).toBeGreaterThan(0);
    expect(calToProtein).toBeLessThanOrEqual(Math.max(...interMacro) + 1);
  });
});
