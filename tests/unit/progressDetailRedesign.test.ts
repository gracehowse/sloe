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
const MOBILE_METRIC = readFileSync(resolve(ROOT, "apps/mobile/app/progress-metric.tsx"), "utf8");
const WEB_METRIC = readFileSync(resolve(ROOT, "src/app/components/ProgressMetricDetail.tsx"), "utf8");
const MOBILE_PROGRESS = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"), "utf8");
const WEB_PROGRESS = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");
const MOBILE_SHEET = readFileSync(resolve(ROOT, "apps/mobile/components/progress/LogWeightSheet.tsx"), "utf8");

describe("ENG-822 — metric-detail soft elevation (both platforms)", () => {
  it("mobile metric-detail uses the flag-aware useCardElevation hook", () => {
    expect(MOBILE_METRIC).toContain("useCardElevation");
    // The flat per-card `borderWidth: 1, borderColor: t.border` cards were
    // replaced by the spread `...cardSurface` derived from the hook.
    expect(MOBILE_METRIC).toContain("...cardSurface");
    expect(MOBILE_METRIC).toContain("cardElevation.shadowStyle");
  });

  it("web metric-detail gates the soft shadow behind design_system_elevation", () => {
    expect(WEB_METRIC).toContain('isFeatureEnabled("design_system_elevation")');
    // Flag ON → soft shadow + no border; flag OFF → today's flat hairline.
    expect(WEB_METRIC).toContain("shadow-[var(--elev-card-soft)]");
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
    expect(MOBILE_SHEET).toContain("isNewWeightLow");
    expect(WEB_PROGRESS).toContain("isNewWeightLow");
  });

  it("mobile fires the loud success haptic only on a new low, quiet confirm otherwise", () => {
    expect(MOBILE_SHEET).toContain(
      "Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)",
    );
    expect(MOBILE_SHEET).toContain(
      "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)",
    );
  });

  it("both platforms mount the reserved WinMomentPlayer on a new low", () => {
    expect(MOBILE_PROGRESS).toContain("WinMomentPlayer");
    expect(MOBILE_PROGRESS).toContain("progress-weight-win-moment");
    expect(WEB_PROGRESS).toContain("WinMomentPlayer");
    expect(WEB_PROGRESS).toContain("progress-weight-win-moment");
  });

  it("both platforms emit the same cross-platform shown event (no weight value in payload)", () => {
    expect(MOBILE_PROGRESS).toContain("weight_new_low_win_moment_shown");
    expect(WEB_PROGRESS).toContain("weight_new_low_win_moment_shown");
    // HIGH-class PHI guard: the payload carries only the platform.
    expect(MOBILE_PROGRESS).toContain('{ platform: "ios" }');
    expect(WEB_PROGRESS).toContain('{ platform: "web" }');
  });
});
