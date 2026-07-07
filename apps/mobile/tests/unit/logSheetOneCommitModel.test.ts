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
    // branch that instead stages the pick for a later commit.
    expect(MOBILE_TODAY_SCREEN).toMatch(
      /onSelect:\s*\(result\)\s*=>\s*\{[\s\S]{0,600}?commitLogSheetFoodSelection\(result\)[\s\S]{0,200}?presentLogSheetConfirmation\(/,
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
