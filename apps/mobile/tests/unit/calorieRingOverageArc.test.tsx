// @vitest-environment jsdom
/**
 * CalorieRing — Apple-Watch overage WRAP rule (redesign 2026-06-04, Grace
 * decision + Mobbin field scan: Lifesum / Any Distance / MacroFactor / Bevel
 * all KEEP the ring hue when over and show overage as a SECOND lap wrapping
 * past 100%, never a red switch).
 *
 * This SUPERSEDES the 2026-06-03 "plum full ring + separate RED overage arc"
 * treatment (which Grace read as odd — "one end of the line curved in and one
 * out"). The over-budget grammar is now:
 *   - the calorie ring itself STAYS PLUM (drawn as a full ring when
 *     consumed >= goal);
 *   - the portion past 100% is a SECOND lap in a LIFTED plum
 *     (`#6A4B7A` light / `#9A7BAA` dark) — same family, one step lighter so
 *     the two laps separate despite the shared hue. NO red anywhere;
 *   - a soft GLOW (a lighter semi-opaque dot, `#9A7BAA` light / `#C4ACD0`
 *     dark) sits on the wrap's LEADING cap — the Apple overflow highlight.
 *
 * What this test protects (fails if red returns, if the wrap loses its plum
 * family, or if the leading-cap glow disappears):
 *   1. When over budget, the base calorie ring is still PLUM (the ring did
 *      not recolour itself red — the pre-Sloe `isOver ? destructive` bug).
 *   2. When over budget, NO arc uses the retired Sloe over-red
 *      (`#C0533F` light / `#DC6B55` dark) — the red overage arc is gone.
 *   3. When over budget, the overage LAP renders in the lifted-plum family.
 *   4. When over budget, the leading-cap GLOW element is present (a lighter
 *      plum fill).
 *   5. NO node references the retired `overHash` diagonal pattern.
 *   6. Under budget renders the plum ring and NO overage lap / glow.
 *
 * Rendered through the `TodayHeroRing` wrapper (matches the sibling
 * `calorieRingGoalZeroCalibrating` test — the SVG/Reanimated bits are
 * easiest to exercise through the wrapper that already works in-suite).
 * The `react-native-svg` test shim forwards every prop (incl. `stroke` and
 * `fill`) onto a host View, so a tree walk can read the arc/dot colours.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";
import { MacroColors, Colors } from "../../constants/theme";

void React;

// The RNTL/jsdom test environment reports `useColorScheme() === "dark"`,
// so the ring renders the DARK tokens. Accept either the light or dark
// values so the test is colour-scheme-agnostic and still pins the wrap rule.
const PLUM_LIGHT = MacroColors.calories.toUpperCase(); // #3B2A4D
const PLUM_DARK = "#815E91";
// Retired Sloe over-red — must NOT appear when over any more.
const OVER_RED_LIGHT = Colors.light.overBudgetFg.toUpperCase(); // #C0533F
const OVER_RED_DARK = Colors.dark.overBudgetFg.toUpperCase(); // #DC6B55
// Lifted-plum overage lap (one step lighter than the base plum, both modes).
const LAP_LIGHT = "#6A4B7A";
const LAP_DARK = "#9A7BAA";
// Leading-cap glow (lighter still).
const GLOW_LIGHT = "#9A7BAA";
const GLOW_DARK = "#C4ACD0";

const isPlum = (s: string) => s === PLUM_LIGHT || s === PLUM_DARK;
const isOverRed = (s: string) => s === OVER_RED_LIGHT || s === OVER_RED_DARK;
const isOverageLap = (s: string) => s === LAP_LIGHT || s === LAP_DARK;
const isGlow = (s: string) => s === GLOW_LIGHT || s === GLOW_DARK;

/** Collect every `stroke` prop value present anywhere in the tree. */
function collectStrokes(root: any): string[] {
  const out: string[] = [];
  function walk(node: any) {
    if (!node) return;
    const stroke = node?.props?.stroke;
    if (typeof stroke === "string") out.push(stroke);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) walk(c);
  }
  walk(root);
  return out;
}

/** Collect every `fill` prop value present anywhere in the tree. */
function collectFills(root: any): string[] {
  const out: string[] = [];
  function walk(node: any) {
    if (!node) return;
    const fill = node?.props?.fill;
    if (typeof fill === "string") out.push(fill);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) walk(c);
  }
  walk(root);
  return out;
}

/** Serialise the whole tree so we can assert the hash pattern is gone. */
function treeString(json: unknown): string {
  return JSON.stringify(json);
}

const baseProps = {
  baseGoal: undefined,
  textColor: "#221B26",
  secondaryColor: "#6A6072",
  trackColor: "#EDEAF1",
  cardBackgroundColor: "#F6F5F2",
  borderColor: "#E8E2EC",
  textTertiaryColor: "#9B93A3",
  proteinPct: 0.6,
  carbsPct: 0.6,
  fatPct: 0.6,
  expanded: true,
  onToggleExpanded: () => {},
  onToggleDisplayMode: () => {},
  displayMode: "consumed" as const,
} as const;

describe("CalorieRing — Apple-Watch overage wrap (plum lap, no red)", () => {
  it("over budget: base ring stays PLUM (not recoloured red)", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some(isPlum)).toBe(true);
  });

  it("over budget: NO red overage arc anywhere (the red treatment is retired)", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    const fills = collectFills(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some(isOverRed)).toBe(false);
    expect(fills.some(isOverRed)).toBe(false);
  });

  it("over budget: the overage LAP renders in the lifted-plum family", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some(isOverageLap)).toBe(true);
  });

  it("over budget: a leading-cap GLOW element is present", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    const fills = collectFills(UNSAFE_root).map((s) => s.toUpperCase());
    expect(fills.some(isGlow)).toBe(true);
  });

  it("never references the retired `overHash` diagonal pattern", () => {
    const { toJSON } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    expect(treeString(toJSON())).not.toContain("overHash");
  });

  it("under budget: plum ring, NO overage lap and NO glow and NO red", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={1200} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    const fills = collectFills(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some(isPlum)).toBe(true);
    expect(strokes.some(isOverageLap)).toBe(false);
    expect(strokes.some(isOverRed)).toBe(false);
    expect(fills.some(isGlow)).toBe(false);
  });
});

/**
 * Empty-ring grey track — SLOE redesign (2026-06-03, S5 empty-Today
 * frame, Grace decision). The empty (nothing-logged-yet) ring used to
 * draw a blue "calibrating" gradient (`#588CE4 → #7BA3EA`, the
 * `ringIdle` LinearGradient). That gradient is removed: the empty ring
 * now uses the Sloe grey `trackColor` in every state.
 *
 * What this protects (fails if the blue gradient returns, or if the
 * empty ring paints anything other than the grey track):
 *   1. The blue calibrating hue (#588CE4) appears in NO stroke when
 *      the ring is empty (consumed === 0).
 *   2. The Sloe grey track colour IS present when empty.
 *   3. The retired `ringIdle` gradient id is gone from the tree.
 */
describe("CalorieRing — empty-ring grey track (no blue calibrating gradient)", () => {
  const BLUE_IDLE = "#588CE4";
  // Empty-state track lifts to `borderStrong` (audit gap 1, 2026-06-09) so
  // the ring shape reads clearly on a cold open — NOT the soft frost-mist
  // `trackColor` (#EDEAF1). Accept either light or dark value so the test is
  // colour-scheme-agnostic (the RNTL jsdom env reports dark, so the dark token
  // is the one actually rendered, but both are valid design-system values).
  const EMPTY_TRACK_LIGHT = Colors.light.borderStrong.toUpperCase(); // #C9C2D6
  const EMPTY_TRACK_DARK = Colors.dark.borderStrong.toUpperCase();   // #47424F
  const isEmptyTrack = (s: string) =>
    s === EMPTY_TRACK_LIGHT || s === EMPTY_TRACK_DARK;

  it("empty (consumed 0): NO blue #588CE4 stroke anywhere", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some((s) => s === BLUE_IDLE)).toBe(false);
  });

  it("empty (consumed 0): the lifted borderStrong track colour is present", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some(isEmptyTrack)).toBe(true);
  });

  it("empty with no goal yet (goal 0): still uses borderStrong track, no blue", () => {
    const { UNSAFE_root } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={0} />,
    );
    const strokes = collectStrokes(UNSAFE_root).map((s) => s.toUpperCase());
    expect(strokes.some((s) => s === BLUE_IDLE)).toBe(false);
    expect(strokes.some(isEmptyTrack)).toBe(true);
  });

  it("never references the retired `ringIdle` calibrating gradient", () => {
    const { toJSON } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(treeString(toJSON())).not.toContain("ringIdle");
  });
});
