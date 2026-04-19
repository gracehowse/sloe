/**
 * Web/mobile parity — per-serving display in food search.
 *
 * TestFlight build 9 `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19): the
 * search result list must render the item's natural portion as the
 * primary line (e.g. "Pret tuna sandwich · 485 kcal · 1 sandwich (230 g)")
 * with the per-100g figure as a subdued secondary reference. To stop
 * the two platforms from drifting, both `src/app/components/FoodSearch.tsx`
 * and `apps/mobile/components/FoodSearchModal.tsx` import the
 * portion-inference helpers from the same shared module at
 * `src/lib/nutrition/primaryServing.ts`.
 *
 * If this test fails because someone re-implemented the inference
 * inline, see the linked TestFlight ticket before "fixing" the test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_MODAL_PATH = resolve(__dirname, "../../components/FoodSearchModal.tsx");
const MOBILE_VERIFY_PATH = resolve(__dirname, "../../lib/verifyRecipe.ts");
const WEB_PATH = resolve(__dirname, "../../../../src/app/components/FoodSearch.tsx");
const HELPER_PATH = resolve(
  __dirname,
  "../../../../src/lib/nutrition/primaryServing.ts",
);

const MOBILE_MODAL_SRC = readFileSync(MOBILE_MODAL_PATH, "utf8");
const MOBILE_VERIFY_SRC = readFileSync(MOBILE_VERIFY_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const HELPER_SRC = readFileSync(HELPER_PATH, "utf8");

const SOURCE_HELPERS = [
  "pickEdamamPrimaryServing",
  "pickUsdaBrandedPrimaryServing",
  "pickUsdaFoodPortionsPrimaryServing",
  "parseOffPrimaryServing",
];

describe("food search primary-serving parity (TestFlight APo0qS9vcFvmBJEJJ_-61YA)", () => {
  it("exports all four source-specific helpers from the shared module", () => {
    for (const fn of SOURCE_HELPERS) {
      expect(HELPER_SRC).toMatch(new RegExp(`export function ${fn}\\b`));
    }
    expect(HELPER_SRC).toMatch(/export function scalePrimaryServingFromPer100g\b/);
    expect(HELPER_SRC).toMatch(/export function primaryServingToPortionChip\b/);
  });

  it("mobile verifyRecipe.ts imports the inference helpers from the shared module", () => {
    expect(MOBILE_VERIFY_SRC).toMatch(
      /from\s+["'][^"']*src\/lib\/nutrition\/primaryServing["']/,
    );
    for (const fn of SOURCE_HELPERS) {
      expect(MOBILE_VERIFY_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });

  it("mobile FoodSearchModal.tsx imports the portion-chip adapter from the shared module", () => {
    expect(MOBILE_MODAL_SRC).toMatch(
      /from\s+["'][^"']*src\/lib\/nutrition\/primaryServing["']/,
    );
    expect(MOBILE_MODAL_SRC).toMatch(/\bprimaryServingToPortionChip\b/);
  });

  it("web FoodSearch.tsx imports every inference helper from the shared module", () => {
    expect(WEB_SRC).toMatch(/from\s+["'][^"']*lib\/nutrition\/primaryServing["']/);
    for (const fn of SOURCE_HELPERS) {
      expect(WEB_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
    expect(WEB_SRC).toMatch(/\bprimaryServingToPortionChip\b/);
  });

  it("both platforms render the primary-serving line from item.primaryServing", () => {
    // Primary kcal rendered from the shared shape on both surfaces.
    expect(MOBILE_MODAL_SRC).toMatch(/primary\.kcal/);
    expect(MOBILE_MODAL_SRC).toMatch(/primary\.grams/);
    expect(MOBILE_MODAL_SRC).toMatch(/primary\.label/);
    expect(WEB_SRC).toMatch(/item\.primaryServing\.kcal/);
    expect(WEB_SRC).toMatch(/item\.primaryServing\.grams/);
    expect(WEB_SRC).toMatch(/item\.primaryServing\.label/);
  });

  it("both platforms keep a per-100g reference as subdued secondary text", () => {
    expect(MOBILE_MODAL_SRC).toMatch(/kcal \/ 100 g/);
    expect(WEB_SRC).toMatch(/kcal \/ 100 g/);
  });
});
