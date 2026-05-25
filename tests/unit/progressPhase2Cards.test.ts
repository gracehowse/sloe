/**
 * Progress Phase 2 cards — source-grep pins (2026-04-20 prototype port).
 *
 * Two new cards sit directly below the range picker on both platforms:
 *   1. WEIGHT card — uppercase overline, on-track green pill, big
 *      weight number, weekly delta with trend icon, sparkline,
 *      projection caption.
 *   2. Calories card — overline inside the card; card shows
 *      big `avg/day`, `vs target` pill top-right, adherence subtitle.
 *
 * Both cards read from the shared `progressRangeStats` helpers so web
 * + mobile can't drift. The range state drives the window.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const MOBILE = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"), "utf8");
const WEB = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");
const HELPER = readFileSync(resolve(ROOT, "src/lib/nutrition/progressRangeStats.ts"), "utf8");

describe("Progress Phase 2 — WEIGHT + Calories cards", () => {
  it("shared helper exports the range-stats functions", () => {
    expect(HELPER).toMatch(/export function buildWeightRangeStats\(/);
    expect(HELPER).toMatch(/export function buildCaloriesRangeStats\(/);
    expect(HELPER).toMatch(/export type RangeKey\b/);
  });

  it("mobile imports the shared helper and passes the current rangeKey", () => {
    expect(MOBILE).toMatch(/from\s+["'][^"']*progressRangeStats["']/);
    expect(MOBILE).toMatch(/buildWeightRangeStats\(weightKgByDay, rangeKey as RangeKey/);
    expect(MOBILE).toMatch(/buildCaloriesRangeStats\(byDay as any, targets\.calories, rangeKey as RangeKey/);
  });

  it("web imports the shared helper and passes the current range", () => {
    expect(WEB).toMatch(/from\s+["'][^"']*progressRangeStats(?:\.ts)?["']/);
    expect(WEB).toMatch(/buildWeightRangeStats\(weightKgByDay, range as RangeKey/);
    expect(WEB).toMatch(/buildCaloriesRangeStats\(nutritionByDay, nutritionTargets\.calories, range as RangeKey/);
  });

  it("mobile mounts the Calories range card below the range picker (Weight card was consolidated 2026-05-11)", () => {
    // 2026-05-11 (Grace TF feedback — "this is duplicative"):
    // WeightRangeCard was rendering above the bigger Weight chart card
    // lower on the screen. Killed in `show` surface mode; the big
    // chart card is now the single weight surface. The function
    // definition is kept around in case `trends_only`/`hide` modes
    // ever need it back, but no JSX render happens in show mode.
    expect(MOBILE).toMatch(/function WeightRangeCard\(/);
    expect(MOBILE).toMatch(/function CaloriesRangeCard\(/);
    expect(MOBILE).toMatch(/<CaloriesRangeCard\b/);
    expect(MOBILE).toMatch(/testID="progress-calories-range-card"/);
    expect(MOBILE).toMatch(/testID="progress-calories-range-header"/);
    // CaloriesRangeCard still strictly precedes the !hasData branch.
    const calIdx = MOBILE.indexOf("<CaloriesRangeCard");
    const hasDataIdx = MOBILE.indexOf("{!hasData ? (");
    expect(calIdx).toBeGreaterThan(-1);
    expect(hasDataIdx).toBeGreaterThan(calIdx);
  });

  it("web mounts the Calories range card below the range picker (Weight card was consolidated 2026-05-11)", () => {
    // Same parity consolidation on the web ProgressDashboard.
    expect(WEB).toMatch(/function WeightRangeCardWeb\(/);
    expect(WEB).toMatch(/function CaloriesRangeCardWeb\(/);
    expect(WEB).toMatch(/<CaloriesRangeCardWeb\b/);
    expect(WEB).toMatch(/data-testid="progress-calories-range-card"/);
    expect(WEB).toMatch(/data-testid="progress-calories-range-header"/);
    const calIdx = WEB.indexOf("<CaloriesRangeCardWeb");
    const digestIdx = WEB.indexOf("WEEK DIGEST");
    expect(calIdx).toBeGreaterThan(-1);
    expect(digestIdx).toBeGreaterThan(calIdx);
  });

  it("the WeightRangeCard JSX is no longer rendered in show mode (consolidated 2026-05-11)", () => {
    // Regression guard: the duplication this commit removed must not
    // come back. We allow the function definition to live in the
    // file (still referenced by `WeightTrendOnlyCard` siblings via
    // shared types), and the explanatory comments may quote
    // `<WeightRangeCard>` as text — so we look for a JSX-shaped
    // pattern (open angle, name, then either space-attr or
    // open-tag-close) which never appears in comments.
    expect(MOBILE).not.toMatch(/<WeightRangeCard[\s\n][^>]*\//);
    expect(WEB).not.toMatch(/<WeightRangeCardWeb[\s\n][^>]*\//);
  });

  it("both platforms preserve existing cards below the new ones", () => {
    // Sanity that we did NOT delete anything required.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/Maintenance/);
      expect(src).toMatch(/Macro Adherence/);
      // D3 — Digest replaced WeeklyRecapCard 2026-04-21.
      expect(src).toMatch(/\bDigest\b/);
    }
    // Mobile keeps journey + daily calories bar.
    expect(MOBILE).toMatch(/Daily Calories/);
    expect(MOBILE).toMatch(/Journey/);
    // Web keeps daily calories chart + journey.
    expect(WEB).toMatch(/Daily Calories/);
    expect(WEB).toMatch(/JOURNEY \/ WEIGHT PROJECTION/);
  });

  it("each new card has an 'On track' pill branch + delta pill", () => {
    expect(MOBILE).toMatch(/progress-weight-on-track-pill/);
    expect(MOBILE).toMatch(/progress-calories-range-delta-pill/);
    expect(WEB).toMatch(/progress-weight-on-track-pill/);
    expect(WEB).toMatch(/progress-calories-range-delta-pill/);
  });
});
