/**
 * Mobile + web Progress screens — period-control + rhythm pins.
 *
 * ENG-1030 (2026-06-10) replaced the Claude Design prototype's
 * `[7d, 30d, 90d, All]` relative-window pills with Apple Health's
 * calendar-anchored range grammar: D / W / M / 6M / Y segments + a
 * ‹ label › paging row, driven by the shared `progressPeriod.ts`
 * model so web + mobile compute identical windows and labels.
 *
 * This file pins:
 *  - the period control is wired on BOTH platforms (segments + paging),
 *  - the old `rangeKey` / `rangeDays` / pill source is GONE,
 *  - the skeleton mirrors the period control (no load→loaded jump),
 *  - the one-vertical-rhythm sweep (Spacing.lg seam, no double-stacked
 *    margins) survived the picker swap,
 *  - the skeleton-gate try/finally fix that keeps the loading flag from
 *    pinning the skeleton on a thrown supabase error.
 *
 * These are structural source-grep pins — cheap, survive RNTL / mock
 * drift, and run in plain node.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("Progress period control (ENG-1030) — header + picker + rhythm", () => {
  const mobileSrc = read("apps/mobile/app/(tabs)/progress.tsx");
  const mobileChromeSrc = read("apps/mobile/components/tabs/ProgressTabChrome.tsx");
  const mobileSectionSrc = read("apps/mobile/components/suppr/screen-section-chrome.tsx");
  const mobilePeriodSrc = read("apps/mobile/components/progress/ProgressPeriodControl.tsx");
  const webSrc = read("src/app/components/ProgressDashboard.tsx");
  const webChromeSrc = read("src/app/components/suppr/progress-tab-chrome.tsx");
  const webPeriodSrc = read("src/app/components/suppr/progress-period-control.tsx");
  const mobileTrackSrc = read("apps/mobile/components/ui/SegmentedTrack.tsx");
  const webTrackSrc = read("src/app/components/ui/segmented-track.tsx");

  it("mobile header shows the 'Your trends' brand overline (not the retired range overline)", () => {
    // ENG-1030 — the period model defaults to the current week (DEFAULT_PERIOD
    // = { type: "W", offset: 0 }). The retired `LAST N DAYS` RANGE overline
    // stays gone; the period label ("15–21 Jun") is the time context. ENG-1247
    // adds the v3 prototype "Your trends" brand eyebrow above the title.
    expect(mobileSrc).toMatch(/const \[period, setPeriod\] = useState<ProgressPeriod>\(DEFAULT_PERIOD\)/);
    expect(mobileSrc).not.toContain("LAST 30 DAYS");
    expect(mobileSrc).not.toContain("LAST 7 DAYS");
    expect(mobileSrc).not.toContain("ALL TIME");
    expect(mobileSrc).not.toContain("Weekly report");
    expect(mobileChromeSrc).toContain('overline="Your trends"');
    expect(mobileChromeSrc).toContain('titleTestID="progress-header"');
    // headers census 2026-06-10: chrome title on the canonical Type.title token.
    expect(mobileSectionSrc).toMatch(/title:\s*\{\s*\.\.\.Type\.title,\s*color:\s*colors\.navPrimary\s*\}/);
    expect(mobileSectionSrc).not.toMatch(/compact\s*\?\s*22/);
    expect(mobileSectionSrc).not.toContain('"Newsreader_400Regular"');
  });

  it("mobile header carries a trailing log-weight control", () => {
    expect(mobileSrc).toMatch(/<Scale\b/);
    expect(mobileSrc).toContain('testID="progress-calendar-button"');
  });

  it("mobile renders the ProgressPeriodControl (D/W/M/6M/Y + paging), not the old pills", () => {
    // The live picker is the shared period control, fed the period state +
    // the user's weekStart, paging via setPeriod.
    expect(mobileSrc).toContain("<ProgressPeriodControl");
    expect(mobileSrc).toMatch(/period=\{period\}/);
    expect(mobileSrc).toMatch(/weekStart=\{weekStartDay\}/);
    expect(mobileSrc).toMatch(/onChange=\{setPeriod\}/);
    // The old relative-range model is fully gone from the rendered source.
    expect(mobileSrc).not.toContain('testID={`progress-range-pill-${k}`}');
    expect(mobileSrc).not.toContain("setRangeKey");
    expect(mobileSrc).not.toMatch(/\["7d", "30d", "90d", "all"\] as const\)\.map/);
  });

  it("mobile period control is the §8 segmented rail + ‹ label › pager", () => {
    // Two stacked rows: the canonical SegmentedTrack primitive (ENG-1375),
    // and a paging row with prev/label/next. Forward chevron disabled at the
    // present.
    expect(mobilePeriodSrc).toContain("<SegmentedTrack");
    expect(mobilePeriodSrc).toContain('role="tablist"');
    expect(mobilePeriodSrc).toContain('testID="progress-period-segments"');
    expect(mobilePeriodSrc).toContain("testID: `progress-period-segment-${type}`");
    expect(mobilePeriodSrc).toContain('testID="progress-period-prev"');
    expect(mobilePeriodSrc).toContain('testID="progress-period-next"');
    expect(mobilePeriodSrc).toContain('testID="progress-period-label"');
    // §8 treatment lives in the primitive: active segment elevates onto the
    // card; rail is the inputBg track (ENG-1375 S3).
    expect(mobileTrackSrc).toMatch(/backgroundColor: colors\.inputBg/);
    expect(mobileTrackSrc).toMatch(/backgroundColor: colors\.card/);
    // Forward paging is clamped at the current period (no future).
    expect(mobilePeriodSrc).toMatch(/disabled=\{atCurrent\}/);
  });

  it("mobile drives every range stat off the period window (shared *ForWindow helpers)", () => {
    // The period resolves to an inclusive window + chart anchor + label, and
    // the weight/calorie/macro stats read the window variants (no rangeKey).
    expect(mobileSrc).toMatch(/periodWindow\(period, weekStartDay/);
    expect(mobileSrc).toMatch(/periodLabel\(period, weekStartDay/);
    expect(mobileSrc).toMatch(/periodChartAnchorISO\(period, weekStartDay/);
    expect(mobileSrc).toMatch(/progressPeriodToWeightRange\(period\.type\)/);
    expect(mobileSrc).toContain("buildWeightRangeStatsForWindow(weightKgByDay, periodWin)");
    expect(mobileSrc).toMatch(/buildCaloriesRangeStatsForWindow\(byDay as any, targets\.calories, periodWin\)/);
    expect(mobileSrc).toMatch(/buildMacroAdherenceRangeStatsForWindow\(/);
    // The chart remounts on the period (type + offset), not the old rangeKey.
    expect(mobileSrc).toMatch(/key=\{`\$\{period\.type\}:\$\{period\.offset\}`\}/);
  });

  it("mobile skeleton-gate fix — loadData wraps fetch+hydrate in try/finally", () => {
    expect(mobileSrc).toMatch(/setLoading\(true\);[\s\S]*?try \{/);
    expect(mobileSrc).toMatch(/\} finally \{\s*setLoading\(false\);\s*\}/);
    const happyPathIdx = mobileSrc.indexOf("setLoading(false)");
    const deferredIdx = mobileSrc.indexOf("void getDailyTargets(supabase, userId, weekKeys)");
    expect(happyPathIdx).toBeGreaterThan(-1);
    expect(deferredIdx).toBeGreaterThan(-1);
    expect(happyPathIdx).toBeLessThan(deferredIdx);
  });

  it("mobile skeleton mirrors the period control (segments + ‹ label › row), no rangeKey pills", () => {
    // The load-state picker must render the same §8 segmented rail + paging
    // placeholder so loading → loaded has no jump. It must NOT render the old
    // 7d/30d/90d pill tuple.
    expect(mobileSrc).toContain('testID="progress-range-picker-skeleton"');
    expect(mobileSrc).toMatch(/testID="progress-range-picker-skeleton"[\s\S]*?PERIOD_TYPES\.map/);
    expect(mobileSrc).not.toMatch(
      /testID="progress-range-picker-skeleton"[\s\S]*?\["7d", "30d", "90d", "all"\]/,
    );
  });

  it("web header shows the 'Your trends' overline, not the retired range overline", () => {
    expect(webSrc).toMatch(/const \[period, setPeriod\] = useState<ProgressPeriod>\(DEFAULT_PERIOD\)/);
    expect(webSrc).not.toContain("LAST 7 DAYS");
    expect(webSrc).not.toContain("LAST 90 DAYS");
    expect(webSrc).not.toContain("ALL TIME");
    expect(webSrc).not.toContain("Weekly report");
    // ENG-1247 — the mobile-web chrome carries the v3 "Your trends" overline.
    expect(webChromeSrc).toContain('data-testid="progress-overline"');
    expect(webChromeSrc).toContain('data-testid="progress-header"');
    expect(webChromeSrc).toMatch(/text-\[28px\]/);
    expect(webChromeSrc).toMatch(/font-\[family-name:var\(--font-headline\)\]/);
  });

  it("web header carries a calendar icon button", () => {
    expect(webSrc).toContain("Icons.calendar");
    expect(webSrc).toContain('data-testid="progress-calendar-button"');
  });

  it("web renders the ProgressPeriodControl (mobile parity), not the old pills", () => {
    expect(webSrc).toContain("<ProgressPeriodControl");
    expect(webSrc).toMatch(/period=\{period\}/);
    expect(webSrc).toMatch(/weekStart=\{weekStartDay\}/);
    expect(webSrc).toMatch(/onChange=\{setPeriod\}/);
    // The old relative-range pills + arithmetic are gone.
    expect(webSrc).not.toContain('data-testid={`progress-range-pill-${k}`}');
    expect(webSrc).not.toContain("onClick={() => setRange(k)}");
    expect(webSrc).not.toMatch(/const rangeDays = range === "7d"/);
  });

  it("web period control mirrors the mobile segments + paging + a11y", () => {
    // ENG-1375 S2 — the web period control renders the canonical
    // SegmentedTrack (it previously had NO track: bare card segments + a
    // tint thumb, the census's named divergent from its own mobile mirror).
    expect(webPeriodSrc).toContain("<SegmentedTrack");
    expect(webPeriodSrc).toContain('role="tablist"');
    expect(webPeriodSrc).toContain('testId="progress-period-segments"');
    expect(webPeriodSrc).toContain("testId: `progress-period-segment-${type}`");
    expect(webPeriodSrc).toContain('data-testid="progress-period-prev"');
    expect(webPeriodSrc).toContain('data-testid="progress-period-next"');
    expect(webPeriodSrc).toContain('data-testid="progress-period-label"');
    // The retired tint thumb never comes back (§8 = card-white thumb).
    expect(webPeriodSrc).not.toContain("bg-primary-soft text-primary-solid font-semibold");
    expect(webTrackSrc).toContain("bg-card font-semibold text-primary-solid shadow-sm");
    expect(webPeriodSrc).toMatch(/disabled=\{atCurrent\}/);
    // Keyboard arrow movement lives in the primitive (a11y parity with mobile).
    expect(webTrackSrc).toMatch(/ArrowLeft|ArrowRight/);
  });

  it("web skeleton-gate fix — load wraps fetch+hydrate in try/finally", () => {
    expect(webSrc).toMatch(/setLoading\(true\);[\s\S]*?try \{/);
    expect(webSrc).toMatch(/\} finally \{\s*setLoading\(false\);\s*\}/);
    const happyPathIdx = webSrc.indexOf("setLoading(false)");
    const deferredIdx = webSrc.indexOf(
      "void getDailyTargets(supabase, authedUserId, weekKeys)",
    );
    expect(happyPathIdx).toBeGreaterThan(-1);
    expect(deferredIdx).toBeGreaterThan(-1);
    expect(happyPathIdx).toBeLessThan(deferredIdx);
  });

  it("web skeleton mirrors the period control (segments + ‹ label › row), no rangeKey pills", () => {
    expect(webSrc).not.toMatch(/>Loading progress…</);
    expect(webSrc).toContain('data-testid="progress-loading-skeleton"');
    expect(webSrc).toContain('data-testid="progress-suspense-fallback"');
    // The skeleton picker maps the period segments (not the old pill tuple).
    expect(webSrc).toMatch(/PERIOD_TYPES\.map\(\(seg\)/);
    expect(webSrc).toContain("progress-skeleton-tile-");
    expect(webSrc).toMatch(/\[0, 1, 2, 3\]\.map/);
  });

  it("mobile picker→THIS WEEK seam is on the page rhythm (Spacing.lg), not a cramped abut", () => {
    // Rhythm sweep 2026-06-10: the heroEntrance wrapper holds the period
    // control AND the THIS WEEK card. It MUST carry gap: Spacing.lg so the
    // picker→card seam matches the 20pt rhythm of every other inter-card gap
    // (the scroll container + the charts/details wrappers all use Spacing.lg).
    expect(mobileSrc).toMatch(
      /<ReAnimated\.View style=\{\[heroEntrance\.style,\s*\{ gap: Spacing\.lg \}\]\}>/,
    );
    expect(mobileSrc).toMatch(/chartsEntrance\.style,\s*\{ gap: Spacing\.lg \}/);
    expect(mobileSrc).toMatch(/detailsEntrance\.style,\s*\{ gap: Spacing\.lg \}/);
    // The scroll container owns the same 20pt rhythm between top-level blocks.
    expect(mobileSrc).toMatch(/gap: Spacing\.lg,\s*\/\/ 20px/);
  });

  it("mobile rows don't double-stack margin + container gap", () => {
    // Rhythm sweep 2026-06-10: the skeleton ScrollView + the heroEntrance
    // wrapper already own the 20pt rhythm via gap: Spacing.lg. The skeleton
    // picker, the skeleton tile grid, and the WeightTrendOnlyCard must NOT
    // also carry a marginBottom — that double-stacked to 36pt (gap 20 +
    // margin 16) and made the load state jump vs the live layout.
    expect(mobileSrc).not.toMatch(
      /testID="progress-range-picker-skeleton"[\s\S]{0,400}?marginBottom: Spacing\.md/,
    );
    expect(mobileSrc).not.toMatch(
      /testID="progress-weight-trend-only-card"[\s\S]*?marginBottom: Spacing\.md/,
    );
  });
});
