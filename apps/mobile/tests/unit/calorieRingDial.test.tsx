// @vitest-environment jsdom
/**
 * CalorieRingDial (mobile jewel watch-dial) — parity twin of the web
 * `tests/unit/calorieRingDial.test.tsx`. Guards the dropped-`transform`
 * regression: lit segments must be DISTRIBUTED around the dial (distinct
 * `rotation` props), never stacked at rotation 0.
 *
 * use-reduce-motion is mocked ON so the mount-grow resolves synchronously
 * (grow → 1) and `drawn` equals progress without driving rAF. The
 * react-native-svg test shim forwards every prop onto a host node, so a tree
 * walk can read each segment's `fill` / `opacity` / `rotation`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-reduce-motion", () => ({ useReduceMotion: () => true }));

import { CalorieRingDial } from "../../components/charts/CalorieRingDial";

void React;

/** Rotations of the gradient-filled (lit) segments at full opacity. */
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

describe("CalorieRingDial — mobile jewel watch dial", () => {
  it("under budget lights ~60% across DISTINCT rotations (dropped-transform guard)", () => {
    const { toJSON } = render(
      <CalorieRingDial consumed={1200} target={2000} />,
    );
    const rots = litRotations(toJSON());
    expect(rots.length).toBeGreaterThan(20);
    expect(rots.length).toBeLessThan(40);
    expect(new Set(rots).size).toBeGreaterThan(20);
  });

  it("over budget fills all 48 segments", () => {
    const { toJSON } = render(
      <CalorieRingDial consumed={2300} target={2000} />,
    );
    expect(litRotations(toJSON()).length).toBe(48);
  });

  it("empty day lights only the leading mark", () => {
    const { toJSON } = render(<CalorieRingDial consumed={0} target={2000} />);
    expect(litRotations(toJSON()).length).toBeLessThanOrEqual(2);
  });
});
