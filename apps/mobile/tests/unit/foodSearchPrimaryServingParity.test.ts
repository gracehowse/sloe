/**
 * Web/mobile parity — per-serving display in food search.
 *
 * TestFlight build 9 `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19) shipped the
 * inference. Build 11 `AKvgjnb` + `APGJJlg` (2026-04-19) extended the
 * fix into the row copy: both surfaces now render a "per serving" badge
 * (vs "per 100g" fallback) and delegate the headline decision to a
 * shared pure helper (`src/lib/nutrition/foodSearchHeadline.ts`) so
 * they can't drift.
 *
 * If this test fails because someone re-implemented the inference or
 * the headline logic inline, see the linked TestFlight tickets before
 * "fixing" the test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_MODAL_PATH = resolve(__dirname, "../../components/FoodSearchModal.tsx");
/**
 * 2026-04-30 — the search results + preview body lifted out of
 * `FoodSearchModal.tsx` into a shared `FoodSearchPanel.tsx` so the
 * same component can mount inline inside `<LogSheet>` (no nested
 * modal). The headline / primary-serving wiring lives in the panel
 * now; this test reads it as the primary mobile source.
 */
const MOBILE_PANEL_PATH = resolve(
  __dirname,
  "../../components/food-search/FoodSearchPanel.tsx",
);
const MOBILE_VERIFY_PATH = resolve(__dirname, "../../lib/verifyRecipe.ts");
/**
 * 2026-04-30 — web FoodSearch.tsx (1568 LOC) was extracted into
 * `food-search/FoodSearchPanel.tsx` (commit `cb1317f`). The wrapper
 * keeps only the dialog shell; primary-serving + headline imports
 * + row JSX all live in the panel. Source-pin parity reads the panel.
 */
const WEB_PATH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const HELPER_PATH = resolve(
  __dirname,
  "../../../../src/lib/nutrition/primaryServing.ts",
);
const HEADLINE_HELPER_PATH = resolve(
  __dirname,
  "../../../../src/lib/nutrition/foodSearchHeadline.ts",
);

const MOBILE_MODAL_SRC = readFileSync(MOBILE_MODAL_PATH, "utf8");
const MOBILE_PANEL_SRC = readFileSync(MOBILE_PANEL_PATH, "utf8");
const MOBILE_VERIFY_SRC = readFileSync(MOBILE_VERIFY_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const HELPER_SRC = readFileSync(HELPER_PATH, "utf8");
const HEADLINE_HELPER_SRC = readFileSync(HEADLINE_HELPER_PATH, "utf8");
/**
 * Combined mobile source — primary-serving / headline wiring now
 * lives in the panel, but the modal still mounts the panel. Either
 * file can host the import as long as the canonical helper is the
 * one being used.
 */
const MOBILE_COMBINED_SRC = `${MOBILE_MODAL_SRC}\n${MOBILE_PANEL_SRC}`;

const SOURCE_HELPERS = [
  "pickEdamamPrimaryServing",
  "pickUsdaBrandedPrimaryServing",
  "pickUsdaFoodPortionsPrimaryServing",
  "parseOffPrimaryServing",
];

describe("food search primary-serving parity (TestFlight APo0qS9vcFvmBJEJJ_-61YA + AKvgjnb + APGJJlg)", () => {
  it("exports all four source-specific helpers from the shared module", () => {
    for (const fn of SOURCE_HELPERS) {
      expect(HELPER_SRC).toMatch(new RegExp(`export function ${fn}\\b`));
    }
    expect(HELPER_SRC).toMatch(/export function scalePrimaryServingFromPer100g\b/);
    expect(HELPER_SRC).toMatch(/export function primaryServingToPortionChip\b/);
  });

  it("mobile verifyRecipe.ts imports the inference helpers from the shared module", () => {
    expect(MOBILE_VERIFY_SRC).toMatch(
      /from\s+["'][^"']*@suppr\/shared\/nutrition\/primaryServing["']/,
    );
    for (const fn of SOURCE_HELPERS) {
      expect(MOBILE_VERIFY_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });

  it("mobile food-search surface imports the portion-chip adapter from the shared module", () => {
    expect(MOBILE_COMBINED_SRC).toMatch(
      /from\s+["'][^"']*\/nutrition\/primaryServing["']/,
    );
    expect(MOBILE_COMBINED_SRC).toMatch(/\bprimaryServingToPortionChip\b/);
  });

  it("web FoodSearchPanel imports inference helpers and buildPortions", () => {
    expect(WEB_SRC).toMatch(/from\s+["'][^"']*\/nutrition\/primaryServing["']/);
    for (const fn of SOURCE_HELPERS) {
      expect(WEB_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
    expect(WEB_SRC).toMatch(/\bbuildPortions\b/);
  });

  it("both platforms delegate the row headline to the shared helper", () => {
    expect(HEADLINE_HELPER_SRC).toMatch(/export function resolveFoodSearchHeadline\b/);
    expect(HEADLINE_HELPER_SRC).toMatch(/FOOD_SEARCH_PER_SERVING_BADGE\s*=\s*"per serving"/);
    expect(HEADLINE_HELPER_SRC).toMatch(/FOOD_SEARCH_PER_100G_BADGE\s*=\s*"per 100g"/);

    for (const src of [MOBILE_COMBINED_SRC, WEB_SRC]) {
      expect(src).toMatch(
        /from\s+["'][^"']*\/nutrition\/foodSearchHeadline["']/,
      );
      expect(src).toMatch(/\bresolveFoodSearchHeadline\b/);
      expect(src).toMatch(/FOOD_SEARCH_PER_SERVING_BADGE/);
      expect(src).toMatch(/FOOD_SEARCH_PER_100G_BADGE/);
      // The row render must branch on the helper's mode tag.
      expect(src).toMatch(/headline\.mode\s*===\s*"per-serving"/);
      expect(src).toMatch(/headline\.mode\s*===\s*"per-100g"/);
      // Headline kcal number is read from the helper, not recomputed.
      expect(src).toMatch(/headline\.headlineKcal/);
    }
  });

  it("the shared helper defines the single per-serving reference format", () => {
    // The `{kcal} kcal / 100 g` secondary reference must live only in
    // the helper — if either surface reintroduces its own copy, the
    // assertion below will flag it.
    expect(HEADLINE_HELPER_SRC).toMatch(/kcal \/ 100 g/);
    expect(MOBILE_COMBINED_SRC).not.toMatch(/kcal \/ 100 g/);
    expect(WEB_SRC).not.toMatch(/kcal \/ 100 g/);
  });
});
