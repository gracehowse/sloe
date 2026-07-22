/**
 * ENG-1449 — one-commit-model regression pins (mobile + web).
 *
 * **Decision** (ENG-1462, Grace ratified 2026-07-07): the log-sheet staging
 * basket is retired. Evidence: its commit bar didn't render from the
 * search-results state, and closing the sheet from that state silently
 * discarded the staged items — EATEN stayed 0, no toast, no warning. Fix
 * direction was either (a) make the basket robust everywhere (persistent bar
 * + discard confirmation) or (b) kill it since every add path already has a
 * good one-tap "Logged to {slot} / Done / Undo" ceremony. Grace ratified (b).
 *
 * These are source-pin tests (not rendered-tree tests) because the goal is
 * making the ENG-1449 failure class **structurally unrepresentable** — a
 * future contributor who re-introduces a staged/basket state on the LogSheet
 * fails CI here, before the silent-discard bug can recur.
 *
 * Covers:
 *   1. No basket state, prop, or UI survives on either platform (no dead
 *      code, no dead copy, no dead analytics — per the "no silent leftovers"
 *      requirement).
 *   2. Every add path (`search.onSelect`) commits immediately and presents
 *      the Logged/Done/Undo confirmation — there is no intermediate staged
 *      state for a close to discard.
 *   3. The sheet-close effect (`!fabSheetOpen` / `!logSheetOpen`) only ever
 *      resets the confirmation card, never a staged-items array — because
 *      no such array exists to reset. This is the regression pin for "closing
 *      the sheet in ANY state can never discard an un-undone add": there is
 *      no staged, uncommitted, undo-able-only-by-not-closing state left in
 *      the component at all.
 *   4. "Save a usual meal" (the ticket's batching home) stays reachable from
 *      both LogSheets independent of the removed basket wiring.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const read = (p: string) => readFileSync(resolve(REPO, p), "utf8");

const MOBILE_LOG_SHEET = read("apps/mobile/components/today/LogSheet.tsx");
const MOBILE_FOOD_SEARCH = read("apps/mobile/components/food-search/FoodSearchPanel.tsx");
const MOBILE_TODAY_SCREEN = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
const WEB_LOG_SHEET = read("src/app/components/suppr/log-sheet.tsx");
const WEB_FOOD_SEARCH = read("src/app/components/food-search/FoodSearchPanel.tsx");
const WEB_NUTRITION_TRACKER = read("src/app/components/NutritionTracker.tsx");
const SHARED_TRAY = read("src/lib/nutrition/logSessionTray.ts");
const MOBILE_TRAY = read("apps/mobile/components/today/LogSessionTray.tsx");
const WEB_TRAY = read("src/app/components/suppr/log-session-tray.tsx");

// Case-insensitive — catches `basket`, `Basket`, `LogBasket`, etc. Excludes
// the unrelated PlanToolsV3 shopping-list "build your basket" copy (a
// different metaphor, out of ENG-1449 scope) by only scanning the six files
// that made up the staging-basket state machine.
const BASKET_RE = /basket/i;

describe("ENG-1449 — log-sheet staging basket is fully removed (no silent leftovers)", () => {
  it("mobile LogSheet.tsx carries no basket state, prop, or UI", () => {
    expect(MOBILE_LOG_SHEET).not.toMatch(BASKET_RE);
  });

  it("mobile FoodSearchPanel.tsx carries no onAddToBasket / basket-stage CTA", () => {
    expect(MOBILE_FOOD_SEARCH).not.toMatch(BASKET_RE);
  });

  it("mobile TodayScreen.tsx carries no logBasket state or commit handler", () => {
    expect(MOBILE_TODAY_SCREEN).not.toMatch(BASKET_RE);
  });

  it("web log-sheet.tsx carries no basket state, prop, or UI", () => {
    expect(WEB_LOG_SHEET).not.toMatch(BASKET_RE);
  });

  it("web FoodSearchPanel.tsx carries no onAddToBasket / basket-stage CTA", () => {
    expect(WEB_FOOD_SEARCH).not.toMatch(BASKET_RE);
  });

  it("web NutritionTracker.tsx carries no logBasket state or commit handler", () => {
    expect(WEB_NUTRITION_TRACKER).not.toMatch(BASKET_RE);
  });
});

describe("ENG-1449 — every add path commits immediately with the Logged/Done/Undo ceremony", () => {
  it("mobile: search.onSelect commits the log and presents the confirmation card synchronously (no staging step)", () => {
    // The handler must call commitLogSheetFoodSelection AND
    // presentLogSheetConfirmation in the same onSelect body — there is no
    // branch that instead stages the pick for a later commit. Window is
    // generous (the handler validates nutrition data with two Alert.alert
    // guards before the commit call).
    expect(MOBILE_TODAY_SCREEN).toMatch(
      /onSelect:\s*\(result\)\s*=>\s*\{[\s\S]{0,1200}?commitLogSheetFoodSelection\(result\)[\s\S]{0,200}?presentLogSheetConfirmation\(/,
    );
  });

  it("web: search.onSelect commits the log and presents the confirmation card synchronously (no staging step)", () => {
    expect(WEB_NUTRITION_TRACKER).toMatch(
      /onSelect:\s*\(selection\)\s*=>\s*\{[\s\S]{0,400}?commitFoodSearchSelection\(selection\)[\s\S]{0,200}?presentLogSheetConfirmation\(/,
    );
  });

  it("mobile FoodSearchPanel's portion preview has exactly ONE commit action (\"Use this\") — no secondary stage action", () => {
    expect(MOBILE_FOOD_SEARCH).toContain('testID="food-search-preview-use-this"');
    expect(MOBILE_FOOD_SEARCH).not.toContain("food-search-preview-add-to-basket");
  });

  it("web FoodSearchPanel's portion preview has exactly ONE commit action (\"Use this\") — no secondary stage action", () => {
    expect(WEB_FOOD_SEARCH).not.toContain("food-search-preview-add-to-basket");
    expect(WEB_FOOD_SEARCH).toMatch(/Use this/);
  });
});

describe("ENG-1449 — closing the sheet in ANY state can never discard an un-undone add", () => {
  // The original bug: `useEffect(() => { if (!open) { ...; setLogBasket([]) } })`
  // silently dropped staged items on close with no toast, no confirmation.
  // The regression pin is structural: there is no staged-items setter left
  // for a close effect to call. Confirmation-card state is fine to reset on
  // close — the log itself already committed by the time the card renders;
  // resetting the card only clears the *presentation*, never un-logs the food.

  it("mobile: the fabSheetOpen-close effect resets ONLY the confirmation card, nothing staged", () => {
    const closeEffect = MOBILE_TODAY_SCREEN.match(
      /useEffect\(\(\) => \{\s*if \(!fabSheetOpen\) \{([\s\S]{0,200}?)\}\s*\}, \[fabSheetOpen\]\);/,
    );
    expect(closeEffect).not.toBeNull();
    const body = closeEffect![1];
    expect(body).toMatch(/setLogSheetConfirmation\(null\)/);
    // No staged/basket setter of any kind survives in the effect body.
    expect(body).not.toMatch(BASKET_RE);
    expect(body).not.toMatch(/setStaged|setPending|setQueued/);
  });

  it("web: the logSheetOpen-close effect resets ONLY the confirmation card, nothing staged", () => {
    const closeEffect = WEB_NUTRITION_TRACKER.match(
      /useEffect\(\(\) => \{\s*if \(!logSheetOpen\) \{([\s\S]{0,200}?)\}\s*\}, \[logSheetOpen\]\);/,
    );
    expect(closeEffect).not.toBeNull();
    const body = closeEffect![1];
    expect(body).toMatch(/setLogSheetConfirmation\(null\)/);
    expect(body).not.toMatch(BASKET_RE);
    expect(body).not.toMatch(/setStaged|setPending|setQueued/);
  });

  it("mobile: no basket-shaped useState survives anywhere in TodayScreen.tsx", () => {
    // Belt-and-braces: even a renamed staging array (not called "basket")
    // would still be a `useState<Array<...>>([])` holding un-committed
    // food-search selections. Pin that no such shape exists.
    expect(MOBILE_TODAY_SCREEN).not.toMatch(
      /useState<\s*Array<\{[\s\S]{0,80}?selection[\s\S]{0,80}?\}>\s*>\(\[\]\)/,
    );
  });

  it("web: no basket-shaped useState survives anywhere in NutritionTracker.tsx", () => {
    expect(WEB_NUTRITION_TRACKER).not.toMatch(
      /useState<\s*Array<\{[\s\S]{0,80}?selection[\s\S]{0,80}?\}>\s*>\(\[\]\)/,
    );
  });
});

describe("ENG-1449 — \"Save a usual meal\" is reachable (the batching home now)", () => {
  it("mobile: onCreateSavedMeal is wired into the Saved tab of the LogSheet", () => {
    expect(MOBILE_TODAY_SCREEN).toMatch(/onCreateSavedMeal:\s*\(\)\s*=>\s*\{/);
  });

  it("web: onCreateSavedMeal is wired into the Saved tab of the LogSheet", () => {
    expect(WEB_NUTRITION_TRACKER).toMatch(/onCreateSavedMeal:\s*\(\)\s*=>\s*\{/);
  });

  it("mobile LogSheet renders the 'Save a usual meal' / 'Save another usual meal' CTA in the Saved-tab empty/populated states", () => {
    expect(MOBILE_LOG_SHEET).toMatch(/Save a usual meal/);
    expect(MOBILE_LOG_SHEET).toMatch(/Save another usual meal/);
  });
});

/**
 * ENG-1643 — the session tray is a receipt, never a stage.
 * Spec: `docs/specs/2026-07-21-log-session-tray.md` §9.
 *
 * The tray extends the ENG-1462 one-commit model's PRESENTATION (the sheet
 * stays open + a running receipt) without weakening its commit SEMANTICS: every
 * tray item is already committed (carries a `mealId`), so closing the sheet in
 * any state still loses nothing. These source pins make the ENG-1449
 * silent-discard failure class structurally unrepresentable for the tray too.
 */
describe("ENG-1643 — the session tray is a receipt, never a stage", () => {
  it('"basket" stays banned in all six pinned files (the tray is committed, not a rename dodge)', () => {
    // The tray uses "tray"; a re-introduced "basket" is a genuinely different
    // (staged, un-committed) contract and must never come back.
    expect(MOBILE_LOG_SHEET).not.toMatch(BASKET_RE);
    expect(MOBILE_FOOD_SEARCH).not.toMatch(BASKET_RE);
    expect(MOBILE_TODAY_SCREEN).not.toMatch(BASKET_RE);
    expect(WEB_LOG_SHEET).not.toMatch(BASKET_RE);
    expect(WEB_FOOD_SEARCH).not.toMatch(BASKET_RE);
    expect(WEB_NUTRITION_TRACKER).not.toMatch(BASKET_RE);
  });

  it('"basket"/"cart" stay banned in the new tray files too', () => {
    for (const src of [SHARED_TRAY, MOBILE_TRAY, WEB_TRAY]) {
      expect(src).not.toMatch(BASKET_RE);
      expect(src).not.toMatch(/\bcart\b/i);
    }
  });

  it("the shared tray item type REQUIRES a committed mealId (a stage-less item is unrepresentable)", () => {
    // `mealId: string` (non-optional) on the exported item interface — a tray
    // item without a committed journal-row id cannot be constructed.
    expect(SHARED_TRAY).toMatch(
      /export interface LogSessionTrayItem \{[\s\S]{0,200}?\bmealId: string;/,
    );
  });

  it("mobile: appendLogSessionTray only ever receives the RESULT of the synchronous commit call", () => {
    // The commit call precedes the append within a tight window, and the append
    // is fed the mapped commit result — never a pre-commit stage object.
    expect(MOBILE_TODAY_SCREEN).toMatch(
      /const committed = commitLogSheetFoodSelection\(result\);[\s\S]{0,120}?appendLogSessionTray\(committedToTrayItem\(committed\)\)/,
    );
  });

  it("web: appendLogSessionTray only ever receives the RESULT of the synchronous commit call", () => {
    expect(WEB_NUTRITION_TRACKER).toMatch(
      /const result = commitFoodSearchSelection\(selection\);[\s\S]{0,120}?appendLogSessionTray\(committedToTrayItem\(result\)\)/,
    );
  });

  it("mobile: the fabSheetOpen-close effect resets the tray (presentation only) — no delete/un-commit", () => {
    const closeEffect = MOBILE_TODAY_SCREEN.match(
      /useEffect\(\(\) => \{\s*if \(!fabSheetOpen\) \{([\s\S]{0,200}?)\}\s*\}, \[fabSheetOpen\]\)/,
    );
    expect(closeEffect).not.toBeNull();
    const body = closeEffect![1];
    expect(body).toMatch(/resetLogSessionTray\(\)/);
    expect(body).not.toMatch(BASKET_RE);
    expect(body).not.toMatch(/setStaged|setPending|setQueued/);
    expect(body).not.toMatch(/deleteMeal|removeLoggedMeal|\.delete\(/);
  });

  it("web: the logSheetOpen-close effect resets the tray (presentation only) — no delete/un-commit", () => {
    const closeEffect = WEB_NUTRITION_TRACKER.match(
      /useEffect\(\(\) => \{\s*if \(!logSheetOpen\) \{([\s\S]{0,200}?)\}\s*\}, \[logSheetOpen\]\)/,
    );
    expect(closeEffect).not.toBeNull();
    const body = closeEffect![1];
    expect(body).toMatch(/resetLogSessionTray\(\)/);
    expect(body).not.toMatch(BASKET_RE);
    expect(body).not.toMatch(/setStaged|setPending|setQueued/);
    expect(body).not.toMatch(/deleteMeal|removeLoggedMeal|\.delete\(/);
  });

  it("flag-OFF S13 path stays reachable in the same onSelect body (both hosts)", () => {
    // The tray branch is an early return guarded by the flag; the S13
    // presentLogSheetConfirmation call remains the else path.
    expect(MOBILE_TODAY_SCREEN).toMatch(
      /if \(sessionTrayEnabled\) \{ appendLogSessionTray\([\s\S]{0,80}?return; \}[\s\S]{0,120}?presentLogSheetConfirmation\(/,
    );
    expect(WEB_NUTRITION_TRACKER).toMatch(
      /if \(sessionTrayEnabled\) \{ appendLogSessionTray\([\s\S]{0,80}?return; \}[\s\S]{0,120}?presentLogSheetConfirmation\(/,
    );
  });

  it("both hosts register + read the log_session_tray_v1 flag", () => {
    expect(MOBILE_TODAY_SCREEN).toMatch(/isFeatureEnabled\("log_session_tray_v1"\)/);
    expect(WEB_NUTRITION_TRACKER).toMatch(/isFeatureEnabled\("log_session_tray_v1"\)/);
  });
});
