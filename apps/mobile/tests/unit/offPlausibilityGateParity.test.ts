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
const WEB_FOOD_SEARCH = resolve(
  __dirname,
  "../../../../src/app/components/FoodSearch.tsx",
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
