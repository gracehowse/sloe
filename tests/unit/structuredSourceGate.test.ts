/**
 * structuredSourceGate — pins the canonical "is this from a real
 * catalog?" predicate that gates `recipe_ingredients.is_verified`
 * at write time on the import path.
 *
 * GW-08 (audit 2026-04-28). Regression test for the import-path
 * lie at `apps/mobile/lib/saveImportedRecipe.ts:210`.
 */
import { describe, it, expect } from "vitest";
import { isStructuredSource } from "../../src/lib/nutrition/structuredSourceGate";

describe("isStructuredSource — canonical catalog identifiers", () => {
  it("returns true for canonical USDA / OFF / FatSecret / Edamam strings", () => {
    expect(isStructuredSource("USDA")).toBe(true);
    expect(isStructuredSource("OFF")).toBe(true);
    expect(isStructuredSource("FatSecret")).toBe(true);
    expect(isStructuredSource("Edamam")).toBe(true);
  });

  it("returns true for case variants", () => {
    expect(isStructuredSource("usda")).toBe(true);
    expect(isStructuredSource("off")).toBe(true);
    expect(isStructuredSource("fatsecret")).toBe(true);
    expect(isStructuredSource("edamam")).toBe(true);
  });

  it("returns true for full-name variants", () => {
    expect(isStructuredSource("Open Food Facts")).toBe(true);
    expect(isStructuredSource("openfoodfacts")).toBe(true);
    expect(isStructuredSource("Fat Secret")).toBe(true);
  });

  it("returns true for suffixed / qualified labels", () => {
    expect(isStructuredSource("USDA Foundation")).toBe(true);
    expect(isStructuredSource("USDA SR Legacy")).toBe(true);
    expect(isStructuredSource("FatSecret Premier")).toBe(true);
  });
});

describe("isStructuredSource — non-catalog sources (the GW-08 fix)", () => {
  it("returns false for null / undefined / empty", () => {
    expect(isStructuredSource(null)).toBe(false);
    expect(isStructuredSource(undefined)).toBe(false);
    expect(isStructuredSource("")).toBe(false);
    expect(isStructuredSource("   ")).toBe(false);
  });

  it("returns false for AI / LLM / heuristic sources", () => {
    expect(isStructuredSource("AI photo")).toBe(false);
    expect(isStructuredSource("AI voice")).toBe(false);
    expect(isStructuredSource("Estimated")).toBe(false);
    expect(isStructuredSource("ai_photo")).toBe(false);
  });

  it("returns false for manual / custom sources", () => {
    expect(isStructuredSource("Manual entry")).toBe(false);
    expect(isStructuredSource("Custom")).toBe(false);
    expect(isStructuredSource("user")).toBe(false);
  });

  it("returns false for hostname / unknown source strings", () => {
    expect(isStructuredSource("bbcgoodfood.com")).toBe(false);
    expect(isStructuredSource("Recipe")).toBe(false);
    expect(isStructuredSource("verified")).toBe(false); // legacy generic label
  });

  it("the GW-08 root case: import path with no source set must return false", () => {
    // Pre-fix `apps/mobile/lib/saveImportedRecipe.ts:210` wrote
    // `is_verified: (m?.calories ?? 0) > 0` — true whenever the LLM
    // produced any non-zero calorie value, regardless of source. The
    // fix now gates on `isStructuredSource(m?.source)`. When the LLM
    // doesn't surface a catalog match, `m?.source` is null/undefined
    // and the gate must reject the row.
    expect(isStructuredSource(undefined)).toBe(false);
    expect(isStructuredSource(null)).toBe(false);
  });
});
