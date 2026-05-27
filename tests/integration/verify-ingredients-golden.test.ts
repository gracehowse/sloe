/**
 * Golden-path integration tests for verifyIngredients with external providers disabled.
 * nutrition-engine / orchestrator: guards parse → measureToGrams → estimation without live USDA/OFF/FatSecret.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import { parseRawIngredients, verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import {
  GOLDEN_ESTIMATION_CASES,
  assertVerifyResultShape,
  expectPerServingMatchesTotals,
  expectTotalsExcludeBelowFloorRows,
} from "../fixtures/verifyRecipeGolden";

describe("verifyIngredients golden (estimation-only, mocked OFF)", () => {
  for (const c of GOLDEN_ESTIMATION_CASES) {
    it(`${c.id}: ${c.note}`, async () => {
      const result = await verifyIngredients({
        ingredients: c.ingredients,
        servings: c.servings,
        provider: "auto",
      });

      expect(result.verified).toHaveLength(c.ingredients.length);

      if (c.id === "empty-name-unverified") {
        expect(result.verified[0]!.source).toBe("Unverified");
        expect(result.verified[0]!.macros).toBeNull();
        expect(result.totals.calories).toBe(0);
        expect(result.primarySource).toBe("Unverified");
        // Unverified rows carry no estimate, so they aren't "below-floor" rows.
        expect(result.verified[0]!.belowAcceptFloor).toBeUndefined();
        expect(result.belowAcceptFloorCount).toBe(0);
        return;
      }

      assertVerifyResultShape(result);
      // Estimation-only rows are sub-floor (0.15–0.35 confidence): the source
      // is still "Estimated" and the per-row estimate is preserved, but ENG-691
      // EXCLUDES them from the recipe totals (no silent summing of guesses).
      expect(result.verified.every((v) => v.source === "Estimated")).toBe(true);
      expect(result.verified.every((v) => v.belowAcceptFloor === true)).toBe(true);
      expect(result.verified.every((v) => (v.macros?.calories ?? 0) > 0)).toBe(true);
      expect(result.belowAcceptFloorCount).toBe(c.ingredients.length);
      expect(result.totals.calories).toBe(0);
      expect(result.primarySource).toBe("Estimated");
      expectPerServingMatchesTotals(result, c.servings);
      expectTotalsExcludeBelowFloorRows(result);
    });
  }

  it("parseRawIngredients + verify: free-text range line is an excluded estimate", async () => {
    const structured = parseRawIngredients(["2-3 tbsp olive oil"]);
    expect(structured).toHaveLength(1);
    expect(structured[0]!.unit).toMatch(/tbsp/i);
    const result = await verifyIngredients({
      ingredients: structured,
      servings: 1,
      provider: "auto",
    });
    // The estimate is computed and preserved on the row…
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.verified[0]!.macros?.calories).toBeGreaterThan(0);
    // …but flagged sub-floor and kept out of totals.
    expect(result.verified[0]!.belowAcceptFloor).toBe(true);
    expect(result.totals.calories).toBe(0);
  });

  it("parseRawIngredients: 3 medium onions estimate is preserved but excluded from totals", async () => {
    const structured = parseRawIngredients(["3 medium onions"]);
    expect(structured[0]!.amount).toBeTruthy();
    expect(structured[0]!.name.toLowerCase()).toContain("onion");
    const result = await verifyIngredients({
      ingredients: structured,
      servings: 1,
      provider: "auto",
    });
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.verified[0]!.macros?.calories).toBeGreaterThan(0);
    expect(result.verified[0]!.belowAcceptFloor).toBe(true);
    expect(result.totals.calories).toBe(0);
    expect(result.belowAcceptFloorCount).toBe(1);
  });
});
