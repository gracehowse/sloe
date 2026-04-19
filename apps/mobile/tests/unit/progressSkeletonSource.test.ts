/**
 * Mobile + web Progress screens — structural pins for the H-4 perf
 * fix (build 12, 2026-04-19, TestFlight `AEb7NcjnvK`).
 *
 * This test complements the render test at
 * `progressSkeletonFirstPaint.test.tsx` by reading the source files
 * directly and asserting the shape of the critical-path changes.
 * Source-grep pins are cheap and survive any RNTL / mock drift.
 *
 * What we pin:
 *
 * 1. Mobile `apps/mobile/app/(tabs)/progress.tsx`:
 *    - Loading branch renders `testID="progress-skeleton"` with four
 *      `progress-skeleton-tile-N` placeholders, NOT a bare
 *      `ActivityIndicator` screen.
 *    - `chartsReady` flag + `requestAnimationFrame` deferral exists.
 *    - `getDailyTargets` is called via `void ...then(...)`, not
 *      awaited before `setLoading(false)`.
 *
 * 2. Web `src/app/components/ProgressDashboard.tsx`:
 *    - `getDailyTargets` is called via `void ...then(...)`, mirroring
 *      the mobile deferral so the two surfaces can't drift on the
 *      first-paint critical path.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("Progress perf — H-4 structural pins", () => {
  const mobileSrc = read("apps/mobile/app/(tabs)/progress.tsx");
  const webSrc = read("src/app/components/ProgressDashboard.tsx");

  it("mobile loading branch renders a skeleton scaffold (not a bare spinner screen)", () => {
    // testID for the skeleton ScrollView.
    expect(mobileSrc).toContain('testID="progress-skeleton"');
    // Four placeholder tiles covering the 2x2 stat grid footprint.
    // Rendered via `testID={`progress-skeleton-tile-${i}`}` over
    // `[0, 1, 2, 3].map(...)`, so the literal prefix + the `map` with
    // that index tuple are the load-bearing source evidence.
    expect(mobileSrc).toContain("progress-skeleton-tile-");
    expect(mobileSrc).toMatch(/\[0,\s*1,\s*2,\s*3\]\.map/);
    // The old bare-spinner render (a single centred ActivityIndicator
    // with no header / tile chrome) must be gone. The post-fix loading
    // branch no longer uses `justifyContent: "center"` for the whole
    // screen — we grep for the specific string that marked the bare
    // spinner block.
    expect(mobileSrc).not.toMatch(
      /if \(loading\) \{\s*return \(\s*<View style=\{\{ flex: 1, backgroundColor: t\.bg, alignItems: "center", justifyContent: "center" \}\}>/,
    );
  });

  it("mobile defers chart mounting via `chartsReady` + requestAnimationFrame", () => {
    // `chartsReady` state exists.
    expect(mobileSrc).toMatch(/const \[chartsReady, setChartsReady\] = useState\(false\)/);
    // Gated effect calls `requestAnimationFrame`.
    expect(mobileSrc).toContain("requestAnimationFrame(() => setChartsReady(true))");
    // The effect resets the flag when `loading` goes back to true so a
    // pull-to-refresh re-stages the paint.
    expect(mobileSrc).toContain("setChartsReady(false)");
    // The chart region is gated on `chartsReady` — pin the conditional.
    expect(mobileSrc).toMatch(/\{!chartsReady \? \(/);
    // A placeholder card with a deterministic testID sits in the
    // pending slot so scroll position stays stable.
    expect(mobileSrc).toContain('testID="progress-charts-pending"');
  });

  it("mobile defers getDailyTargets off the first-paint critical path", () => {
    // Find the `loadData` body. The call must be inside a
    // fire-and-forget `void getDailyTargets(...).then(...)` chain,
    // NOT an `await getDailyTargets(...)` that blocks setLoading.
    expect(mobileSrc).toMatch(/void getDailyTargets\(supabase, userId, weekKeys\)\s*\.then\(/);
    // The pre-fix `const snapshots = await getDailyTargets(...)` line
    // that blocked `setLoading(false)` must be gone.
    expect(mobileSrc).not.toMatch(
      /const snapshots = await getDailyTargets\(supabase, userId, weekKeys\);/,
    );
    // `setLoading(false)` must appear BEFORE the deferred fetch so the
    // first paint unblocks as soon as profile + entries resolve.
    const setLoadingFalseIdx = mobileSrc.indexOf("setLoading(false)");
    const deferredFetchIdx = mobileSrc.indexOf("void getDailyTargets(supabase, userId, weekKeys)");
    expect(setLoadingFalseIdx).toBeGreaterThan(-1);
    expect(deferredFetchIdx).toBeGreaterThan(-1);
    expect(setLoadingFalseIdx).toBeLessThan(deferredFetchIdx);
  });

  it("web defers getDailyTargets off the first-paint critical path (parity with mobile)", () => {
    expect(webSrc).toMatch(/void getDailyTargets\(supabase, authedUserId, weekKeys\)\s*\.then\(/);
    expect(webSrc).not.toMatch(
      /const snapshots = await getDailyTargets\(supabase, authedUserId, weekKeys\);/,
    );
    const setLoadingFalseIdx = webSrc.indexOf("setLoading(false)");
    const deferredFetchIdx = webSrc.indexOf(
      "void getDailyTargets(supabase, authedUserId, weekKeys)",
    );
    expect(setLoadingFalseIdx).toBeGreaterThan(-1);
    expect(deferredFetchIdx).toBeGreaterThan(-1);
    expect(setLoadingFalseIdx).toBeLessThan(deferredFetchIdx);
  });
});
