// @vitest-environment jsdom
/**
 * TodayDashboardMacroRings (mobile, Sloe v3 macro "Rings" layout) — parity twin
 * of the web `tests/unit/macroRingsLayout.test.tsx`. Guards the dropped-
 * `transform` regression: each ring's lit segments distribute around the dial
 * (distinct `rotation` props). use-reduce-motion is mocked ON so grow resolves
 * synchronously.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-reduce-motion", () => ({ useReduceMotion: () => true }));

import { TodayDashboardMacroRings } from "../../components/today/TodayDashboardMacroRings";

void React;

function litRotations(node: any, out: number[] = []): number[] {
  if (!node) return out;
  const p = node.props ?? {};
  if (
    typeof p.fill === "string" &&
    p.fill.includes("url(") &&
    Number(p.opacity) > 0.9 &&
    p.rotation != null
  ) {
    out.push(Number(p.rotation));
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const c of children) litRotations(c, out);
  return out;
}

describe("TodayDashboardMacroRings — mobile v3 macro dials", () => {
  it("a 60%-filled macro dial lights across DISTINCT rotations (transform guard)", () => {
    const { toJSON } = render(
      <TodayDashboardMacroRings
        totals={{ protein: 60, carbs: 0, fat: 0, fiber: 0 }}
        targets={{ protein: 100, carbs: 200, fat: 60, fiber: 30 }}
      />,
    );
    const rots = litRotations(toJSON());
    expect(rots.length).toBeGreaterThan(18);
    expect(new Set(rots).size).toBeGreaterThan(18);
  });

  // ENG-1508 parity fixture — mirrors the web agreement test
  // (tests/unit/macroRingsLayout.test.tsx): gross carbs 150/200, fibre 10/30
  // → net 140/170. Rings must agree with Tiles/Bars via netCarbsForRow.
  it("routes the carbs dial through the net-carbs lens (label + net values)", () => {
    const { getByText, queryByText } = render(
      <TodayDashboardMacroRings
        totals={{ protein: 60, carbs: 150, fat: 20, fiber: 10 }}
        targets={{ protein: 100, carbs: 200, fat: 60, fiber: 30 }}
        netCarbsLensEnabled
      />,
    );
    expect(getByText("Net carbs")).toBeTruthy();
    expect(getByText("of 170g")).toBeTruthy();
    expect(queryByText("of 200g")).toBeNull();
    // Reduced-motion mock resolves the count-up synchronously → net 140.
    expect(getByText(/140/)).toBeTruthy();
  });

  it("refuses the Net carbs label when the user has no fibre target", () => {
    const { getByText, queryByText } = render(
      <TodayDashboardMacroRings
        totals={{ protein: 0, carbs: 150, fat: 0, fiber: 0 }}
        targets={{ protein: 100, carbs: 200, fat: 60, fiber: 0 }}
        netCarbsLensEnabled
      />,
    );
    expect(queryByText("Net carbs")).toBeNull();
    expect(getByText("Carbs")).toBeTruthy();
    expect(getByText("of 200g")).toBeTruthy();
  });
});
