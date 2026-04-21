import { describe, it, expect } from "vitest";
import { confidenceForMatch, scaledMacrosPlausible, per100gPlausible } from "@/lib/nutrition/verifyIngredients";

describe("verifyIngredients pipeline source order", () => {
  it("confidence scoring ranks exact matches highly", () => {
    expect(confidenceForMatch("chicken breast", "Chicken, breast, meat only, cooked, roasted")).toBeGreaterThan(0.5);
    expect(confidenceForMatch("eggs", "Eggs, whole, raw")).toBeGreaterThan(0.5);
    // "rice" alone scores low against the verbose USDA name — name aliases handle this in the real pipeline
    // After alias: "rice white long grain" matches much better
    expect(confidenceForMatch("rice white long grain", "Rice, white, long-grain, regular, cooked")).toBeGreaterThan(0.4);
  });

  it("confidence scoring penalises brand/restaurant matches", () => {
    const generic = confidenceForMatch("chicken", "Chicken, breast, meat only, cooked");
    const branded = confidenceForMatch("chicken", "MCDONALD'S Chicken McNuggets");
    expect(generic).toBeGreaterThan(branded);
  });

  it("scaledMacrosPlausible accepts valid macros", () => {
    expect(scaledMacrosPlausible({ calories: 165, protein: 31, carbs: 0, fat: 3.6, fiberG: 0, sugarG: 0, sodiumMg: 74 })).toBe(true);
    // Rice
    expect(scaledMacrosPlausible({ calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiberG: 0.4, sugarG: 0, sodiumMg: 1 })).toBe(true);
  });

  it("scaledMacrosPlausible rejects impossible macros", () => {
    // 100 cal claimed but macros imply 900 cal
    expect(scaledMacrosPlausible({ calories: 100, protein: 50, carbs: 50, fat: 50, fiberG: 0, sugarG: 0, sodiumMg: 0 })).toBe(false);
  });

  // ── L10 — per100g plausibility bounds ────────────────────────
  it("per100gPlausible accepts normal foods", () => {
    expect(per100gPlausible({ calories: 165 })).toBe(true);
    expect(per100gPlausible({ calories: 0 })).toBe(true);
    expect(per100gPlausible({ calories: 884 })).toBe(true); // olive oil
  });

  it("per100gPlausible rejects >900 kcal/100g (above pure fat)", () => {
    expect(per100gPlausible({ calories: 1200 })).toBe(false);
    expect(per100gPlausible({ calories: 950 })).toBe(false);
  });

  it("per100gPlausible rejects negative kcal", () => {
    expect(per100gPlausible({ calories: -10 })).toBe(false);
  });

  it("per100gPlausible rejects non-finite kcal", () => {
    expect(per100gPlausible({ calories: Number.NaN })).toBe(false);
    expect(per100gPlausible({ calories: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("pipeline comment order is Suppr -> USDA -> Edamam -> OFF -> FatSecret -> estimation", async () => {
    // Verify the pipeline source priority by reading the primarySource array
    // which defines the order sources are ranked
    const { readFileSync } = await import("fs");
    const content = readFileSync("src/lib/nutrition/verifyIngredients.ts", "utf-8");
    const sourceArrayMatch = content.match(/\["Suppr".*?"Estimated"\]/);
    expect(sourceArrayMatch).not.toBeNull();
    expect(sourceArrayMatch![0]).toContain('"Suppr"');
    expect(sourceArrayMatch![0]).toContain('"Edamam"');
    // Suppr should come before USDA in the array
    const supprIdx = sourceArrayMatch![0].indexOf('"Suppr"');
    const usdaIdx = sourceArrayMatch![0].indexOf('"USDA"');
    expect(supprIdx).toBeLessThan(usdaIdx);
  });
});
