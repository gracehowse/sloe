/**
 * Progress Phase 2 cards — source-grep pins (2026-04-20 prototype port).
 *
 * Two new cards sit directly below the range picker on both platforms:
 *   1. WEIGHT card — uppercase overline, on-track green pill, big
 *      weight number, weekly delta with trend icon, sparkline,
 *      projection caption.
 *   2. Calories card — 17pt bold header OUTSIDE the card; card shows
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

  it("mobile mounts both new cards between the range picker and !hasData branch", () => {
    // Card components defined in the same file.
    expect(MOBILE).toMatch(/function WeightRangeCard\(/);
    expect(MOBILE).toMatch(/function CaloriesRangeCard\(/);
    // Rendered with test IDs the visual-QA team + e2e rely on.
    expect(MOBILE).toMatch(/<WeightRangeCard\b/);
    expect(MOBILE).toMatch(/<CaloriesRangeCard\b/);
    expect(MOBILE).toMatch(/testID="progress-weight-range-card"/);
    expect(MOBILE).toMatch(/testID="progress-calories-range-card"/);
    // Calories header sits OUTSIDE the card body (17pt bold).
    expect(MOBILE).toMatch(/testID="progress-calories-range-header"/);
    // Mount order — WeightRangeCard is rendered strictly before
    // CaloriesRangeCard which is rendered strictly before the
    // !hasData branch (so the two phase-2 cards are the first thing
    // below the range picker).
    const weightIdx = MOBILE.indexOf("<WeightRangeCard");
    const calIdx = MOBILE.indexOf("<CaloriesRangeCard");
    const hasDataIdx = MOBILE.indexOf("{!hasData ? (");
    expect(weightIdx).toBeGreaterThan(-1);
    expect(calIdx).toBeGreaterThan(weightIdx);
    expect(hasDataIdx).toBeGreaterThan(calIdx);
  });

  it("web mounts both new cards between the range picker and WEEKLY RECAP CARD", () => {
    expect(WEB).toMatch(/function WeightRangeCardWeb\(/);
    expect(WEB).toMatch(/function CaloriesRangeCardWeb\(/);
    expect(WEB).toMatch(/<WeightRangeCardWeb\b/);
    expect(WEB).toMatch(/<CaloriesRangeCardWeb\b/);
    expect(WEB).toMatch(/data-testid="progress-weight-range-card"/);
    expect(WEB).toMatch(/data-testid="progress-calories-range-card"/);
    expect(WEB).toMatch(/data-testid="progress-calories-range-header"/);
    const weightIdx = WEB.indexOf("<WeightRangeCardWeb");
    const calIdx = WEB.indexOf("<CaloriesRangeCardWeb");
    const recapIdx = WEB.indexOf("WEEKLY RECAP CARD");
    expect(weightIdx).toBeGreaterThan(-1);
    expect(calIdx).toBeGreaterThan(weightIdx);
    expect(recapIdx).toBeGreaterThan(calIdx);
  });

  it("both platforms preserve existing cards below the new ones", () => {
    // Sanity that we did NOT delete anything required.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/Maintenance/);
      expect(src).toMatch(/Macro Adherence/);
      expect(src).toMatch(/WeeklyRecapCard/);
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
