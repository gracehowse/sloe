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

describe("LogSheet web wiring (NutritionTracker + raised tab-bar button)", () => {
  const trackerPath = path.resolve(__dirname, "../../../../src/app/components/NutritionTracker.tsx");
  const trackerSrc = fs.readFileSync(trackerPath, "utf8");
  // 2026-04-30 (commits `a95fa30` + `cb1317f`) — the side `<LogFab>`
  // (right:18 / bottom:100) was retired on web in favour of the
  // centered raised tab-bar button (mirrors mobile commit `6633d2d`).
  // The button lives in `App.tsx` and dispatches a `?openLog=1` URL
  // param; `NutritionTracker` consumes that param and opens the
  // canonical `<LogSheet>` — so the canonical Log entry point still
  // resolves to the same sheet, just via a URL-stamp rather than a
  // direct ref.
  const appPath = path.resolve(__dirname, "../../../../src/app/App.tsx");
  const appSrc = fs.readFileSync(appPath, "utf8");

  it("imports the canonical <LogSheet>", () => {
    expect(trackerSrc).toContain('import { LogSheet }');
  });

  it("the raised tab-bar Plus button stamps ?openLog=1 on the URL", () => {
    // App.tsx defines `openLogSheetFromTabBar` which sets `openLog=1`
    // and routes to Today. The button itself wires `onClick` to that
    // handler.
    expect(appSrc).toMatch(
      /openLogSheetFromTabBar\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]+?params\.set\(["']openLog["'],\s*["']1["']\)/,
    );
    expect(appSrc).toMatch(
      /<button[\s\S]+?onClick=\{openLogSheetFromTabBar\}[\s\S]+?aria-label="Log a meal"/,
    );
  });

  it("NutritionTracker consumes ?openLog=1 and opens the canonical LogSheet", () => {
    // The URL param consumer flips `setLogSheetOpen(true)` and clears
    // the param so back-nav doesn't re-open the sheet — this is the
    // single canonical path from the raised button into the sheet.
    expect(trackerSrc).toMatch(
      /trackerSearchParams\.get\(["']openLog["']\)/,
    );
    expect(trackerSrc).toMatch(
      /if\s*\(openLogParam\s*!==\s*["']1["']\)\s*return;\s*\n\s*setLogSheetOpen\(true\)/,
    );
    expect(trackerSrc).toMatch(/params\.delete\(["']openLog["']\)/);
  });

  it("the legacy <LogFab> JSX is no longer rendered", () => {
    // `<LogFab>` is retired on web (commit `a95fa30`). Comments
    // referencing the legacy component are fine; an actual render
    // (`<LogFab` followed by whitespace or a self-close) is not.
    expect(trackerSrc).not.toMatch(/<LogFab[\s\n]/);
  });

  it("renders <LogSheet> wired to logSheetOpen", () => {
    expect(trackerSrc).toMatch(/<LogSheet[\s\S]+?open=\{logSheetOpen\}/);
  });
});
