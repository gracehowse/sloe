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
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-reduce-motion", () => ({ useReduceMotion: () => true }));

import { CalorieRingDial } from "../../components/charts/CalorieRingDial";
import { TodayHeroRing } from "../../components/today/TodayHeroRing";

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

// ENG-1571 (ruling 2026-07-17) — flat dial material, ALL states, both themes:
// the core/rim radial-bloom circles stay REMOVED. Parity twin of the web
// block in `tests/unit/calorieRingDial.test.tsx` — see its header for why
// `dial_flat_material_v1` was intentionally not registered (the bloom was
// already dropped unconditionally on 2026-06-22, commit 03946c62; there is
// no bloom path left to flag-gate — not a gap). Pins the flat material so
// the ENG-1247 prototype-conformance pass can't re-teach the bloom back in.
// Kept jewel identity: 48 graduation ticks, the state-gradient def, and the
// lead-segment gem cap (absent at a full dial — no leading edge).
describe("CalorieRingDial — flat material, no radial bloom (ENG-1571)", () => {
  /** Flatten the rendered tree; the rn-svg shim tags nodes `data-svg-stub`. */
  function collect(node: any, out: any[] = []): any[] {
    if (!node) return out;
    out.push(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) collect(c, out);
    return out;
  }

  function expectFlat(consumed: number, target: number, gemCaps: number) {
    const { toJSON } = render(
      <CalorieRingDial consumed={consumed} target={target} />,
    );
    const nodes = collect(toJSON());
    const stubs = (name: string) =>
      nodes.filter((n) => n?.props?.["data-svg-stub"] === name);
    // No bloom: zero RadialGradient defs, zero Circle geometry — the dial is
    // Rects-only in every state.
    expect(stubs("RadialGradient").length).toBe(0);
    expect(stubs("Circle").length).toBe(0);
    // Kept: all 48 frost graduation ticks (the height-14 track rects)…
    expect(stubs("Rect").filter((n) => n.props.height === 14).length).toBe(48);
    // …the per-state tick gradient def…
    expect(stubs("LinearGradient").length).toBe(1);
    // …and the lead-segment gem cap (the height-6 sparkle rect) where a
    // leading edge exists.
    expect(stubs("Rect").filter((n) => n.props.height === 6).length).toBe(
      gemCaps,
    );
  }

  it("empty state is flat: no bloom nodes, ticks + gem cap intact", () => {
    expectFlat(0, 2000, 1);
  });

  it("under-budget state is flat: no bloom nodes, ticks + gem cap intact", () => {
    expectFlat(1200, 2000, 1);
  });

  it("over-budget state is flat: no amber halo around 'kcal over' (trust posture)", () => {
    expectFlat(2300, 2000, 0);
  });
});

// ENG-1465 — the v3 dial swap dropped the legacy `CalorieRing` tap/long-press
// macro toggle (`Pressable onPress={onToggle} onLongPress={onToggle}`). These
// pin the restored gesture end-to-end: dial → graphic → hero host.
describe("CalorieRingDial — tap-to-toggle (ENG-1465)", () => {
  it("tap AND long-press both fire onToggle (legacy CalorieRing parity)", () => {
    const onToggle = vi.fn();
    const { getByTestId } = render(
      <CalorieRingDial consumed={1200} target={2000} onToggle={onToggle} />,
    );
    fireEvent.press(getByTestId("calorie-ring-dial"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent(getByTestId("calorie-ring-dial"), "longPress");
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("the Today hero wires the dial tap to the macro-expanded toggle", () => {
    const onToggleExpanded = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        consumed={1200}
        goal={2000}
        baseGoal={2000}
        textColor="#000"
        secondaryColor="#666"
        trackColor="#ddd"
        cardBackgroundColor="#fff"
        borderColor="#eee"
        textTertiaryColor="#999"
        proteinPct={0.5}
        carbsPct={0.5}
        fatPct={0.5}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
      />,
    );
    fireEvent.press(getByTestId("calorie-ring-dial"));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });
});
