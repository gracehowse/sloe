/**
 * ENG-822 + ENG-824 (Redesign — Design Direction 2026, 2026-05-31
 * design-director review) — Progress + metric-detail + weight-entry parity.
 *
 * Source-text assertions (same convention as `planWinMomentParity.test.ts`)
 * that break if either platform:
 *   - drops the soft-elevation flag gate on the metric-detail cards (ENG-822),
 *   - re-introduces the shouty saturated-blue ALL-CAPS metric-detail header
 *     (the review's loudest-element flag) (ENG-822),
 *   - silently routes a `metric=weight` deep-link to the calories chart
 *     instead of the weight surface (mobile param bug; web coerces to null)
 *     (ENG-822),
 *   - drops the `redesign_winmoment` gate or the shared new-low detector on
 *     the weight win-moment (ENG-824).
 *
 * The pure logic is unit-tested separately (`weightWinMoment.test.ts`); this
 * pins the cross-platform WIRING so the two surfaces can never silently drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const MOBILE_METRIC = read("apps/mobile/app/progress-metric.tsx");
const WEB_METRIC = read("src/app/components/ProgressMetricDetail.tsx");
const MOBILE_PROGRESS = read("apps/mobile/app/(tabs)/progress.tsx");
const WEB_PROGRESS = read("src/app/components/ProgressDashboard.tsx");
const MOBILE_SHEET = read("apps/mobile/components/progress/LogWeightSheet.tsx");

// ENG-952/954 extracted the weight win-moment / celebration wiring out of the
// host screens into shared per-platform celebration modules (composition-root
// pattern, to keep the screens under the line budget):
//   - web:    src/app/components/progress/useWeightCelebration.ts (state +
//             analytics) + WeightMilestoneMoment.tsx (quiet-tier overlay); the
//             reserved new-low WinMomentPlayer still mounts in ProgressDashboard.
//   - mobile: apps/mobile/components/progress/useWeightCelebration.ts (state +
//             analytics) + WeightCelebrationOverlays.tsx (both overlays).
// The new-low DETECTION moved from the raw `isNewWeightLow` primitive to the
// shared `resolveWeightSaveCelebration` resolver (which is built on
// `isNewWeightLow`) — both platforms now call the resolver.
//
// These per-platform "all the source where the win-moment now lives" strings
// let the parity asserts below follow the symbols to their new files without
// weakening intent: each check still proves BOTH platforms detect a new low via
// the shared detector, mount the reserved WinMomentPlayer with the
// `progress-weight-win-moment` testid, and emit `weight_new_low_win_moment_shown`
// with the correct platform tag.
const WEB_CELEBRATION = read("src/app/components/progress/useWeightCelebration.ts");
const WEB_MILESTONE_MOMENT = read("src/app/components/progress/WeightMilestoneMoment.tsx");
const MOBILE_CELEBRATION = read("apps/mobile/components/progress/useWeightCelebration.ts");
const MOBILE_OVERLAYS = read("apps/mobile/components/progress/WeightCelebrationOverlays.tsx");
const SHARED_WIN_MOMENT = read("src/lib/nutrition/weightWinMoment.ts");

// Combined per-platform win-moment surface = host screen + its extracted
// celebration modules. The weight-entry sheet (mobile) resolves the tier, so it
// joins the mobile bundle too.
const WEB_WIN_MOMENT_SRC = [WEB_PROGRESS, WEB_CELEBRATION, WEB_MILESTONE_MOMENT].join("\n");
const MOBILE_WIN_MOMENT_SRC = [
  MOBILE_PROGRESS,
  MOBILE_SHEET,
  MOBILE_CELEBRATION,
  MOBILE_OVERLAYS,
].join("\n");

describe("ENG-822 — metric-detail soft elevation (both platforms)", () => {
  it("mobile metric-detail uses the flag-aware useCardElevation hook", () => {
    expect(MOBILE_METRIC).toContain("useCardElevation");
    // The flat per-card `borderWidth: 1, borderColor: t.border` cards were
    // replaced by the spread `...cardSurface` derived from the hook.
    expect(MOBILE_METRIC).toContain("...cardSurface");
    expect(MOBILE_METRIC).toContain("cardElevation.shadowStyle");
  });

  it("web metric-detail is FLAT on the elevation-ON path (flat-card surfaces, 2026-06-12)", () => {
    expect(WEB_METRIC).toContain('isFeatureEnabled("design_system_elevation")');
    // Flat-card surfaces (2026-06-12, Withings grammar — decision:
    // docs/decisions/2026-06-12-flat-card-surfaces.md): the soft lift is
    // retired. Flag ON → borderless + FLAT (no soft shadow); flag OFF → legacy
    // flat hairline. The raw `--elev-card-soft` token no longer appears here.
    expect(WEB_METRIC).not.toContain("shadow-[var(--elev-card-soft)]");
    expect(WEB_METRIC).toContain("border border-transparent");
    expect(WEB_METRIC).toContain("border border-border");
  });
});

describe("ENG-822 — calmed metric-detail header (both platforms)", () => {
  it("mobile header is no longer ALL-CAPS saturated-blue letter-spaced", () => {
    // The title now renders in normal case (`{title}`, not `{title.toUpperCase()}`)
    // and in the foreground colour, not `Accent.primary`.
    expect(MOBILE_METRIC).not.toContain("{title.toUpperCase()}");
    expect(MOBILE_METRIC).toContain("{title}");
    // No `letterSpacing: 2` banner survives on the header.
    expect(MOBILE_METRIC).not.toContain("letterSpacing: 2");
  });

  it("web header drops `text-primary tracking-wide uppercase`", () => {
    expect(WEB_METRIC).not.toContain("text-primary tracking-wide uppercase");
    expect(WEB_METRIC).toContain("text-foreground");
  });
});

describe("ENG-822 — metric=weight deep-link no longer renders the calories chart", () => {
  it("mobile redirects a weight metric to the Progress tab", () => {
    expect(MOBILE_METRIC).toContain('metricRaw === "weight"');
    expect(MOBILE_METRIC).toContain('router.replace("/(tabs)/progress"');
  });

  it("web only renders the detail for calories|protein|streak (weight coerces to null)", () => {
    // ProgressDashboard.coerceProgressMetric is the gate; the detail component
    // itself never accepts `weight` as a metric.
    const dash = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");
    expect(dash).toContain("function coerceProgressMetric");
    expect(dash).toContain('v === "calories" || v === "protein" || v === "streak"');
  });
});

describe("ENG-824 — weight win-moment parity (both platforms)", () => {
  it("both platforms gate the weight win-moment behind redesign_winmoment", () => {
    expect(MOBILE_SHEET).toContain('isFeatureEnabled("redesign_winmoment")');
    expect(WEB_PROGRESS).toContain('isFeatureEnabled("redesign_winmoment")');
  });

  it("both platforms detect the landmark via the shared isNewWeightLow", () => {
    // ENG-952/954 — the raw `isNewWeightLow` primitive is now consumed through
    // the shared `resolveWeightSaveCelebration` resolver (which is built on
    // `isNewWeightLow`). Both platforms call that one shared resolver, so the
    // new-low decision can never diverge: web in `ProgressDashboard`, mobile in
    // the weight-entry `LogWeightSheet`.
    expect(WEB_PROGRESS).toContain("resolveWeightSaveCelebration");
    expect(MOBILE_SHEET).toContain("resolveWeightSaveCelebration");
    // …and the shared resolver still derives the landmark from `isNewWeightLow`,
    // so this stays an assertion about the SAME detector both surfaces use.
    expect(SHARED_WIN_MOMENT).toContain("export function isNewWeightLow");
    expect(SHARED_WIN_MOMENT).toContain("isNewWeightLow({");
  });

  it("mobile fires the loud success haptic only on a new low, quiet confirm otherwise", () => {
    expect(MOBILE_SHEET).toMatch(/Haptics\.notificationAsync/);
    expect(MOBILE_SHEET).toMatch(/NotificationFeedbackType\.Success/);
    expect(MOBILE_SHEET).toMatch(/Haptics\.impactAsync/);
    expect(MOBILE_SHEET).toMatch(/ImpactFeedbackStyle\.Medium/);
  });

  it("both platforms mount the reserved WinMomentPlayer on a new low", () => {
    // ENG-952/954 — mobile's overlays moved into `WeightCelebrationOverlays`;
    // web's reserved new-low player still mounts in `ProgressDashboard`. Assert
    // against the combined per-platform win-moment surface so the check follows
    // the symbols to wherever they now live.
    expect(MOBILE_WIN_MOMENT_SRC).toContain("WinMomentPlayer");
    expect(MOBILE_WIN_MOMENT_SRC).toContain("progress-weight-win-moment");
    expect(WEB_WIN_MOMENT_SRC).toContain("WinMomentPlayer");
    expect(WEB_WIN_MOMENT_SRC).toContain("progress-weight-win-moment");
  });

  it("both platforms emit the same cross-platform shown event (no weight value in payload)", () => {
    // ENG-952/954 — the analytics fire moved into each platform's extracted
    // `useWeightCelebration` hook. Assert against the combined per-platform
    // win-moment surface so the event name + platform-only payload guard still
    // hold wherever the symbols now live.
    expect(MOBILE_WIN_MOMENT_SRC).toContain("weight_new_low_win_moment_shown");
    expect(WEB_WIN_MOMENT_SRC).toContain("weight_new_low_win_moment_shown");
    // HIGH-class PHI guard: the payload carries only the platform.
    expect(MOBILE_WIN_MOMENT_SRC).toContain('{ platform: "ios" }');
    expect(WEB_WIN_MOMENT_SRC).toContain('{ platform: "web" }');
  });
});
