/**
 * Lane-A wire-up regression pin (2026-04-30) — FatSecret in the mobile
 * food-search merge.
 *
 * Pre-Lane-A:
 *   - Web FoodSearchPanel fanned out USDA + OFF + Edamam in parallel.
 *   - Mobile `searchFoods` (verifyRecipe.ts) fanned out the same three.
 *   - FatSecret was wired into autocomplete only.
 *   - Branded queries ("Big Mac" / "Starbucks") returned USDA-only on
 *     production despite valid Premier Free credentials.
 *
 * This file pins the structural wiring so a future refactor can't
 * silently drop FatSecret from the merge again. Source-level pins
 * mirror the pattern used by `foodSearchPagination.test.ts` and
 * `screenAuditFixesParity.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VERIFY_PATH = resolve(__dirname, "../../lib/verifyRecipe.ts");
const PANEL_PATH = resolve(
  __dirname,
  "../../components/food-search/FoodSearchPanel.tsx",
);
const WEB_PANEL_PATH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const FATSECRET_SEARCH_ROUTE_PATH = resolve(
  __dirname,
  "../../../../app/api/fatsecret/search/route.ts",
);
const FATSECRET_FOOD_ROUTE_PATH = resolve(
  __dirname,
  "../../../../app/api/fatsecret/food/route.ts",
);

const VERIFY_SRC = readFileSync(VERIFY_PATH, "utf8");
const PANEL_SRC = readFileSync(PANEL_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PANEL_PATH, "utf8");
const FATSECRET_SEARCH_ROUTE_SRC = readFileSync(FATSECRET_SEARCH_ROUTE_PATH, "utf8");
const FATSECRET_FOOD_ROUTE_SRC = readFileSync(FATSECRET_FOOD_ROUTE_PATH, "utf8");

describe("Lane-A — FatSecret search route", () => {
  it("exposes /api/fatsecret/search GET with rate-limit + auth + creds gates", () => {
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/export async function GET/);
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/getUserIdFromRequest/);
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/api:fatsecret-search/);
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/hasFatSecretConfig/);
  });

  it("calls fatSecretFoodSearch with maxResults=25 + a 0-indexed page_number", () => {
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/fatSecretFoodSearch\(cfg,\s*q,\s*\{[^}]*maxResults:\s*25/);
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/pageNumber:\s*pageNumber\s*-\s*1/);
  });

  it("swallows upstream errors → 200 with empty hits so the merge keeps rendering", () => {
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/console\.error\([^,]+"\[\/api\/fatsecret\/search\]"?[^)]*\)/s);
    expect(FATSECRET_SEARCH_ROUTE_SRC).toMatch(/return NextResponse\.json\(\s*\{\s*ok:\s*true,\s*hits:\s*\[\]/);
  });
});

describe("Lane-A — FatSecret food detail route", () => {
  it("exposes /api/fatsecret/food GET with rate-limit + auth + creds gates", () => {
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/export async function GET/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/api:fatsecret-food/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/hasFatSecretConfig/);
  });

  it("scales the picked serving to per-100g via servingMassGrams + normalizeServingToMacros", () => {
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/pickBestServing/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/normalizeServingToMacros/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/servingMassGrams/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/100\s*\/\s*grams/);
  });

  it("supports per-serving-only foods when FatSecret has no metric grounding (e.g. McDonald's Big Mac)", () => {
    // 2026-05-06: previously the route 422'd when grams<=0, making
    // FatSecret per-serving entries silently un-tappable from search.
    // Now it sets `macrosPer100g: null` + adds `macrosPerServing` so
    // the client can commit "1 serving = 580 kcal" honestly without
    // scaling. Pin the per-serving-only path:
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/isPerServingOnly/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/macrosPerServing/);
    expect(FATSECRET_FOOD_ROUTE_SRC).toMatch(/microsPerServing/);
    // No more 422 for missing metric serving — the route accepts
    // them and returns the per-serving payload instead.
    expect(FATSECRET_FOOD_ROUTE_SRC).not.toMatch(/no_metric_serving/);
  });
});

describe("Lane-A — mobile verifyRecipe wires FatSecret into the merge", () => {
  it("exports a searchFatSecret helper that hits /api/fatsecret/search", () => {
    expect(VERIFY_SRC).toMatch(/export async function searchFatSecret/);
    expect(VERIFY_SRC).toMatch(/\/api\/fatsecret\/search\?q=\$\{[^}]+\}&page=\$\{page\}/);
  });

  it("exports a getFatSecretFood helper that hits /api/fatsecret/food", () => {
    expect(VERIFY_SRC).toMatch(/export async function getFatSecretFood/);
    expect(VERIFY_SRC).toMatch(/\/api\/fatsecret\/food\?foodId=/);
  });

  it("searchFoods fans FatSecret out alongside USDA + OFF + Edamam", () => {
    expect(VERIFY_SRC).toMatch(/const fatsecretP = searchFatSecret/);
    // Promise.all variant kicks in when no onPartial is provided.
    expect(VERIFY_SRC).toMatch(/Promise\.all\(\[usdaP,\s*offP,\s*edamamP,\s*fatsecretP\]\)/);
  });

  it("mergeResults takes a fatsecret slot and surfaces FatSecret rows with _source: 'FatSecret'", () => {
    expect(VERIFY_SRC).toMatch(/fatsecret:\s*FatSecretSearchResult\[\]\s*=\s*\[\]/);
    expect(VERIFY_SRC).toMatch(/_source:\s*"FatSecret"/);
    expect(VERIFY_SRC).toMatch(/_fatSecretFoodId:\s*item\.foodId/);
  });

  it("mergeResults applies a -0.05 trust band to FatSecret rows (verified USDA still wins on tie)", () => {
    expect(VERIFY_SRC).toMatch(
      /searchRelevance\(query,\s*displayName\)\s*-\s*0\.05/,
    );
  });

  it("FatSecretSearchResult shape carries macrosPer100g | macrosPerServing | servingGrams", () => {
    expect(VERIFY_SRC).toMatch(/export type FatSecretSearchResult/);
    expect(VERIFY_SRC).toMatch(/macrosPer100g:\s*\{[\s\S]*?\}\s*\|\s*null/);
    expect(VERIFY_SRC).toMatch(/macrosPerServing:\s*\{[\s\S]*?\}\s*\|\s*null/);
    expect(VERIFY_SRC).toMatch(/servingGrams:\s*number\s*\|\s*null/);
  });
});

describe("Lane-A — mobile FoodSearchPanel handles FatSecret rows", () => {
  it("imports getFatSecretFood from verifyRecipe", () => {
    expect(PANEL_SRC).toMatch(/getFatSecretFood/);
  });

  it("includes FatSecret in the SearchRow source union", () => {
    expect(PANEL_SRC).toMatch(/_source:\s*"USDA"\s*\|\s*"OFF"\s*\|\s*"CUSTOM"\s*\|\s*"Edamam"\s*\|\s*"FatSecret"/);
  });

  it("on-tap branch fetches detail + opens preview with source: 'FatSecret'", () => {
    expect(PANEL_SRC).toMatch(/item\._source === "FatSecret"\s*&&\s*item\._fatSecretFoodId/);
    expect(PANEL_SRC).toMatch(/getFatSecretFood\(item\._fatSecretFoodId\)/);
    expect(PANEL_SRC).toMatch(/source:\s*"FatSecret"/);
  });

  it("SelectedFood carries an optional fatSecretFoodId field", () => {
    expect(PANEL_SRC).toMatch(/fatSecretFoodId\?:\s*string/);
  });
});

describe("Lane-A — web/mobile parity", () => {
  it("web FoodSearchPanel includes searchFatSecret in the parallel fetch", () => {
    expect(WEB_SRC).toMatch(/async function searchFatSecret/);
    // ENG-686 replaced Promise.all with a Promise.race streaming loop; verify
    // all four sources (including FatSecret) are still fired concurrently.
    expect(WEB_SRC).toMatch(/searchFatSecret\(q,\s*1\)/);
    expect(WEB_SRC).toMatch(/Promise\.race/);
  });

  it("web mergeAndDedup takes a fatsecret slot + applies the -0.05 trust band", () => {
    expect(WEB_SRC).toMatch(/fatsecret:\s*SearchResult\[\]\s*=\s*\[\]/);
    expect(WEB_SRC).toMatch(/_source === "FatSecret"\) return -0\.05/);
  });

  it("web on-tap fetches /api/fatsecret/food via fetchFatSecretDetail", () => {
    expect(WEB_SRC).toMatch(/async function fetchFatSecretDetail/);
    expect(WEB_SRC).toMatch(/\/api\/fatsecret\/food\?foodId=/);
    expect(WEB_SRC).toMatch(/source:\s*"FatSecret"/);
  });

  it("web load-more fetches FatSecret on subsequent pages too", () => {
    expect(WEB_SRC).toMatch(/searchFatSecret\(q,\s*nextPage\)/);
  });
});
