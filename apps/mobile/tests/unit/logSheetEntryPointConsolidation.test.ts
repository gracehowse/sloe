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

const indexPath = path.resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx");
const indexSrc = fs.readFileSync(indexPath, "utf8");
// 2026-06-12 (audit P2 #5): the openLog open/clear + the two dismissal
// effects moved out of index.tsx into `hooks/useLogSheetDeepLinks.ts` so
// they can be exercised with `renderHook` (see useLogSheetDeepLinks.test.ts)
// rather than only source-grepped. The dismissal pins below now pin the
// hook wiring + the hook's behaviours; the behavioural guard is the mounted
// renderHook test.
const deepLinkHookPath = path.resolve(
  __dirname,
  "../../hooks/useLogSheetDeepLinks.ts",
);
const deepLinkHookSrc = fs.readFileSync(deepLinkHookPath, "utf8");

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

  it("threads active meal slot into describe-flow review summary", () => {
    // ENG-1195: the NL describe review summary should say the concrete
    // active slot (Breakfast/Lunch/…) rather than falling back to "Meal".
    expect(indexSrc).toMatch(/describe=\{[\s\S]+?slotLabel:\s*activeMealSlot/);

    const logSheetPath = path.resolve(
      __dirname,
      "../../components/today/LogSheet.tsx",
    );
    const logSheetSrc = fs.readFileSync(logSheetPath, "utf8");
    expect(logSheetSrc).toMatch(/describe\?: \{[\s\S]+?slotLabel\?: string/);
    expect(logSheetSrc).toMatch(
      /<LogSheetDescribeFlow[\s\S]+?slotLabel=\{describe\.slotLabel\}/,
    );
  });

  it("wires the extracted useLogSheetDeepLinks hook (open/clear + dismissal)", () => {
    // 2026-06-12 (audit P2 #5): all three LogSheet deep-link behaviours
    // moved into `useLogSheetDeepLinks`. Pin that index.tsx imports and
    // invokes it, threading the live params + the fab setters + the
    // param-clear callback. A regression that drops the wiring (and
    // therefore breaks the tab bar Log button + the dismissals) fails CI
    // here; the behaviour itself is proven in useLogSheetDeepLinks.test.ts.
    expect(indexSrc).toContain(
      'import { useLogSheetDeepLinks } from "@/hooks/useLogSheetDeepLinks"',
    );
    expect(indexSrc).toMatch(
      /useLogSheetDeepLinks\(\{[\s\S]{0,400}?params,[\s\S]{0,400}?setFabSheetOpen,/,
    );
    expect(indexSrc).toMatch(/clearOpenLogParams:/);
    // The param-clear still routes through router.setParams clearing both
    // openLog + the _t cache-buster, so back-nav doesn't re-open the sheet.
    expect(indexSrc).toMatch(
      /router\.setParams\(\{ openLog: undefined, _t: undefined \}/,
    );
  });

  it("the hook opens the canonical sheet via `?openLog=1` (replaces the side <LogFab>, 2026-04-30)", () => {
    // The side `<LogFab>` was retired 2026-04-30 (customer-lens audit).
    // The entry point is the centered raised button in `<SupprTabBar>`,
    // which routes Today with `?openLog=1`; the hook consumes it.
    expect(deepLinkHookSrc).toMatch(
      /params\.openLog\s*===\s*"1"[\s\S]+?setFabSheetOpen\(true\)/,
    );
  });

  it("the hook dismisses LogSheet when Today loses focus (ENG-1061 / launch queue #8)", () => {
    expect(deepLinkHookSrc).toMatch(
      /ENG-1061[\s\S]+?useFocusEffect[\s\S]+?return \(\) => \{[\s\S]+?setFabSheetOpen\(false\)/,
    );
  });

  it("the hook dismisses LogSheet on in-tab deep links (date, editMealId) — launch queue #8 / PR #391", () => {
    expect(deepLinkHookSrc).toMatch(
      /params\.openLog === "1"[\s\S]+?return;[\s\S]+?setFabSheetOpen\(false\)/,
    );
    expect(deepLinkHookSrc).toMatch(/params\.editMealId/);
  });
});

describe("Today composition root — tracking-extras prefs (P0-3, 2026-04-28)", () => {
  // 2026-05-16 (Today god-component split #4, PR #264): the
  // tracking-extras `useFocusEffect` was extracted out of
  // `app/(tabs)/_today/TodayScreen.tsx` into a dedicated hook at
  // `hooks/useTrackingExtrasOnFocus.ts`. The behaviour pin (re-read
  // on every focus, not just mount) is unchanged — it now needs to
  // hold in BOTH files: parent must invoke the hook, hook must use
  // `useFocusEffect` against the prefs storage key.
  const hookPath = path.resolve(__dirname, "../../hooks/useTrackingExtrasOnFocus.ts");
  const hookSrc = fs.readFileSync(hookPath, "utf8");

  it("Today composition root invokes the extracted hook", () => {
    expect(indexSrc).toMatch(/useTrackingExtrasOnFocus\s*\(/);
  });

  it("the hook re-reads tracking-extras prefs on focus (not just mount)", () => {
    // The original implementation used `useEffect(..., [])`, which
    // only ran once on mount. After Settings -> Tracking extras
    // toggle the user came back to a stale Today. The fix is to
    // wrap the AsyncStorage read in `useFocusEffect` so it runs
    // every time Today is focused.
    //
    // Two independent assertions because the storage key is hoisted
    // to a `const` at the top of the hook file (above the
    // `useFocusEffect` block), so a single ordered regex can't pin
    // both. Together they prove: the hook (a) uses `useFocusEffect`,
    // not a mount-only `useEffect`, AND (b) reads the canonical
    // tracking-extras prefs key.
    expect(hookSrc).toMatch(/useFocusEffect\s*\(/);
    expect(hookSrc).toContain('"suppr.tracking-extras.v1"');
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
    // Early return when not the deep-link, then set the sheet open.
    // 2026-05-08 build-47 follow-up: a `setMealSlot(slotForHour(...))`
    // reset now sits between the early-return and `setLogSheetOpen(true)`
    // so the LogSheet header + pick-handlers default to time-of-day.
    // Allow that line in the gap; the slot-reset behaviour is pinned
    // separately in `logSheetSlotHonouredWeb.test.ts`.
    expect(trackerSrc).toMatch(
      /if\s*\(openLogParam\s*!==\s*["']1["']\)\s*return;[\s\S]{0,400}setLogSheetOpen\(true\)/,
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
