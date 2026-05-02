/**
 * Build-40 (2026-05-01) — TestFlight Build 40 feedback "cortado should
 * have lots of options". Pin the wiring change that makes the mobile +
 * web search pipelines surface ALL beverage-family siblings instead of
 * just the canonical row.
 *
 * `matchGenericBeverages()` (multi-result) is exercised behaviourally
 * in `genericBeverages.test.ts`. This file pins the surface area where
 * `searchFoods()` (mobile) and the web `FoodSearchPanel` consume it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VERIFY_PATH = resolve(__dirname, "../../apps/mobile/lib/verifyRecipe.ts");
const WEB_PANEL_PATH = resolve(
  __dirname,
  "../../src/app/components/food-search/FoodSearchPanel.tsx",
);

const VERIFY_SRC = readFileSync(VERIFY_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PANEL_PATH, "utf8");

describe("Build-40 — mobile searchFoods uses matchGenericBeverages (multi-result)", () => {
  it("imports matchGenericBeverages alongside the legacy single-row matcher", () => {
    expect(VERIFY_SRC).toMatch(/matchGenericBeverages/);
  });

  it("calls matchGenericBeverages(t) inside searchFoods", () => {
    expect(VERIFY_SRC).toMatch(/const genericBeverages = matchGenericBeverages\(t\)/);
  });

  it("genericRows is built by mapping every matched beverage (not the first only)", () => {
    expect(VERIFY_SRC).toMatch(
      /genericBeverages\.length > 0[\s\S]*?genericBeverages\.map\(genericBeverageToUnifiedResult\)/,
    );
  });

  it("guard: generic-food fallback only runs when no beverage family matched", () => {
    expect(VERIFY_SRC).toMatch(
      /genericBeverages\.length > 0 \? null : matchGenericFood\(t\)/,
    );
  });
});

describe("Build-40 — web FoodSearchPanel uses matchGenericBeverages (multi-result)", () => {
  it("imports matchGenericBeverages alongside the legacy single-row matcher", () => {
    expect(WEB_SRC).toMatch(/matchGenericBeverages/);
  });

  it("declares buildGenericMatchRows returning SearchResult[]", () => {
    expect(WEB_SRC).toMatch(/function buildGenericMatchRows\(query: string\): SearchResult\[\]/);
  });

  it("buildGenericMatchRows maps every matched beverage (family expansion, not single-row)", () => {
    expect(WEB_SRC).toMatch(
      /const beverages = matchGenericBeverages\(q\);[\s\S]*?beverages\.map\(genericBeverageToRow\)/,
    );
  });

  it("debounced search call uses buildGenericMatchRows (not the legacy single-row helper)", () => {
    expect(WEB_SRC).toMatch(/const generics = buildGenericMatchRows\(q\)/);
    expect(WEB_SRC).toMatch(/mergeAndDedup\(rankQ, usda, off, edamam, custom, 25, generics\)/);
  });
});
