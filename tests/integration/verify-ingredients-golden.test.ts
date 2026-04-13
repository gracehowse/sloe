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
}));

import { parseRawIngredients, verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import {
  GOLDEN_ESTIMATION_CASES,
  assertVerifyResultShape,
  expectPerServingMatchesTotals,
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
        return;
      }

      assertVerifyResultShape(result);
      expect(result.verified.every((v) => v.source === "Estimated")).toBe(true);
      expect(result.totals.calories).toBeGreaterThan(0);
      expect(result.primarySource).toBe("Estimated");
      expectPerServingMatchesTotals(result, c.servings);

      const sumCals = result.verified.reduce((a, v) => a + (v.macros?.calories ?? 0), 0);
      expect(result.totals.calories).toBe(sumCals);
    });
  }

  it("parseRawIngredients + verify: free-text range line becomes estimated macros", async () => {
    const structured = parseRawIngredients(["2-3 tbsp olive oil"]);
    expect(structured).toHaveLength(1);
    expect(structured[0]!.unit).toMatch(/tbsp/i);
    const result = await verifyIngredients({
      ingredients: structured,
      servings: 1,
      provider: "auto",
    });
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.verified[0]!.macros?.calories).toBeGreaterThan(0);
  });

  it("parseRawIngredients: 3 medium onions from a single line", async () => {
    const structured = parseRawIngredients(["3 medium onions"]);
    expect(structured[0]!.amount).toBeTruthy();
    expect(structured[0]!.name.toLowerCase()).toContain("onion");
    const result = await verifyIngredients({
      ingredients: structured,
      servings: 1,
      provider: "auto",
    });
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.totals.calories).toBeGreaterThan(0);
  });
});
