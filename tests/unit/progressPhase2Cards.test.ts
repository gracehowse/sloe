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
// Inline Log-weight row extracted into ProgressWeightLogRow (ENG-1504).
const WEB_LOG_ROW = readFileSync(
  resolve(ROOT, "src/app/components/suppr/progress-weight-log-row.tsx"),
  "utf8",
);
const HELPER = readFileSync(resolve(ROOT, "src/lib/nutrition/progressRangeStats.ts"), "utf8");
// The AVERAGE ADHERENCE card lives in its own component on each platform
// (the dashboards render `<ProgressAverageAdherence>` and pass the four
// macro rows). Card-internal testIDs + the macro tokens are pinned against
// the component sources, not the dashboard host.
const WEB_ADHERENCE = readFileSync(
  resolve(ROOT, "src/app/components/suppr/progress-average-adherence.tsx"),
  "utf8",
);
const MOBILE_ADHERENCE = readFileSync(
  resolve(ROOT, "apps/mobile/components/progress/ProgressAverageAdherence.tsx"),
  "utf8",
);

describe("Progress — Sloe Figma 492:2 frame", () => {
  it("shared helper exports the window range-stats functions (incl. macro adherence)", () => {
    // ENG-1030 (2026-06-10): the Progress consumers moved to the calendar
    // window variants (`*ForWindow`) that take a `[startKey, endKey]` period
    // window instead of the relative `RangeKey`. The legacy `RangeKey`
    // builders are kept (their pinned tests stay green) but no Progress
    // surface calls them.
    expect(HELPER).toMatch(/export function buildWeightRangeStatsForWindow\(/);
    expect(HELPER).toMatch(/export function buildCaloriesRangeStatsForWindow\(/);
    expect(HELPER).toMatch(/export function buildMacroAdherenceRangeStatsForWindow\(/);
  });

  it("both platforms import the shared window helpers and pass the period window", () => {
    // The picker is the Apple Health range grammar (ENG-1030): the selected
    // period resolves to an inclusive window (`periodWin`) that drives every
    // range stat. Both platforms read the SAME `*ForWindow` helpers so they
    // can't drift.
    expect(MOBILE).toMatch(/from\s+["'][^"']*progressRangeStats["']/);
    expect(MOBILE).toMatch(/buildCaloriesRangeStatsForWindow\(byDay as any, targets\.calories, periodWin\)/);
    expect(MOBILE).toMatch(/buildMacroAdherenceRangeStatsForWindow\(/);
    expect(WEB).toMatch(/from\s+["'][^"']*progressRangeStats(?:\.ts)?["']/);
    expect(WEB).toMatch(/buildCaloriesRangeStatsForWindow\(nutritionByDay, nutritionTargets\.calories, periodWin\)/);
    expect(WEB).toMatch(/buildMacroAdherenceRangeStatsForWindow\(/);
  });

  it("both platforms render the THIS WEEK insight + AVERAGE ADHERENCE cards", () => {
    // THIS WEEK insight (lilac) — the engine headline / story-gate slot.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/ProgressHeadline/);
      expect(src).toMatch(/ProgressStoryGate/);
    }
    // The dashboards render the AVERAGE ADHERENCE card component...
    expect(WEB).toMatch(/<ProgressAverageAdherence\b/);
    expect(MOBILE).toMatch(/<ProgressAverageAdherence\b/);
    // ...and the card itself carries the testID (web + mobile mirror).
    expect(WEB_ADHERENCE).toMatch(/data-testid="progress-average-adherence-card"/);
    expect(MOBILE_ADHERENCE).toMatch(/testID="progress-average-adherence-card"/);
  });

  it("AVERAGE ADHERENCE wires all four macro bars (Protein/Carbs/Fat/Fibre)", () => {
    // The dashboards pass the four macro rows (with the platform's macro
    // colour token); the card renders a bar per row keyed by name.
    for (const src of [MOBILE, WEB]) {
      expect(src).toMatch(/name:\s*["']Protein["']/);
      expect(src).toMatch(/name:\s*["']Carbs["']/);
      expect(src).toMatch(/name:\s*["']Fat["']/);
      expect(src).toMatch(/name:\s*["']Fibre["']/);
      // The Fibre bar must read a real fibre figure, not be hidden.
      expect(src).toMatch(/fiberPct|fiberAdherence/);
    }
    // Web uses the CSS macro tokens inline; mobile uses the `MacroColors`
    // / theme tokens — both feed the same four-bar component.
    expect(WEB).toMatch(/var\(--macro-protein\)/);
    expect(WEB).toMatch(/var\(--macro-fiber\)/);
    expect(MOBILE).toMatch(/MacroColors\.fiber|t\.protein/);
    // The shared card renders one bar per macro (data-testid / testID
    // suffixed by the lowercased name).
    expect(WEB_ADHERENCE).toMatch(/progress-adherence-bar-/);
    expect(MOBILE_ADHERENCE).toMatch(/progress-adherence-bar-/);
  });

  it("both platforms render the AVG/TDEE/DEFICIT triad + on-target ribbon", () => {
    expect(WEB).toMatch(/<ProgressEnergyTriad\b/);
    expect(WEB).toMatch(/<ProgressOnTargetRibbon\b/);
    expect(MOBILE).toMatch(/<ProgressEnergyTriad\b/);
    expect(MOBILE).toMatch(/<ProgressOnTargetRibbon\b/);
  });

  it("weight card exposes the Trend/Scale toggle + Log weight (frame position 4)", () => {
    // The two view buttons render from a `["trend", "scale"]` map with a
    // template testID, so the toggle wrapper + the per-view template + the
    // `weightView` state together guarantee both `trend` and `scale` tabs.
    // ENG-1375 S2 — the web toggle renders the canonical SegmentedTrack;
    // the testids are forwarded via its testId props (same DOM testids).
    expect(WEB).toMatch(/testId="progress-weight-view-toggle"/);
    expect(WEB).toMatch(/testId: `progress-weight-view-\$\{v\}`/);
    expect(WEB).toMatch(/\(\["trend", "scale"\] as const\)/);
    expect(WEB).toMatch(/<ProgressWeightLogRow\b/);
    expect(WEB_LOG_ROW).toMatch(/data-testid="progress-log-weight"/);
    expect(MOBILE).toMatch(/testID="progress-weight-view-toggle"/);
    expect(MOBILE).toMatch(/testID=\{`progress-weight-view-\$\{v\}`\}/);
    expect(MOBILE).toMatch(/\(\["trend", "scale"\] as const\)/);
    expect(MOBILE).toMatch(/testID="progress-log-weight"/);
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
