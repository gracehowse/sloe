/**
 * ENG-1031 — WeightChart horizontal swipe-to-page (Progress tab).
 *
 * The swipe gesture is purely ADDITIVE on top of the ENG-1030 segmented
 * control + ‹/› chevron paging. It pages between periods when the user drags
 * horizontally across the chart area:
 *   - swipe RIGHT (dx ≥ +64) → previous (older) period
 *   - swipe LEFT  (dx ≤ -64) → next (newer) period, clamped to the present
 *
 * The PanResponder runtime is absent in the mobile test shim, so the gesture
 * decision is extracted into two pure helpers we test directly here — real
 * behavioural coverage of the threshold / direction / clamp / vertical-scroll
 * guard, not a string grep:
 *   - `shouldClaimChartSwipe(dx, dy)` — capture-phase claim predicate
 *   - `resolveChartSwipe(dx, canSwipeNext)` — release-phase commit decision
 *
 * Plus a thin source pin on `app/(tabs)/progress.tsx` confirming the wiring
 * reuses the SAME shared prev/next helpers + selection haptic the chevrons
 * use (no duplicated clamp), per the ENG-1031 brief.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SWIPE_CLAIM_PX,
  SWIPE_COMMIT_PX,
  resolveChartSwipe,
  shouldClaimChartSwipe,
} from "../../components/progress/WeightChart";

describe("WeightChart swipe — claim predicate (vertical-scroll safety)", () => {
  it("uses the shared 10px claim deadzone and 64px commit threshold (both platforms)", () => {
    expect(SWIPE_CLAIM_PX).toBe(10);
    expect(SWIPE_COMMIT_PX).toBe(64);
  });

  it("does NOT claim a near-still / tap-sized drag (under the 10px deadzone)", () => {
    expect(shouldClaimChartSwipe(0, 0)).toBe(false);
    expect(shouldClaimChartSwipe(8, 0)).toBe(false);
    expect(shouldClaimChartSwipe(-9, 2)).toBe(false);
  });

  it("does NOT claim a vertical drag — page scroll must still win", () => {
    // Large vertical travel with tiny horizontal jitter → ScrollView keeps it.
    expect(shouldClaimChartSwipe(4, 120)).toBe(false);
    // Equal dx/dy is ambiguous → don't steal (|dx| must EXCEED |dy|).
    expect(shouldClaimChartSwipe(40, 40)).toBe(false);
    // Diagonal but mostly-vertical → don't steal.
    expect(shouldClaimChartSwipe(30, 50)).toBe(false);
  });

  it("claims a clearly-horizontal drag past the deadzone (either direction)", () => {
    expect(shouldClaimChartSwipe(20, 5)).toBe(true);
    expect(shouldClaimChartSwipe(-20, 5)).toBe(true);
    expect(shouldClaimChartSwipe(64, 10)).toBe(true);
  });
});

describe("WeightChart swipe — commit decision (direction + clamp)", () => {
  it("swipe RIGHT past +64 → previous (older) period", () => {
    expect(resolveChartSwipe(64, true)).toBe("prev");
    expect(resolveChartSwipe(200, false)).toBe("prev");
  });

  it("swipe LEFT past -64 → next (newer) period when forward is allowed", () => {
    expect(resolveChartSwipe(-64, true)).toBe("next");
    expect(resolveChartSwipe(-200, true)).toBe("next");
  });

  it("respects the no-future clamp — LEFT swipe is inert on the current period", () => {
    // canSwipeNext=false mirrors the disabled forward chevron at offset >= 0.
    expect(resolveChartSwipe(-64, false)).toBeNull();
    expect(resolveChartSwipe(-300, false)).toBeNull();
    // The clamp NEVER blocks paging backwards into history.
    expect(resolveChartSwipe(64, false)).toBe("prev");
  });

  it("does nothing for travel short of the 64px commit threshold", () => {
    expect(resolveChartSwipe(63, true)).toBeNull();
    expect(resolveChartSwipe(-63, true)).toBeNull();
    expect(resolveChartSwipe(0, true)).toBeNull();
  });
});

describe("WeightChart swipe — progress.tsx wiring (reuse, not duplicate)", () => {
  const REPO_ROOT = resolve(__dirname, "../../../..");
  const progressSrc = readFileSync(
    resolve(REPO_ROOT, "apps/mobile/app/(tabs)/progress.tsx"),
    "utf8",
  );

  it("wires onSwipePrev/onSwipeNext to the SAME shared previousPeriod/nextPeriod helpers the chevrons use", () => {
    expect(progressSrc).toMatch(/onSwipePrev=\{\(\) => \{[\s\S]*?setPeriod\(previousPeriod\(period\)\)/);
    expect(progressSrc).toMatch(/onSwipeNext=\{\(\) => \{[\s\S]*?setPeriod\(nextPeriod\(period\)\)/);
    // Imported from the shared period model (single source of clamp logic).
    expect(progressSrc).toMatch(
      /from "@suppr\/shared\/nutrition\/progressPeriod"/,
    );
  });

  it("fires the SAME selection haptic the chevron PressableScales emit", () => {
    // Chevrons use haptic="selection" (→ selectionAsync); haptics.select()
    // calls selectionAsync too — identical tone.
    expect(progressSrc).toMatch(/onSwipePrev=\{\(\) => \{\s*haptics\.select\(\)/);
    expect(progressSrc).toMatch(/onSwipeNext=\{\(\) => \{\s*haptics\.select\(\)/);
  });

  it("passes the no-future clamp via canSwipeNext, reusing isCurrentPeriod (the chevron's atCurrent check)", () => {
    expect(progressSrc).toContain("canSwipeNext={!isCurrentPeriod(period)}");
  });
});
