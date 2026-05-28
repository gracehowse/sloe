/**
 * F-77 (2026-04-25) + F-78 — pin OFF Atwater plausibility gate, trust-
 * weighted ranking, and barcode `res.ok` guard at every ingest point on
 * web and mobile. Source-string matching mirrors `foodSearchPagination`.
 *
 * Closes the "Eggs · 210 kcal · 3 g protein" failure (search) and the
 * "[lookupBarcode] failed: JSON Parse error" toast (barcode scan).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_VERIFY = resolve(__dirname, "../../lib/verifyRecipe.ts");
const MOBILE_BARCODE = resolve(__dirname, "../../app/(tabs)/barcode.tsx");
/**
 * 2026-04-30 — web FoodSearch.tsx (1568 LOC) was extracted into
 * `food-search/FoodSearchPanel.tsx` (commit `cb1317f`). The wrapper
 * keeps only the dialog shell; the OFF Atwater plausibility gate and
 * `mergeAndDedup` trustWeight ranking live in the panel. Source-pin
 * parity reads the panel directly.
 */
const WEB_FOOD_SEARCH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const WEB_OFF_SEARCH = resolve(
  __dirname,
  "../../../../src/lib/openFoodFacts/searchProducts.ts",
);
const WEB_OFF_BARCODE = resolve(
  __dirname,
  "../../../../src/lib/openFoodFacts/fetchProductByBarcode.ts",
);

const VERIFY_SRC = readFileSync(MOBILE_VERIFY, "utf8");
const BARCODE_SRC = readFileSync(MOBILE_BARCODE, "utf8");
const WEB_SEARCH_SRC = readFileSync(WEB_FOOD_SEARCH, "utf8");
const WEB_OFF_SEARCH_SRC = readFileSync(WEB_OFF_SEARCH, "utf8");
const WEB_OFF_BARCODE_SRC = readFileSync(WEB_OFF_BARCODE, "utf8");

describe("F-77 OFF Atwater plausibility gate — every ingest point", () => {
  it("mobile searchOpenFoodFacts filters with isPlausibleMacrosPer100g", () => {
    expect(VERIFY_SRC).toMatch(/import\s*\{\s*isPlausibleMacrosPer100g\s*\}/);
    expect(VERIFY_SRC).toMatch(/isPlausibleMacrosPer100g\(\{\s*calories:\s*h\.calories/);
  });

  it("web FoodSearch.tsx searchOff filters with isPlausibleMacrosPer100g", () => {
    expect(WEB_SEARCH_SRC).toMatch(/import\s*\{\s*isPlausibleMacrosPer100g\s*\}/);
    expect(WEB_SEARCH_SRC).toMatch(/isPlausibleMacrosPer100g\(\{[^}]*calories:\s*r\.macrosPer100g\.calories/s);
  });

  it("web searchOffProducts filters with isPlausibleMacrosPer100g", () => {
    expect(WEB_OFF_SEARCH_SRC).toMatch(/import\s*\{\s*isPlausibleMacrosPer100g\s*\}/);
    expect(WEB_OFF_SEARCH_SRC).toMatch(/isPlausibleMacrosPer100g\(\{\s*calories:\s*h\.calories/);
  });
});

describe("F-77 trust-weighted ranking — USDA over OFF on tie/near-tie", () => {
  it("mobile mergeResults applies an offTrustPenalty to OFF rows", () => {
    expect(VERIFY_SRC).toMatch(/offTrustPenalty/);
    expect(VERIFY_SRC).toMatch(/searchRelevance\(query,\s*displayName\)\s*-\s*offTrustPenalty/);
  });

  it("web mergeAndDedup applies a trustWeight delta to USDA / OFF / Edamam rows", () => {
    expect(WEB_SEARCH_SRC).toMatch(/trustWeight\s*=\s*\(r:\s*SearchResult\)/);
    expect(WEB_SEARCH_SRC).toMatch(/searchRelevance\(q,\s*r\.name\)\s*\+\s*trustWeight\(r\)/);
  });
});

describe("F-78 barcode lookup — res.ok guard before .json()", () => {
  it("mobile lookupBarcode guards res.ok before parsing the OFF response", () => {
    // The OFF v2 fetch in lookupBarcode now goes:
    //   if (!res.ok) return null;
    //   const text = await res.text();
    //   try { data = JSON.parse(text); } catch { ...; return null; }
    expect(VERIFY_SRC).toMatch(/api\/v2\/product\/\$\{trimmed\}\.json/);
    expect(VERIFY_SRC).toMatch(/F-78[^\n]*res\.ok/);
    // Hard pin: a guard appears between the OFF v2 fetch and the first
    // JSON.parse. The guard must precede any text/json access.
    const v2Idx = VERIFY_SRC.indexOf("api/v2/product/${trimmed}.json");
    const okIdx = VERIFY_SRC.indexOf("if (!res.ok) return null", v2Idx);
    const parseIdx = VERIFY_SRC.indexOf("JSON.parse", v2Idx);
    expect(okIdx).toBeGreaterThan(v2Idx);
    expect(parseIdx).toBeGreaterThan(okIdx);
  });

  it("web fetchProductByBarcode also guards res.ok (already in place)", () => {
    expect(WEB_OFF_BARCODE_SRC).toMatch(/if\s*\(!res\.ok\)\s*\{?\s*return\s*\{[^}]*ok:\s*false/);
  });
});

describe("F-78 barcode scan dedup — synchronous useRef", () => {
  it("barcode screen reads dedup key from a ref, not state", () => {
    expect(BARCODE_SRC).toMatch(/lastRef\s*=\s*useRef<string\s*\|\s*null>\(null\)/);
    expect(BARCODE_SRC).toMatch(/if\s*\(loading\s*\|\|\s*lastRef\.current\s*===\s*e\.data\)\s*return/);
    expect(BARCODE_SRC).toMatch(/lastRef\.current\s*=\s*e\.data/);
  });

  it("resetScan clears lastRef so scanning the same code again works after dismiss", () => {
    // Three reset paths: handleLog Alert, handleManualLog Alert, resetScan.
    const occurrences = BARCODE_SRC.match(/lastRef\.current\s*=\s*null/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * P0 (2026-05-26) — OFF per-100g basis reconcile + post-scale plausibility
 * guard. Closes the "Chobani Greek yogurt · 500 g · 1,325 kcal · 265 g
 * protein" failure where a `nutrition_data_per:"serving"` row's per-serving
 * values masqueraded as per-100g. Source-pin parity across web + mobile.
 */
const MOBILE_SCANNER_MODAL = resolve(__dirname, "../../components/BarcodeScannerModal.tsx");
const WEB_OFF_RECONCILE = resolve(
  __dirname,
  "../../../../src/lib/openFoodFacts/reconcilePer100g.ts",
);
const WEB_BARCODE_DIALOG = resolve(
  __dirname,
  "../../../../src/app/components/suppr/today-barcode-dialog.tsx",
);
const WEB_VERIFY = resolve(__dirname, "../../../../src/lib/nutrition/verifyIngredients.ts");
const SCANNER_MODAL_SRC = readFileSync(MOBILE_SCANNER_MODAL, "utf8");
const WEB_RECONCILE_SRC = readFileSync(WEB_OFF_RECONCILE, "utf8");
const WEB_BARCODE_DIALOG_SRC = readFileSync(WEB_BARCODE_DIALOG, "utf8");
const WEB_VERIFY_SRC = readFileSync(WEB_VERIFY, "utf8");

describe("P0 OFF per-100g basis reconcile — every OFF ingest point", () => {
  it("shared reconcile module reconstructs per-100g from per-serving", () => {
    expect(WEB_RECONCILE_SRC).toMatch(/export function reconcileOffPer100g/);
    expect(WEB_RECONCILE_SRC).toMatch(/perServing\s*\/\s*\(servingG\s*\/\s*100\)/);
  });

  it("web searchProducts reconciles before building the hit", () => {
    expect(WEB_OFF_SEARCH_SRC).toMatch(/import\s*\{\s*reconcileOffPer100g\s*\}/);
    expect(WEB_OFF_SEARCH_SRC).toMatch(/reconcileOffPer100g\(n,\s*p\)/);
  });

  it("web fetchProductByBarcode reconciles and drops the per-serving fallbacks", () => {
    expect(WEB_OFF_BARCODE_SRC).toMatch(/reconcileOffPer100g\(n,\s*p\)/);
    // The bare per-serving fallbacks must be gone.
    expect(WEB_OFF_BARCODE_SRC).not.toMatch(/n\["energy-kcal_100g"\]\s*\?\?\s*n\["energy-kcal"\]/);
    expect(WEB_OFF_BARCODE_SRC).not.toMatch(/n\.proteins_100g\s*\?\?\s*n\.proteins\b/);
  });

  it("mobile searchOpenFoodFacts + lookupBarcode both reconcile", () => {
    expect(VERIFY_SRC).toMatch(/import\s*\{\s*reconcileOffPer100g\s*\}/);
    const occurrences = VERIFY_SRC.match(/reconcileOffPer100g\(n,\s*p\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe("P0 post-scale plausibility guard — wired at both boundaries", () => {
  it("web verifyIngredients runs checkScaledLogPlausibility on every source branch", () => {
    expect(WEB_VERIFY_SRC).toMatch(/import\s*\{\s*checkScaledLogPlausibility\s*\}/);
    const occurrences = WEB_VERIFY_SRC.match(/checkScaledLogPlausibility\(/g) ?? [];
    // OFF + USDA + Edamam + Suppr + FatSecret + barcode override = 6.
    expect(occurrences.length).toBeGreaterThanOrEqual(5);
  });

  it("mobile barcode screen guards before the nutrition_entries insert", () => {
    expect(BARCODE_SRC).toMatch(/checkScaledLogPlausibility/);
    expect(BARCODE_SRC).toMatch(/Double-check these numbers/);
  });

  it("mobile BarcodeScannerModal guards before handing the row to the host", () => {
    expect(SCANNER_MODAL_SRC).toMatch(/checkScaledLogPlausibility/);
    expect(SCANNER_MODAL_SRC).toMatch(/Double-check these numbers/);
  });

  it("web barcode dialog guards before onConfirm (skips manual-override)", () => {
    expect(WEB_BARCODE_DIALOG_SRC).toMatch(/checkScaledLogPlausibility/);
    expect(WEB_BARCODE_DIALOG_SRC).toMatch(/barcodeMacrosManual\s*\|\|/);
  });
});

describe("ENG-702 portion picker — inline plausibility after scale", () => {
  const MOBILE_PORTION_PICKER = resolve(__dirname, "../../components/PortionPicker.tsx");
  const WEB_PORTION_PICKER = resolve(
    __dirname,
    "../../../../src/app/components/suppr/portion-picker.tsx",
  );
  const PORTION_PICKER_SHARED = resolve(
    __dirname,
    "../../../../src/lib/nutrition/portionPicker.ts",
  );
  const MOBILE_PICKER_SRC = readFileSync(MOBILE_PORTION_PICKER, "utf8");
  const WEB_PICKER_SRC = readFileSync(WEB_PORTION_PICKER, "utf8");
  const SHARED_PICKER_SRC = readFileSync(PORTION_PICKER_SHARED, "utf8");

  it("shared module exports evaluatePortionScalePlausibility", () => {
    expect(SHARED_PICKER_SRC).toMatch(/export function evaluatePortionScalePlausibility/);
    expect(SHARED_PICKER_SRC).toMatch(/checkScaledLogPlausibility/);
  });

  it("mobile PortionPicker surfaces inline warning when macrosPer100g is set", () => {
    expect(MOBILE_PICKER_SRC).toMatch(/evaluatePortionScalePlausibility/);
    expect(MOBILE_PICKER_SRC).toMatch(/macrosPer100g/);
    expect(MOBILE_PICKER_SRC).toMatch(/portionPlausibilityWarning/);
    expect(MOBILE_PICKER_SRC).toMatch(/accessibilityRole="alert"/);
  });

  it("web PortionPickerWeb mirrors mobile plausibility props", () => {
    expect(WEB_PICKER_SRC).toMatch(/evaluatePortionScalePlausibility/);
    expect(WEB_PICKER_SRC).toMatch(/macrosPer100g/);
    expect(WEB_PICKER_SRC).toMatch(/portionPlausibilityWarning/);
    expect(WEB_PICKER_SRC).toMatch(/role="alert"/);
  });

  it("barcode hosts pass per-100g panel + basisCorrected into the pickers", () => {
    expect(SCANNER_MODAL_SRC).toMatch(/macrosPer100g=\{\{/);
    expect(SCANNER_MODAL_SRC).toMatch(/basisCorrected=\{product\.basisCorrected\}/);
    expect(WEB_BARCODE_DIALOG_SRC).toMatch(/macrosPer100g=\{\{/);
    expect(WEB_BARCODE_DIALOG_SRC).toMatch(/basisCorrected=\{product\.basisCorrected\}/);
  });
});

describe("P0 parity footgun — mobile scaleMacrosByGrams", () => {
  it("mobile verifyRecipe exports scaleMacrosByGrams (grams), not a bare scaleMacros", () => {
    expect(VERIFY_SRC).toMatch(/export function scaleMacrosByGrams\(/);
    // The bare grams-taking scaleMacros export must be gone (the only
    // remaining `scaleMacros` is mealPlanAlgo's multiplier-taking one,
    // which lives in a different module).
    expect(VERIFY_SRC).not.toMatch(/export function scaleMacros\(/);
  });
});
