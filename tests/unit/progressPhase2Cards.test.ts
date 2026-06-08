/**
 * Progress — Sloe Figma 492:2 frame conformance (source-grep pins).
 *
 * Supersedes the 2026-04-20 "Phase 2 cards" pins. The 492:2 reskin
 * replaced the dense Weight/Calories/Protein/Trend range-card grid with
 * a calm single-column frame:
 *   range toggle → THIS WEEK insight (lilac) → AVERAGE ADHERENCE
 *   → weight card (Trend/Scale) → AVG/TDEE/DEFICIT triad
 *   → DAILY CALORIES (sage/amber + goal dots) → on-target ribbon.
 *
 * Every figure reads from the shared `progressRangeStats` /
 * `progressWeekReport` helpers so web + mobile can't drift. The range
 * state drives the window. Preserved-below-the-fold features (maintenance,
 * journey, digest, steps, body fat) are guarded so nothing was dropped.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const MOBILE = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"), "utf8");
const WEB = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");
const HELPER = readFileSync(resolve(ROOT, "src/lib/nutrition/progressRangeStats.ts"), "utf8");

describe("Progress — Sloe Figma 492:2 frame", () => {
  it("shared helper exports the range-stats functions (incl. macro adherence)", () => {
    expect(HELPER).toMatch(/export function buildWeightRangeStats\(/);
    expect(HELPER).toMatch(/export function buildCaloriesRangeStats\(/);
    expect(HELPER).toMatch(/export function buildMacroAdherenceRangeStats\(/);
    expect(HELPER).toMatch(/export type RangeKey\b/);
  });

  it("both platforms import the shared range helpers and pass the active range", () => {
    expect(MOBILE).toMatch(/from\s+["'][^"']*progressRangeStats["']/);
    expect(MOBILE).toMatch(/buildCaloriesRangeStats\(byDay as any, targets\.calories, rangeKey as RangeKey/);
    expect(MOBILE).toMatch(/buildMacroAdherenceRangeStats\(/);
    expect(WEB).toMatch(/from\s+["'][^"']*progressRangeStats(?:\.ts)?["']/);
    expect(WEB).toMatch(/buildCaloriesRangeStats\(nutritionByDay, nutritionTargets\.calories, range as RangeKey/);
    expect(WEB).toMatch(/buildMacroAdherenceRangeStats\(/);
  });

  it("both platforms render the THIS WEEK insight + AVERAGE ADHERENCE cards", () => {
    // THIS WEEK insight (lilac) — the engine headline / story-gate slot.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/ProgressHeadline/);
      expect(src).toMatch(/ProgressStoryGate/);
    }
    // AVERAGE ADHERENCE card with the four macro bars.
    expect(WEB).toMatch(/<ProgressAverageAdherence\b/);
    expect(WEB).toMatch(/data-testid="progress-average-adherence-card"/);
    expect(MOBILE).toMatch(/<ProgressAverageAdherence\b/);
    expect(MOBILE).toMatch(/testID="progress-average-adherence-card"/);
  });

  it("AVERAGE ADHERENCE wires all four macro bars (Protein/Carbs/Fat/Fibre)", () => {
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/macro-protein/);
      expect(src).toMatch(/macro-carbs/);
      expect(src).toMatch(/macro-fat/);
      expect(src).toMatch(/macro-fiber/);
      // The Fibre bar must read a real fibre figure, not be hidden.
      expect(src).toMatch(/fiberPct|fiberAdherence/);
    }
  });

  it("both platforms render the AVG/TDEE/DEFICIT triad + on-target ribbon", () => {
    expect(WEB).toMatch(/<ProgressEnergyTriad\b/);
    expect(WEB).toMatch(/<ProgressOnTargetRibbon\b/);
    expect(MOBILE).toMatch(/<ProgressEnergyTriad\b/);
    expect(MOBILE).toMatch(/<ProgressOnTargetRibbon\b/);
  });

  it("weight card exposes the Trend/Scale toggle + Log weight (frame position 4)", () => {
    expect(WEB).toMatch(/data-testid="progress-weight-view-toggle"/);
    expect(WEB).toMatch(/data-testid="progress-weight-view-trend"/);
    expect(WEB).toMatch(/data-testid="progress-weight-view-scale"/);
    expect(WEB).toMatch(/data-testid="progress-log-weight"/);
    expect(MOBILE).toMatch(/testID="progress-weight-view-toggle"/);
    expect(MOBILE).toMatch(/testID="progress-weight-view-trend"/);
    expect(MOBILE).toMatch(/testID="progress-weight-view-scale"/);
  });

  it("DAILY CALORIES uses sage on-target / amber over (never red bars)", () => {
    // Sage = on target; warning amber = over. The destructive-red rule is
    // the calorie-RING carve-out only — never the bars.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/Daily Calories/);
      expect(src).not.toMatch(/data-testid="progress-week-charts-grid"/);
    }
    expect(WEB).toMatch(/data-testid="progress-daily-calories-card"/);
  });

  it("removed the dense Phase-2 range grid (no duplicate competing surfaces)", () => {
    // The old Weight/Calories/Protein/Trend grid + its testIDs are gone.
    expect(WEB).not.toMatch(/data-testid="progress-calories-range-card"/);
    expect(WEB).not.toMatch(/data-testid="progress-phase2-grid"/);
    expect(WEB).not.toMatch(/function CaloriesRangeCardWeb\(/);
    expect(WEB).not.toMatch(/function ProteinRangeCardWeb\(/);
    expect(WEB).not.toMatch(/function TrendSummaryCardWeb\(/);
    expect(WEB).not.toMatch(/function WeightRangeCardWeb\(/);
  });

  it("both platforms preserve the wired features below the frame", () => {
    // Nothing required was deleted — only re-presented / relocated.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/Maintenance/);
      expect(src).toMatch(/\bDigest\b/);
      expect(src).toMatch(/Journey/);
    }
  });
});
