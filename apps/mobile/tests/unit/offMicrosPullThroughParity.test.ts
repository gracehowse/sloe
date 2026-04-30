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
const WEB_FOOD_SEARCH = resolve(__dirname, "../../../../src/app/components/FoodSearch.tsx");
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
    expect(SRC.verify).toMatch(/microsPer100g:\s*parseOffMicrosPer100g\(n\)/);
  });

  it("mobile lookupBarcode attaches microsPer100g to BarcodeProduct", () => {
    // The OFF v2 fetch path (after F-78 res.ok guard).
    const idx = SRC.verify.indexOf("api/v2/product/${trimmed}.json");
    const microsIdx = SRC.verify.indexOf("microsPer100g: parseOffMicrosPer100g(n)", idx);
    expect(microsIdx).toBeGreaterThan(idx);
  });

  it("web fetchProductByBarcode attaches microsPer100g", () => {
    expect(SRC.webOffBarcode).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    expect(SRC.webOffBarcode).toMatch(/microsPer100g/);
  });

  it("web searchOffProducts attaches microsPer100g", () => {
    expect(SRC.webOffSearch).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    expect(SRC.webOffSearch).toMatch(/microsPer100g:\s*parseOffMicrosPer100g\(n\)/);
  });

  it("web FoodSearch.tsx (Today search) attaches microsPer100g on OFF hits", () => {
    expect(SRC.webSearch).toMatch(/import\s*\{\s*parseOffMicrosPer100g\s*\}/);
    expect(SRC.webSearch).toMatch(/microsPer100g:\s*parseOffMicrosPer100g\(n\)/);
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

describe("F-79 — commit sites scale + write nutrition_micros", () => {
  it("mobile barcode commit uses scaleMicrosForGrams + nutrition_micros field", () => {
    expect(SRC.barcode).toMatch(/import\s*\{\s*scaleMicrosForGrams\s*\}/);
    expect(SRC.barcode).toMatch(/scaleMicrosForGrams\(\s*product\.microsPer100g/);
    // The commit insert spreads `nutrition_micros` only when non-empty.
    expect(SRC.barcode).toMatch(/nutritionMicros/);
  });

  it("mobile Today food-search commit uses scaleMicrosForGrams", () => {
    expect(SRC.todayIndex).toMatch(/import\s*\{\s*scaleMicrosForGrams\s*\}/);
    expect(SRC.todayIndex).toMatch(/scaleMicrosForGrams\(\s*result\.microsPer100g/);
  });

  it("web NutritionTracker (Today search + barcode) uses scaleMicrosForGrams", () => {
    expect(SRC.webTracker).toMatch(/import\s*\{\s*scaleMicrosForGrams\s*\}/);
    // Two callsites (Today search + Today barcode dialog), so the helper
    // is invoked at least twice.
    const occurrences = SRC.webTracker.match(/scaleMicrosForGrams\(/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
