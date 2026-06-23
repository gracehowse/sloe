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
});
