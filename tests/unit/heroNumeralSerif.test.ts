import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * SLOE Phase 0 — big standalone numeric HERO values read in the SERIF display
 * face (Newsreader), not sans. Sloe is an editorial app; big numbers are a
 * serif moment. This guards a project-wide consistency pass (2026-06-08,
 * sibling of `targetsHeroKcal.test.ts`) that converted the remaining bare-sans
 * hero numerals across Progress / Today / onboarding / meal + weight surfaces,
 * web AND mobile, so they don't silently drift back to `font-extrabold` /
 * `fontWeight: "800"`.
 *
 * Each assertion is scoped to the converted numeral so unrelated sans weights
 * (uppercase labels, +/− stepper glyphs, button labels, unit suffixes) stay
 * legitimately sans. Mobile uses `fontFamily: FontFamily.serif*` (the weight
 * comes from the family, so the sans `fontWeight` is dropped); web uses the
 * `--font-headline` / `--font-display` serif var, both Newsreader.
 *
 * The contract these tests protect: a future revert of any of these hero
 * numerals to a sans weight is a user-visible regression — it breaks the
 * editorial big-number identity Grace signed off on.
 */

function read(rel: string): string {
  return fs.readFileSync(path.resolve(rel), "utf-8");
}

/** Slice the line a marker sits on (for line-scoped weight guards). */
function lineWith(src: string, marker: string): string {
  const line = src.split("\n").find((l) => l.includes(marker));
  expect(line, `expected a line containing ${JSON.stringify(marker)}`).toBeDefined();
  return line!;
}

/**
 * The small window of lines around a marker (the marker line plus a few lines
 * before it) — used when a numeral's value and its `className` live on
 * different lines of the same JSX element.
 */
function blockAround(src: string, marker: string, before = 4, after = 1): string {
  const lines = src.split("\n");
  const idx = lines.findIndex((l) => l.includes(marker));
  expect(idx, `expected a line containing ${JSON.stringify(marker)}`).toBeGreaterThan(-1);
  return lines.slice(Math.max(0, idx - before), idx + 1 + after).join("\n");
}

const SERIF_MOBILE = "fontFamily: FontFamily.serifRegular";
const SERIF_WEB_HEADLINE = "font-[family-name:var(--font-headline)]";
const SERIF_WEB_DISPLAY = "font-[family-name:var(--font-display)]";

/**
 * Mobile serif can be expressed two ways, both Newsreader:
 *   1. the raw `fontFamily: FontFamily.serifRegular` literal, or
 *   2. a named `Type.*` ramp token whose definition points at
 *      `FontFamily.serif*` (statValue/title/headline/heroValue/cardHeroValue/
 *      ringValue/display/screenTitle/navTitle/pageTitle — verified serif in
 *      `apps/mobile/constants/theme.ts`).
 * ENG-1002's font-consistency sweep migrated several hero numerals from (1)
 * onto (2); the rendered face is unchanged. This matcher recognises both so
 * the test still guards "the numeral reads serif" without pinning the exact
 * mechanism. A migration to a SANS token (body/button/caption/macroValue…)
 * would contain none of these markers and correctly fail.
 */
const SERIF_MOBILE_MARKERS = [
  SERIF_MOBILE,
  "Type.statValue",
  "Type.title",
  "Type.headline",
  "Type.heroValue",
  "Type.cardHeroValue",
  "Type.ringValue",
  "Type.display",
  "Type.screenTitle",
  "Type.navTitle",
  "Type.pageTitle",
];
function containsSerifMobile(src: string): boolean {
  return SERIF_MOBILE_MARKERS.some((m) => src.includes(m));
}

describe("SLOE hero numerals — mobile reads serif (Newsreader)", () => {
  it("TrajectoryCard projected-kg hero is serif, no sans 800, kg stays sans", () => {
    const src = read("apps/mobile/components/progress/TrajectoryCard.tsx");
    const hero = lineWith(src, 'testID="trajectory-hero-kg"');
    // The serif family is applied a couple of lines below the testID; assert on
    // the block, and that the testID's own numeral span is not sans-weighted.
    expect(src).toContain(SERIF_MOBILE);
    expect(hero).not.toContain("fontWeight");
    // Unit split out into a nested sans node so `kg` stays sans.
    expect(src).toContain("FontFamily.sansSemibold");
  });

  it("WeightSparseState single weigh-in hero is serif (no sans 700)", () => {
    // ENG-1372 slice 2 — the 1-point branch's UI changed from a standalone
    // big numeral (`singleValue`) to a chart-point + label (`pointLabel`,
    // the point + dotted goal projection the contract specifies); the
    // numeral itself stays serif with no competing sans fontWeight.
    const src = read("apps/mobile/components/progress/WeightSparseState.tsx");
    const start = src.indexOf("pointLabel: {");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("},", start) + 2);
    expect(block).toContain(SERIF_MOBILE);
    expect(block).not.toContain("fontWeight");
  });

  it("LogWeightSheet weight-entry input is serif (no sans 600)", () => {
    const src = read("apps/mobile/components/progress/LogWeightSheet.tsx");
    const start = src.indexOf("input: {");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("},", start) + 2);
    expect(block).toContain(SERIF_MOBILE);
    expect(block).not.toContain("fontWeight");
  });

  it("meal-nutrition kcal hero is serif (no sans 800)", () => {
    const src = read("apps/mobile/app/meal-nutrition.tsx");
    const start = src.indexOf("kcal: {");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("},", start) + 2);
    expect(block).toContain(SERIF_MOBILE);
    expect(block).not.toContain("fontWeight");
  });

  it("profile target-tile numerals use the serif heroValue token", () => {
    const src = read("apps/mobile/app/profile.tsx");
    expect(src).toContain("...Type.heroValue");
    // The sans macroValue must no longer back the big target-tile numeral.
    expect(src).not.toContain("targetTileValue: { ...Type.macroValue");
  });

  it("DigestBlended + DigestStoryCard hero numerals are serif", () => {
    const blended = read("apps/mobile/components/DigestBlended.tsx");
    const story = read("apps/mobile/components/progress/DigestStoryCard.tsx");
    // closest-day kcal hero
    const heroLine = lineWith(blended, 'testID="digest-hero-calories"');
    expect(heroLine).toContain(SERIF_MOBILE);
    expect(heroLine).not.toContain('fontWeight: "800"');
    // days-logged hero
    expect(story).toContain(SERIF_MOBILE);
  });

  it("TodayWeekView weekly-summary stats are serif (no sans 800)", () => {
    // ENG-1372 slice 2 — the tile trio was extracted to
    // TodayWeekSummaryStats.tsx so the sparse-stat addition didn't push the
    // pinned TodayWeekView.tsx over its line budget; the serif numerals live
    // there now.
    const src = read("apps/mobile/components/today/TodayWeekSummaryStats.tsx");
    // All three big stat numerals converted; none should carry sans 800.
    // ENG-1002 moved these onto the serif `Type.title` ramp token.
    expect(containsSerifMobile(src), "TodayWeekSummaryStats serif numerals").toBe(true);
    // The Total/Daily/Net stat numerals are the only fontSize: 24 + tabular
    // numbers on this surface; ensure no `fontSize: 24` numeral keeps 800.
    const big24 = src
      .split("\n")
      .filter((l) => l.includes("fontSize: 24") && l.includes("fontWeight"));
    expect(big24).toHaveLength(0);
  });

  it("progress-metric stat numerals are serif", () => {
    const src = read("apps/mobile/app/progress-metric.tsx");
    expect(src).toContain(SERIF_MOBILE);
  });

  it("progress (tab) days-to-goal hero is serif", () => {
    const src = read("apps/mobile/app/(tabs)/progress.tsx");
    // The serif <Text> opens on the line above the `{timeline.daysToGoal}`
    // numeral; the nested " days to goal" label stays sans on the numeral line.
    const block = blockAround(src, "{timeline.daysToGoal}<Text", 1, 0);
    // ENG-1002 moved the numeral onto the serif `Type.statValue` ramp token.
    expect(containsSerifMobile(block), "days-to-goal serif numeral").toBe(true);
    expect(block).toContain("FontFamily.sansMedium");
  });

  it("WeeklyCheckinModal suggested-target hero is serif (no sans 800)", () => {
    const src = read("apps/mobile/components/today/WeeklyCheckinModal.tsx");
    // ENG-1002 moved the suggested-target numeral onto serif `Type.statValue`.
    expect(containsSerifMobile(src), "WeeklyCheckinModal serif numeral").toBe(true);
  });

  it("GoalPace slider + sheets hero numerals are serif", () => {
    const slider = read("apps/mobile/components/recap/GoalPaceSlider.tsx");
    const editor = read("apps/mobile/components/recap/GoalPaceEditorSheet.tsx");
    const retune = read("apps/mobile/components/recap/GoalPaceRetuneSheet.tsx");
    // Slider keeps the raw literal; editor + retune moved onto serif
    // `Type.statValue` (ENG-1002). All three still render Newsreader.
    expect(containsSerifMobile(slider), "GoalPaceSlider serif numeral").toBe(true);
    expect(containsSerifMobile(editor), "GoalPaceEditorSheet serif numeral").toBe(true);
    expect(containsSerifMobile(retune), "GoalPaceRetuneSheet serif numeral").toBe(true);
  });

  it("onboarding ruler + stepper + pace + reveal hero numerals are serif", () => {
    const ruler = read("apps/mobile/components/RulerSlider.tsx");
    const stepper = read("apps/mobile/components/onboarding/number-stepper.tsx");
    const pace = read("apps/mobile/components/onboarding/steps/pace.tsx");
    const reveal = read("apps/mobile/components/onboarding/steps/reveal.tsx");
    expect(ruler).toContain(SERIF_MOBILE);
    expect(stepper).toContain(SERIF_MOBILE);
    expect(pace).toContain(SERIF_MOBILE);
    expect(reveal).toContain(SERIF_MOBILE);
  });
});

describe("SLOE hero numerals — web reads serif (Newsreader), parity with mobile", () => {
  it("trajectory-card projected-kg hero is serif, kg stays sans", () => {
    const src = read("src/app/components/suppr/trajectory-card.tsx");
    // className is on the line below the data-testid line.
    const hero = blockAround(src, 'data-testid="trajectory-hero-kg"', 0, 2);
    expect(hero).toContain(SERIF_WEB_HEADLINE);
    expect(hero).not.toContain("font-extrabold");
    expect(src).toContain('<span className="font-sans text-base font-semibold"> kg</span>');
  });

  it("ProgressDashboard maintenance / steps / body-fat / days-to-goal heroes are serif", () => {
    const src = read("src/app/components/ProgressDashboard.tsx");
    // Maintenance hero kcal — the canonical reference pattern's web mirror.
    // (value + className live on adjacent lines of the same <p>.)
    const maint = blockAround(src, "resolved.kcal.toLocaleString()");
    expect(maint).toContain(SERIF_WEB_HEADLINE);
    expect(maint).not.toContain("text-[28px] font-bold");
    // Days-to-goal numeral (single-line span).
    const dtg = lineWith(src, "{timeline.daysToGoal}");
    expect(dtg).toContain(SERIF_WEB_HEADLINE);
    // Steps + body-fat heroes moved into the extracted ProgressActivitySection
    // (ENG-1225 gap #21); assert their serif numerals there.
    const activity = read("src/app/components/suppr/progress-activity-section.tsx");
    const steps = lineWith(activity, "stepsByDay[todayKey()]");
    expect(steps).toContain(SERIF_WEB_HEADLINE);
    const bf = lineWith(activity, "bodyFatPct != null ?");
    expect(bf).toContain(SERIF_WEB_HEADLINE);
  });

  it("today-week-view weekly-summary stats are serif (no sans extrabold)", () => {
    const src = read("src/app/components/suppr/today-week-view.tsx");
    const big = src
      .split("\n")
      .filter((l) => l.includes("text-2xl") && l.includes("tabular-nums"));
    expect(big.length).toBeGreaterThanOrEqual(3);
    for (const l of big) {
      expect(l).toContain(SERIF_WEB_HEADLINE);
      expect(l).not.toContain("font-extrabold");
    }
  });

  it("digest-blended closest-day kcal hero is serif, kcal stays sans", () => {
    const src = read("src/app/components/suppr/digest-blended.tsx");
    // Both hero-calories spans (track + no-track branches) carry the serif
    // headline class on the className line directly above the testID line.
    const blocks = src
      .split("\n")
      .map((l, i, arr) =>
        l.includes('data-testid="digest-hero-calories"')
          ? arr.slice(Math.max(0, i - 1), i + 1).join("\n")
          : null,
      )
      .filter((b): b is string => b != null);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks) {
      expect(b).toContain(SERIF_WEB_HEADLINE);
      expect(b).not.toContain("font-extrabold");
    }
    // `kcal` unit split into a sans nested span.
    expect(src).toContain('<span className="font-sans text-[13px] font-semibold ml-0.5">kcal</span>');
  });

  it("goal-pace-editor-dialog pace + preview heroes are serif", () => {
    const src = read("src/app/components/suppr/goal-pace-editor-dialog.tsx");
    // value + className live on adjacent lines of the same <span>.
    const pace = blockAround(src, "e.pace.toFixed(e.pace < 0.1 ? 3 : 2)");
    expect(pace).toContain(SERIF_WEB_HEADLINE);
    expect(pace).not.toContain("font-extrabold");
    // Preview kcal hero is also serif with a sans `kcal` unit.
    const preview = blockAround(src, "e.preview.target_calories.toLocaleString()");
    expect(preview).toContain(SERIF_WEB_HEADLINE);
  });

  it("weekly-checkin-dialog suggested-target hero is serif", () => {
    const src = read("src/app/components/suppr/weekly-checkin-dialog.tsx");
    expect(src).toContain(SERIF_WEB_HEADLINE);
  });

  it("onboarding pace + reveal + number-stepper heroes are serif", () => {
    const pace = read("src/app/components/onboarding/steps/pace.tsx");
    const reveal = read("src/app/components/onboarding/steps/reveal.tsx");
    const stepper = read("src/app/components/onboarding/number-stepper.tsx");
    expect(pace).toContain(SERIF_WEB_DISPLAY);
    expect(reveal).toContain(SERIF_WEB_DISPLAY);
    expect(stepper).toContain(SERIF_WEB_DISPLAY);
  });
});
