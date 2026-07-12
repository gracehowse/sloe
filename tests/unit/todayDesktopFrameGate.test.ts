/**
 * ENG-1494 / ENG-1495 — TodayDesktopFrame wiring + single-rail
 * conformance pins.
 *
 * ENG-1494 wired the frame behind `today_desktop_frame_v1` (default-OFF):
 *
 *   - App gates the today view on the flag with the direct
 *     `<NutritionTracker>` as the else/kill-switch;
 *   - the frame is dynamic-imported (it statically imports
 *     NutritionTracker — a static mount would pull the tracker into the
 *     main bundle and defeat the existing code-split);
 *   - the frame forwards `onOpenSettings` (previously dropped, which
 *     would have broken the settings avatar under the flag).
 *
 * ENG-1495 rebuilt the frame SINGLE-RAIL and flipped it default-ON:
 *
 *   - the frame renders NO grid and NO aside of its own —
 *     `<NutritionTracker>` already splits at `lg:` (main column +
 *     `TodayDesktopRightRail`); the ENG-1494 outer `lg:grid-cols-3`
 *     squeezed the hero to ~316px at 1280px;
 *   - the full HouseholdPanel (which mounted ABOVE the hero and pushed
 *     the ring ~1100px below the fold) is gone — household context is
 *     the slim `TodayHouseholdGlanceBar`, full-width chrome above the
 *     tracker, fed by `useHousehold()` (no second getMyHousehold);
 *   - the frame's extra rail card (the null-unless-data
 *     `TodayAppleHealthCard`) rides the tracker's `railExtra` seam
 *     into the tracker's OWN rail;
 *   - the rail's `TodayWeeklyInsightCard` is DELETED (it duplicated
 *     the tracker's own THIS WEEK card, `TodayDesktopRightRail`);
 *   - the flag lives in `REDESIGN_DEFAULT_ON` (web-only), with the
 *     App.tsx else-branch tracker render as the kill switch.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
// Doc comments legitimately NARRATE the refuted ENG-1494 geometry (grids,
// HouseholdPanel, getMyHousehold, the deleted weekly card) — only CODE
// references are violations, so negative assertions run comment-stripped.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const APP = read("src/app/App.tsx");
const FRAME = read("src/app/components/TodayDesktopFrame.tsx");
const TRACK = read("src/lib/analytics/track.ts");
const TRACKER = read("src/app/components/NutritionTracker.tsx");
const RAIL = read("src/app/components/suppr/today-desktop-right-rail.tsx");
const HEALTH_CARD = read("src/app/components/suppr/today-apple-health-card.tsx");
const GLANCE_BAR = read("src/app/components/suppr/today-household-glance-bar.tsx");

describe("TodayDesktopFrame wiring — ENG-1494", () => {
  it("App gates the today view on today_desktop_frame_v1 with the tracker as kill-switch", () => {
    expect(APP).toMatch(/isFeatureEnabled\("today_desktop_frame_v1"\) \? \(/);
    expect(APP).toMatch(/<TodayDesktopFrame/);
    // Kill switch: the direct tracker render survives as the else branch.
    expect(APP).toMatch(/\) : \(\s*<NutritionTracker/);
  });

  it("the frame is dynamic-imported, preserving the tracker code-split", () => {
    expect(APP).toMatch(
      /const TodayDesktopFrame = dynamic\(\s*\(\) => import\("\.\/components\/TodayDesktopFrame\.tsx"\)/,
    );
  });

  it("the frame forwards onOpenSettings to the tracker", () => {
    expect(FRAME).toMatch(/onOpenSettings\?: \(\) => void;/);
    expect(FRAME).toMatch(/onOpenSettings=\{onOpenSettings\}/);
  });
});

describe("TodayDesktopFrame single-rail conformance — ENG-1495", () => {
  it("the flag is default-ON (in REDESIGN_DEFAULT_ON) now that conformance is met", () => {
    const defaultOnBlock = TRACK.slice(
      TRACK.indexOf("const REDESIGN_DEFAULT_ON"),
      TRACK.indexOf("]);", TRACK.indexOf("const REDESIGN_DEFAULT_ON")),
    );
    expect(defaultOnBlock).toContain('"today_desktop_frame_v1"');
    // The flip rationale is documented inline and cites the ticket.
    expect(defaultOnBlock).toMatch(/ENG-1495/);
  });

  it("the frame renders NO grid and NO aside of its own (the tracker owns the split)", () => {
    // The refuted ENG-1494 geometry: an outer lg:grid around a component
    // that already splits internally squeezed the hero to ~316px.
    expect(stripComments(FRAME)).not.toMatch(/lg:grid/);
    expect(stripComments(FRAME)).not.toMatch(/<aside/);
    // The tracker's own split is the one and only desktop layout.
    expect(TRACKER).toMatch(/lg:flex lg:gap-8/);
    expect(TRACKER).toMatch(/<TodayDesktopRightRail/);
  });

  it("the frame no longer imports or mounts the full HouseholdPanel", () => {
    expect(FRAME).not.toMatch(/import\(["']\.\/HouseholdPanel["']\)/);
    expect(FRAME).not.toMatch(/from ["']\.\/HouseholdPanel["']/);
    expect(FRAME).not.toMatch(/<HouseholdPanel/);
  });

  it("household context is the slim glance bar above the tracker, fed by HouseholdContext", () => {
    expect(FRAME).toMatch(/import \{ TodayHouseholdGlanceBar \}/);
    expect(FRAME).toMatch(/<TodayHouseholdGlanceBar/);
    // The bar consumes the provider's one fetch — it must not re-run
    // the getMyHousehold fan-out (the ENG-1494 attempt did) and must
    // not smuggle types with `as any`.
    expect(GLANCE_BAR).toMatch(/useHousehold\(\)/);
    expect(stripComments(GLANCE_BAR)).not.toMatch(/getMyHousehold/);
    expect(stripComments(GLANCE_BAR)).not.toMatch(/as any/);
  });

  it("the Apple Health card rides the tracker's railExtra seam into its own rail", () => {
    expect(FRAME).toMatch(/railExtra=\{/);
    expect(FRAME).toMatch(/<TodayAppleHealthCard/);
    expect(TRACKER).toMatch(/railExtra\?: ReactNode;/);
    expect(TRACKER).toMatch(/railExtra=\{railExtra\}/);
    expect(RAIL).toMatch(/railExtra\?: React\.ReactNode;/);
    expect(RAIL).toMatch(/\{railExtra\}/);
  });

  it("the Apple Health card renders nothing without at least one real datum", () => {
    expect(HEALTH_CARD).toMatch(/if \(!hasAnyData\) return null;/);
    // The all-placeholder footnote branch is gone with it.
    expect(HEALTH_CARD).not.toContain("Data appears once the iOS app");
  });

  it("the duplicate TodayWeeklyInsightCard is deleted outright", () => {
    // The tracker's own THIS WEEK card (TodayDesktopRightRail) covers it.
    expect(stripComments(FRAME)).not.toMatch(/TodayWeeklyInsightCard/);
    expect(
      existsSync(
        resolve(ROOT, "src/app/components/suppr/today-weekly-insight-card.tsx"),
      ),
    ).toBe(false);
  });
});
