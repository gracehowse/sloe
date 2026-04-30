/**
 * logSheetEntryPointConsolidation — source-pin tests.
 *
 * Authority: D-2026-04-27-15 ("One canonical log path — persistent
 * FAB → single sheet with sub-tabs").
 *
 * Pins that the legacy 8+ entry-point splay (Quick Add, search,
 * barcode, voice, photo, recipe-detail-log, planned-meal-log,
 * household, copy-meal, usual-meal) collapses into the canonical
 * LogSheet. Specifically:
 *   - The legacy `<TodayFabSheet>` import is gone from the Today
 *     composition root (its callers have all been migrated).
 *   - `<LogSheet>` is imported and rendered from Today.
 *   - The Phase 2 placeholder alert wiring (`setFabSheetOpen` to a
 *     legacy sheet) now opens the canonical LogSheet primitive.
 *
 * The test reads the source files (not the rendered tree) because
 * the goal here is preventing regression — a future contributor
 * who re-adds <TodayFabSheet> behind a feature flag, or splays the
 * entry points back out, fails CI before TestFlight.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const indexPath = path.resolve(__dirname, "../../app/(tabs)/index.tsx");
const indexSrc = fs.readFileSync(indexPath, "utf8");

describe("LogSheet entry-point consolidation (mobile)", () => {
  it("Today composition root no longer imports the legacy <TodayFabSheet>", () => {
    expect(indexSrc).not.toMatch(/^import\s*\{\s*TodayFabSheet\s*\}/m);
  });

  it("Today composition root imports the canonical <LogSheet>", () => {
    expect(indexSrc).toContain('import { LogSheet }');
  });

  it("Today renders the canonical <LogSheet> wired to fabSheetOpen", () => {
    expect(indexSrc).toMatch(/<LogSheet\s/);
    expect(indexSrc).toMatch(/<LogSheet[\s\S]+?visible=\{fabSheetOpen\}/);
  });

  it("centered raised Log button opens the canonical sheet via `?openLog=1` (replaces the side <LogFab>, 2026-04-30)", () => {
    // The side `<LogFab>` was retired 2026-04-30 (customer-lens
    // audit). The new entry point is the centered raised button in
    // `<SupprTabBar>`, which routes Today with `?openLog=1`. Pin the
    // consumer effect here so a regression that drops the deep-link
    // wiring (and therefore breaks the tab bar Log button) fails CI.
    expect(indexSrc).toMatch(
      /params\.openLog\s*===\s*"1"[\s\S]+?setFabSheetOpen\(true\)/,
    );
  });
});

describe("Today composition root — tracking-extras prefs (P0-3, 2026-04-28)", () => {
  it("re-reads tracking-extras prefs on focus (not just mount)", () => {
    // The original implementation used `useEffect(..., [])`, which
    // only ran once on mount. After Settings -> Tracking extras
    // toggle the user came back to a stale Today. The fix is to
    // wrap the AsyncStorage read in `useFocusEffect` so it runs
    // every time Today is focused.
    expect(indexSrc).toMatch(
      /useFocusEffect\([\s\S]+?suppr\.tracking-extras\.v1[\s\S]+?\)/,
    );
  });
});

describe("LogSheet web wiring (NutritionTracker)", () => {
  const trackerPath = path.resolve(__dirname, "../../../../src/app/components/NutritionTracker.tsx");
  const trackerSrc = fs.readFileSync(trackerPath, "utf8");

  it("imports the canonical <LogSheet>", () => {
    expect(trackerSrc).toContain('import { LogSheet }');
  });

  it("LogFab onPress opens the canonical web LogSheet", () => {
    expect(trackerSrc).toMatch(
      /<LogFab[\s\S]+?onPress=\{\(\)\s*=>\s*setLogSheetOpen\(true\)\}/,
    );
  });

  it("renders <LogSheet> wired to logSheetOpen", () => {
    expect(trackerSrc).toMatch(/<LogSheet[\s\S]+?open=\{logSheetOpen\}/);
  });
});
