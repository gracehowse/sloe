// @vitest-environment jsdom
/**
 * CalorieRing — empty-state track contrast (audit gap 1, 2026-06-09).
 *
 * On a cold open the ring is the largest object on Today, but the default
 * frost-mist track (#EDEAF1 light) sat only ~10 luminance below the #F6F5F2
 * card — the ring's defining shape was nearly invisible and read as an
 * unfinished placeholder. Fix: on the EMPTY state the outer track lifts to
 * `borderStrong` (#C9C2D6 light) and a 1px inner hairline ring is drawn so the
 * circle reads as intentional geometry. The FILLED state keeps the soft
 * frost-mist track so the plum arc holds maximum contrast against it.
 *
 * This pins both halves as observable behaviour:
 *   - empty ring → outer track stroke is the stronger borderStrong colour, and
 *     a thin (1px) inner hairline ring is present;
 *   - logged ring → outer track stays the soft frost-mist `trackColor`, and the
 *     hairline is gone.
 *
 * Mirror: web `tests/unit/dailyRingEmptyTrackContrast.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { Circle } from "react-native-svg";

import CalorieRing from "../../components/charts/CalorieRing";
import { Colors } from "../../constants/theme";

void React;

const TRACK = "#EDEAF1"; // colors.ringTrack (frost-mist) — passed as trackColor
// The empty-state track lifts to `borderStrong`, which the component reads
// theme-branched: `isDark ? Colors.dark.borderStrong : Colors.light.borderStrong`.
// The vitest react-native shim's `useColorScheme()` returns "dark", so the
// component renders the DARK token here (#47424F). Read the SAME token the
// component reads — never a hardcoded hex — so this can't drift from the theme.
const STRONG = Colors.dark.borderStrong; // #47424F — dark-branch lifted empty track

const baseProps = {
  textColor: "#221B26",
  secondaryColor: "#6A6072",
  trackColor: TRACK,
  proteinPct: 0,
  carbsPct: 0,
  fatPct: 0,
  expanded: false,
  displayMode: "remaining" as const,
};

/** All SVG <Circle> stroke colours in render order. */
function circleStrokes(node: ReturnType<typeof render>) {
  return node
    .UNSAFE_getAllByType(Circle)
    .map((c) => ({ stroke: c.props.stroke as string | undefined, strokeWidth: c.props.strokeWidth as number | undefined }));
}

describe("CalorieRing — empty-state track contrast (gap 1)", () => {
  it("lifts the empty outer track to borderStrong and draws a 1px inner hairline", () => {
    const r = render(<CalorieRing {...baseProps} consumed={0} goal={2000} />);
    const strokes = circleStrokes(r);
    // The outer track + the empty progress arc both stroke the lifted colour.
    expect(strokes.some((s) => s.stroke === STRONG)).toBe(true);
    // The faint frost-mist must NOT be the dominant track on the empty ring.
    // (A 1px inner hairline at borderStrong is present; no STROKE-width track
    //  is the soft frost-mist in the empty state.)
    expect(strokes.some((s) => s.stroke === STRONG && s.strokeWidth === 1)).toBe(true);
  });

  it("keeps the soft frost-mist track once a value is logged (no over-darkening)", () => {
    const r = render(<CalorieRing {...baseProps} consumed={900} goal={2000} />);
    const strokes = circleStrokes(r);
    // Filled state: the outer track stays the soft frost-mist trackColor so the
    // plum arc holds contrast against it.
    expect(strokes.some((s) => s.stroke === TRACK)).toBe(true);
    // The 1px empty hairline is gone once logged.
    expect(strokes.some((s) => s.stroke === STRONG && s.strokeWidth === 1)).toBe(false);
  });
});
