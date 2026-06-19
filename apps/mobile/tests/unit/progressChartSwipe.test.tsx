/**
 * ENG-1031 parity pins — mobile chart-swipe paging (Progress tab).
 *
 * The pure threshold/direction/clamp maths is pinned behaviourally in
 * `weightChartSwipePaging.test.ts` (the extracted `shouldClaimChartSwipe` /
 * `resolveChartSwipe` helpers). THIS file pins the two pieces of WIRING that
 * close the loop with the web mirror, so the platforms can't drift:
 *
 *   1. `WeightChart` actually builds a `PanResponder` and SPREADS its
 *      `panHandlers` onto the chart container — i.e. the swipe lane is mounted,
 *      not just defined. (Distinct from the pure-helper pins, which would still
 *      pass if the responder were never attached.)
 *   2. `app/(tabs)/progress.tsx` wires the swipe to the SAME shared
 *      `previousPeriod` / `nextPeriod` helpers the chevrons use, fires the
 *      selection haptic, applies the 64px commit threshold, and passes the
 *      no-future clamp via `canSwipeNext`.
 *
 * Regex-source-pin style mirrors `weightChartSwipePaging.test.ts` and the web
 * mirror `progressChartSwipeWeb.test.ts` — the PanResponder runtime is absent
 * in the mobile test shim, so a structural source pin is the honest boundary
 * for "is the gesture lane mounted and wired", while behaviour lives in the
 * pure-helper file.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SWIPE_COMMIT_PX,
  resolveChartSwipe,
} from "../../components/progress/WeightChart";

const REPO_ROOT = resolve(__dirname, "../../../..");
const weightChartSrc = readFileSync(
  resolve(REPO_ROOT, "apps/mobile/components/progress/WeightChart.tsx"),
  "utf8",
);
const progressSrc = readFileSync(
  resolve(REPO_ROOT, "apps/mobile/app/(tabs)/progress.tsx"),
  "utf8",
);

describe("WeightChart — PanResponder swipe lane is attached", () => {
  it("imports PanResponder from react-native", () => {
    expect(weightChartSrc).toMatch(/import\s*\{[\s\S]*\bPanResponder\b[\s\S]*\}\s*from\s*"react-native"/);
  });

  it("builds a dedicated swipe responder via PanResponder.create", () => {
    // The swipe responder is separate from the scrubber's panResponder.
    expect(weightChartSrc).toMatch(/swipeResponder\s*=\s*useMemo/);
    expect(weightChartSrc).toMatch(/PanResponder\.create\(\{/);
  });

  it("spreads the swipe responder's panHandlers onto the chart container", () => {
    // The outer wrapper View takes the swipe panHandlers (capture-phase claim);
    // the inner View keeps the scrubber's panHandlers — both are spread.
    expect(weightChartSrc).toMatch(/\{\.\.\.swipeResponder\.panHandlers\}/);
    expect(weightChartSrc).toMatch(/\{\.\.\.panResponder\.panHandlers\}/);
  });

  it("claims on the move phase (capture) and commits on release via the pure helpers", () => {
    expect(weightChartSrc).toMatch(/onMoveShouldSetPanResponderCapture:\s*\(/);
    expect(weightChartSrc).toMatch(/shouldClaimChartSwipe\(g\.dx,\s*g\.dy\)/);
    expect(weightChartSrc).toMatch(/onPanResponderRelease:\s*\(/);
    expect(weightChartSrc).toMatch(/resolveChartSwipe\(g\.dx,\s*canSwipeNext\)/);
  });

  it("gates the forward (next) swipe on canSwipeNext — the no-future clamp at the responder", () => {
    // resolveChartSwipe(dx, canSwipeNext) returns "next" only when canSwipeNext;
    // the release handler routes "next" → onSwipeNext, so a clamped forward
    // swipe never reaches the callback. Pinned as live behaviour, not just src.
    expect(resolveChartSwipe(-SWIPE_COMMIT_PX, false)).toBeNull();
    expect(resolveChartSwipe(-SWIPE_COMMIT_PX, true)).toBe("next");
    // Backward paging into history is never clamped.
    expect(resolveChartSwipe(SWIPE_COMMIT_PX, false)).toBe("prev");
  });
});

describe("progress.tsx — swipe wiring reuses the chevron helpers (no duplicate clamp)", () => {
  it("imports the shared previousPeriod/nextPeriod/isCurrentPeriod from the period model", () => {
    expect(progressSrc).toMatch(/from "@suppr\/(?:shared\/nutrition|nutrition-core)\/progressPeriod"/);
    expect(progressSrc).toMatch(/\bpreviousPeriod\b/);
    expect(progressSrc).toMatch(/\bnextPeriod\b/);
    expect(progressSrc).toMatch(/\bisCurrentPeriod\b/);
  });

  it("wires onSwipePrev/onSwipeNext to the SAME setPeriod(previousPeriod/nextPeriod) the chevrons call", () => {
    expect(progressSrc).toMatch(/onSwipePrev=\{\(\) => \{[\s\S]*?setPeriod\(previousPeriod\(period\)\)/);
    expect(progressSrc).toMatch(/onSwipeNext=\{\(\) => \{[\s\S]*?setPeriod\(nextPeriod\(period\)\)/);
  });

  it("fires the SAME selection haptic the chevron PressableScales emit", () => {
    expect(progressSrc).toMatch(/onSwipePrev=\{\(\) => \{\s*haptics\.select\(\)/);
    expect(progressSrc).toMatch(/onSwipeNext=\{\(\) => \{\s*haptics\.select\(\)/);
  });

  it("passes the no-future clamp via canSwipeNext, reusing isCurrentPeriod (the chevron's atCurrent check)", () => {
    expect(progressSrc).toContain("canSwipeNext={!isCurrentPeriod(period)}");
  });

  it("the shared 64px commit threshold is the single source for both platforms", () => {
    // The mobile commit threshold is exported from WeightChart and equals 64;
    // the web mirror passes 64 into usePeriodSwipe (pinned in the web file).
    expect(SWIPE_COMMIT_PX).toBe(64);
  });
});
