/**
 * F-113 web parity (2026-05-07) — pin that the F-126 mobile fix
 * (commit a117789, "Journey numbers wrong") is also wired on web.
 *
 * Mobile Progress passes `timeline.weeklyRateKg` (via
 * `observedKgPerWeek`) to `projectWeight` so the Journey card
 * respects the observed scale rate instead of forecasting from a
 * stale TDEE estimate. The same code path on web (ProgressDashboard)
 * was missing the `observedKgPerWeek` argument until this PR, which
 * left web users seeing the same wrong numbers Grace reported on
 * mobile pre-#117.
 *
 * This test is a static-analysis pin: both Progress surfaces must
 * mention `observedKgPerWeek` so a future agent can't drop the
 * argument silently.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

const SURFACES: Array<{ path: string; minOccurrences: number }> = [
  // Mobile Progress tab — Journey card on `(tabs)/progress.tsx`.
  // F-126 added 1 declaration + 1 callsite arg.
  { path: "apps/mobile/app/(tabs)/progress.tsx", minOccurrences: 2 },
  // Web Progress dashboard — same Journey card.
  { path: "src/app/components/ProgressDashboard.tsx", minOccurrences: 2 },
];

describe("F-113 web parity — Journey card uses observedKgPerWeek on both surfaces", () => {
  it.each(SURFACES)("$path mentions observedKgPerWeek (>= $minOccurrences times)", ({ path, minOccurrences }) => {
    const src = readFileSync(resolve(REPO, path), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const count = (code.match(/observedKgPerWeek/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(minOccurrences);
  });

  it.each(SURFACES)("$path derives observedKgPerWeek from timeline.weeklyRateKg", ({ path }) => {
    const src = readFileSync(resolve(REPO, path), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).toMatch(/timeline\.weeklyRateKg/);
    expect(code).toMatch(/timeline\.trendDirection/);
  });
});
