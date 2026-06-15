/**
 * F-79 (2026-04-25) — pin OFF micronutrient pull-through at every layer
 * on both web and mobile. The bug was that OFF data carried sat fat /
 * sodium / cholesterol / etc. but the parser dropped everything except
 * kcal/P/C/F/fiber/sugar/sodium, so the food-detail "Vitamins, minerals
 * & more" panel rendered "—" on every row.
 *
 * Source-string matching mirrors `foodSearchPagination` and
 * `offPlausibilityGateParity`. Pin the entire ingest → commit chain:
 *
 *   ingest (search)         → emits microsPer100g per OFF hit
 *   ingest (barcode)        → emits microsPer100g per OFF product
 *   merge / row             → carries microsPer100g onto the unified row
 *   modal / preview         → forwards microsPer100g through to onSelect
 *   commit (Today food log) → scales by grams and writes to nutrition_micros
 *   commit (Today barcode)  → scales by grams and writes to nutrition_micros
 *
 * If any link drops the field, micros silently disappear → bug recurs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_VERIFY = resolve(__dirname, "../../lib/verifyRecipe.ts");
const MOBILE_BARCODE = resolve(__dirname, "../../app/(tabs)/barcode.tsx");
const MOBILE_INDEX = resolve(__dirname, "../../app/(tabs)/index.tsx");
const MOBILE_MODAL = resolve(__dirname, "../../components/FoodSearchModal.tsx");
/**
 * 2026-04-30 — preview state + SelectedFood emit live in the shared
 * `FoodSearchPanel.tsx` so the same component can mount inline in
 * `<LogSheet>`. Both files are read here; the assertion concatenates
 * them so either may host the relevant snippet.
 */
const MOBILE_PANEL = resolve(
  __dirname,
  "../../components/food-search/FoodSearchPanel.tsx",
);
/**
 * 2026-04-30 — web FoodSearch.tsx (1568 LOC) was extracted into
 * `food-search/FoodSearchPanel.tsx` (commit `cb1317f`). The wrapper
 * keeps only the dialog shell; OFF ingest + UnifiedSearchResult /
 * SelectedFood preview emit all live in the panel. Source-pin parity
 * reads the panel directly.
 */
const WEB_FOOD_SEARCH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const WEB_OFF_SEARCH = resolve(__dirname, "../../../../src/lib/openFoodFacts/searchProducts.ts");
const WEB_OFF_BARCODE = resolve(
  __dirname,
  "../../../../src/lib/openFoodFacts/fetchProductByBarcode.ts",
);
const WEB_TRACKER = resolve(__dirname, "../../../../src/app/components/NutritionTracker.tsx");
const PARSER = resolve(__dirname, "../../../../src/lib/openFoodFacts/parseOffMicros.ts");

const modalSrc = readFileSync(MOBILE_MODAL, "utf8");
const panelSrc = readFileSync(MOBILE_PANEL, "utf8");

const SRC = {
  verify: readFileSync(MOBILE_VERIFY, "utf8"),
  barcode: readFileSync(MOBILE_BARCODE, "utf8"),
  todayIndex: readFileSync(MOBILE_INDEX, "utf8"),
  modal: modalSrc,
  panel: panelSrc,
  /** Combined modal + panel — preview / SelectedFood may live in either. */
  modalAndPanel: `${modalSrc}\n${panelSrc}`,
  webSearch: readFileSync(WEB_FOOD_SEARCH, "utf8"),
  webOffSearch: readFileSync(WEB_OFF_SEARCH, "utf8"),
  webOffBarcode: readFileSync(WEB_OFF_BARCODE, "utf8"),
  webTracker: readFileSync(WEB_TRACKER, "utf8"),
  parser: readFileSync(PARSER, "utf8"),
};

describe("F-79 — shared OFF micro parser", () => {
  it("exports parseOffMicrosPer100g + scaleMicrosForGrams", () => {
    expect(SRC.parser).toMatch(/export\s+function\s+parseOffMicrosPer100g/);
    expect(SRC.parser).toMatch(/export\s+function\s+scaleMicrosForGrams/);
  });

  it("emits canonical camelCase keys matching MICRO_LINES", () => {
    // Spot the keys the display reads — if any of these is missing from
    // the parser the row will silently render "—".
    for (const k of [
      "saturatedFatG", "monoFatG", "polyFatG", "transFatG", "cholesterolMg",
      "caffeineMg", "calciumMg", "ironMg", "magnesiumMg", "phosphorusMg",
      "potassiumMg", "zincMg", "vitaminCMg", "vitaminDMcg", "vitaminEMg",
      "vitaminKMcg", "vitaminAMcgRae", "folateMcg", "vitaminB12Mcg",
    ]) {
      expect(SRC.parser).toMatch(new RegExp(`"${k}"`));
    }
  });
});

describe("F-79 — ingest layer pulls full micro set", () => {
  it("mobile searchOpenFoodFacts attaches microsPer100g to every hit", () => {
    expect(SRC.verify).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    // ENG-738 — micros now scaled by the reconcile per-100g factor (`, f`).
    expect(SRC.verify).toMatch(/microsPer100g:\s*parseOffMicrosPer100g\(n,\s*f\)/);
  });

  it("mobile lookupBarcode attaches microsPer100g to BarcodeProduct", () => {
    // The OFF v2 fetch path (after F-78 res.ok guard).
    // ENG-738 — micros now scaled by the reconcile per-100g factor (`, f`).
    const idx = SRC.verify.indexOf("api/v2/product/${trimmed}.json");
    const microsIdx = SRC.verify.indexOf("microsPer100g: parseOffMicrosPer100g(n, f)", idx);
    expect(microsIdx).toBeGreaterThan(idx);
  });

  it("web fetchProductByBarcode attaches microsPer100g", () => {
    expect(SRC.webOffBarcode).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    expect(SRC.webOffBarcode).toMatch(/microsPer100g/);
  });

  it("web searchOffProducts attaches microsPer100g", () => {
    expect(SRC.webOffSearch).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    // ENG-738 — micros now scaled by the reconcile per-100g factor (`, f`).
    expect(SRC.webOffSearch).toMatch(/microsPer100g:\s*parseOffMicrosPer100g\(n,\s*f\)/);
  });

  it("web FoodSearchPanel passes through microsPer100g from proxied OFF hits (ENG-1059)", () => {
    expect(SRC.webSearch).toMatch(/\/api\/off\/search/);
    // ENG-1077 — the row passes the OFF hit's micros through the per-
    // micronutrient plausibility clamp. OFF-SPECIFIC: the OFF row is the only
    // one followed by `, primaryServing` (the Edamam row uses a conditional
    // spread `{ ... }` with no trailing comma), so this still fails if the OFF
    // pull-through is dropped even when the Edamam row keeps its own micros line.
    expect(SRC.webSearch).toMatch(
      /microsPer100g:\s*optionalSanitizedMicrosPer100g\(h\.microsPer100g\),\s*primaryServing/,
    );
  });

  it("ENG-1062 — preview surfaces scaled vendor micros beyond fibre/sugar/sodium", () => {
    expect(SRC.modalAndPanel).toMatch(/foodSearchPreviewExtraMicroRows/);
    expect(SRC.webSearch).toMatch(/foodSearchPreviewExtraMicroRows/);
  });
});

describe("F-79 — UnifiedSearchResult / SelectedFood / FoodSearchSelection carry micros", () => {
  it("UnifiedSearchResult declares microsPer100g", () => {
    expect(SRC.verify).toMatch(/microsPer100g\?\:\s*Record<string,\s*number>/);
  });

  it("mobile FoodSearchPanel Preview state + SelectedFood carry microsPer100g", () => {
    expect(SRC.modalAndPanel).toMatch(/microsPer100g\?\:\s*Record<string,\s*number>/);
    expect(SRC.modalAndPanel).toMatch(/microsPer100g:\s*item\.microsPer100g/);
    // onSelect emit must spread the field through, not strip it.
    expect(SRC.modalAndPanel).toMatch(/preview\.microsPer100g\s*\?\s*\{\s*microsPer100g:/);
  });

  it("web FoodSearchSelection declares microsPer100g + setPreview emits it", () => {
    expect(SRC.webSearch).toMatch(/microsPer100g\?\:\s*Record<string,\s*number>/);
    expect(SRC.webSearch).toMatch(/microsPer100g:\s*item\.microsPer100g/);
    expect(SRC.webSearch).toMatch(/preview\.microsPer100g\s*\?\s*\{\s*microsPer100g:/);
  });
});

describe("ENG-738 — generic-food micros thread through both platforms", () => {
  // Same pull-through chain as OFF, but the source is the in-memory
  // generic-food dictionary (carrot, spinach, …) keyed by the baked
  // `genericFoodMicros.ts` table. Pre-ENG-738 the GenericFood row + select
  // branch dropped `microsPer100g`, so logging a generic staple wrote an
  // empty `nutrition_micros`. Pin the new threading on both platforms.
  it("mobile genericFoodToUnifiedResult attaches the baked micros to the row", () => {
    expect(SRC.verify).toMatch(
      /import\s*\{\s*genericFoodMicrosPer100g\s*\}\s*from\s*"@suppr\/shared\/nutrition\/genericFoodMicros"/,
    );
    // Looks up the panel by the food id and conditionally spreads it onto
    // the UnifiedSearchResult exactly like the OFF row.
    expect(SRC.verify).toMatch(/genericFoodMicrosPer100g\(f\.id\)/);
    expect(SRC.verify).toMatch(
      /\.\.\.\(genericMicros\s*\?\s*\{\s*microsPer100g:\s*genericMicros\s*\}\s*:\s*\{\}\)/,
    );
  });

  it("mobile FoodSearchPanel threads item.microsPer100g through the generic select branch", () => {
    // GenericBeverage + GenericFood share a select branch; the conditional
    // spread covers the GenericFood case (beverages carry no micros yet).
    expect(SRC.panel).toMatch(
      /\.\.\.\(item\.microsPer100g\s*\?\s*\{\s*microsPer100g:\s*item\.microsPer100g\s*\}\s*:\s*\{\}\)/,
    );
  });

  it("web buildGenericMatchRow attaches the baked micros + select branch threads them", () => {
    expect(SRC.webSearch).toMatch(
      /import\s*\{\s*genericFoodMicrosPer100g\s*\}\s*from\s*"@\/lib\/nutrition\/genericFoodMicros"/,
    );
    expect(SRC.webSearch).toMatch(/genericFoodMicrosPer100g\(food\.id\)/);
    expect(SRC.webSearch).toMatch(
      /\.\.\.\(genericMicros\s*\?\s*\{\s*microsPer100g:\s*genericMicros\s*\}\s*:\s*\{\}\)/,
    );
    // The combined Generic select branch threads item.microsPer100g onward.
    expect(SRC.webSearch).toMatch(
      /\.\.\.\(item\.microsPer100g\s*\?\s*\{\s*microsPer100g:\s*item\.microsPer100g\s*\}\s*:\s*\{\}\)/,
    );
  });

  it("the commit-path scale (scaleMicrosForGrams) is the same helper for generic foods", () => {
    // No new commit code — generic micros ride the existing
    // `scaleMicrosForGrams(result.microsPer100g ?? {}, grams, …)` path that
    // already handles OFF/USDA. Pin that the field name the commit reads
    // (`result.microsPer100g`) is what the generic branch now populates.
    expect(SRC.todayIndex).toMatch(/foodSelectionToMealMacros\(result\)/);
    expect(SRC.webTracker).toMatch(/foodSelectionToMealMacros\(/);
  });
});

describe("ENG-738 — every OFF call site applies the per-100g factor to micros/fiber/sugar/sodium", () => {
  // The SCALE bug: micros + fiber/sugar/sodium were read raw from `*_100g`
  // (per-serving on serving-basis rows) while macros were reconciled. Each
  // call site must now derive `const f = recon.per100gFactor` and multiply
  // the raw micro reads by it. If any site drops `f`, the bug recurs there.
  it("the helper threads a factor arg through to the raw `*_100g` reads", () => {
    // `read(...)` takes the factor and multiplies before unit-convert/round.
    expect(SRC.parser).toMatch(/function\s+read\([^)]*factor:\s*number\)/);
    expect(SRC.parser).toMatch(/raw\s*\*\s*factor/);
    // Public signature takes an optional factor (default 1, no-op).
    expect(SRC.parser).toMatch(/parseOffMicrosPer100g\(\s*[\s\S]*?factor:\s*number\s*=\s*1/);
  });

  it("reconcile exposes per100gFactor", () => {
    const recon = readFileSync(
      resolve(__dirname, "../../../../src/lib/openFoodFacts/reconcilePer100g.ts"),
      "utf8",
    );
    expect(recon).toMatch(/per100gFactor:\s*number/);
    expect(recon).toMatch(/per100gFactor\s*=\s*cal\.value\s*\/\s*rawEnergyKcal100g/);
    expect(recon).toMatch(/per100gFactor\s*=\s*100\s*\/\s*servingG/);
  });

  it("web searchOffProducts scales fiber/sugar/sodium by f", () => {
    expect(SRC.webOffSearch).toMatch(/const\s+f\s*=\s*recon\.per100gFactor/);
    expect(SRC.webOffSearch).toMatch(/n\.fiber_100g\s*\?\?\s*0\)\s*\*\s*f/);
    expect(SRC.webOffSearch).toMatch(/n\["sugars_100g"\]\s*\?\?\s*0\)\s*\*\s*f/);
    expect(SRC.webOffSearch).toMatch(/n\.sodium_100g\s*\?\?\s*0\)\s*\*\s*f/);
  });

  it("web fetchProductByBarcode scales fiber/sugar/sodium by f", () => {
    expect(SRC.webOffBarcode).toMatch(/const\s+f\s*=\s*recon\.per100gFactor/);
    expect(SRC.webOffBarcode).toMatch(/n\.fiber_100g\s*\?\?\s*0\)\s*\*\s*f/);
    expect(SRC.webOffBarcode).toMatch(/n\["sugars_100g"\]\s*\?\?\s*0\)\s*\*\s*f/);
    expect(SRC.webOffBarcode).toMatch(/n\.sodium_100g\s*\?\?\s*0\)\s*\*\s*f/);
  });

  it("web FoodSearchPanel proxies OFF search via API (reconcile server-side, ENG-1059)", () => {
    expect(SRC.webSearch).toMatch(/\/api\/off\/search/);
    expect(SRC.webSearch).not.toMatch(/reconcileOffPer100g\(n,\s*p\)/);
    expect(SRC.webOffSearch).toMatch(/nutrition_data_per,serving_quantity/);
  });

  it("mobile lookupBarcode reconciles + scales micros; search proxies OFF (ENG-1059)", () => {
    expect(SRC.verify).toMatch(/\/api\/off\/search/);
    expect(SRC.verify).toMatch(/reconcileOffPer100g\(n,\s*p\)/);
    expect(SRC.verify).toMatch(/parseOffMicrosPer100g\(n,\s*f\)/);
    expect(SRC.verify).toMatch(/n\.fiber_100g\s*\?\?\s*0\)\s*\*\s*f/);
  });
});

describe("F-79 — commit sites scale + write nutrition_micros", () => {
  it("mobile barcode commit uses scaleMicrosForGrams + nutrition_micros field", () => {
    expect(SRC.barcode).toMatch(/import\s*\{\s*scaleMicrosForGrams\s*\}/);
    expect(SRC.barcode).toMatch(/scaleMicrosForGrams\(\s*product\.microsPer100g/);
    // The commit insert spreads `nutrition_micros` only when non-empty.
    expect(SRC.barcode).toMatch(/nutritionMicros/);
  });

  it("mobile Today food-search commit uses foodSelectionToMealMacros", () => {
    expect(SRC.todayIndex).toMatch(/foodSelectionToMealMacros/);
    expect(SRC.todayIndex).toMatch(/foodSelectionToMealMacros\(result\)/);
  });

  it("web NutritionTracker food-search commit uses foodSelectionToMealMacros; barcode keeps scaleMicrosForGrams", () => {
    expect(SRC.webTracker).toMatch(/foodSelectionToMealMacros/);
    expect(SRC.webTracker).toMatch(/import\s*\{\s*scaleMicrosForGrams\s*\}/);
    expect(SRC.webTracker).toMatch(/scaleMicrosForGrams\(/);
  });
});
