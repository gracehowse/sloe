/**
 * ENG-746 (piece 1): the curated genericFoods / genericBeverages tables are
 * wired into the shared verify pipeline (src/lib/nutrition/verifyIngredients.ts)
 * as a high-priority exact-alias short-circuit, ABOVE the network providers.
 *
 * These tests disable EVERY external provider (USDA / FatSecret / Edamam / OFF /
 * Suppr user-foods DB). With all of them off, the only way a staple can resolve
 * to a high-confidence `source: "Suppr"` row is the in-memory curated
 * short-circuit — so a green test here proves the wiring, not a provider, is
 * what matched. Mobile inherits this automatically: every mobile recipe-verify
 * call POSTs to /api/nutrition/verify-recipe, which calls verifyIngredients.
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

import {
  verifyIngredients,
  MIN_ACCEPT_CONFIDENCE,
} from "@/lib/nutrition/verifyIngredients";
import { ingredientVerifyNeedsReview } from "@/lib/nutrition/verifyConfidencePolicy";

async function verifyOne(name: string, amount: string, unit: string) {
  const result = await verifyIngredients({
    ingredients: [{ name, amount, unit }],
    servings: 1,
    provider: "auto",
  });
  return result.verified[0]!;
}

describe("verifyIngredients — curated generic short-circuit (ENG-746)", () => {
  it("resolves a generic FOOD staple from the curated table with no providers", async () => {
    const row = await verifyOne("brown rice", "100", "g");
    expect(row.source).toBe("Suppr");
    expect(row.confidence).toBe(0.95);
    expect(row.confidence).toBeGreaterThanOrEqual(MIN_ACCEPT_CONFIDENCE);
    expect(row.fatSecretFoodId).toBe("generic-food:brown-rice");
    expect(row.matchedName).toBe("Brown rice (cooked)");
    expect(row.macros).not.toBeNull();
    // 100g brown rice ≈ 123 kcal (per100g, factor 1)
    expect(row.macros!.calories).toBe(123);
    // accepted rows sum into the recipe totals (not belowAcceptFloor)
    expect(row.belowAcceptFloor).toBeFalsy();
  });

  it("resolves whole milk via the curated BEVERAGE table (no food/beverage collision)", async () => {
    const row = await verifyOne("whole milk", "200", "ml");
    expect(row.source).toBe("Suppr");
    expect(row.confidence).toBe(0.95);
    expect(row.fatSecretFoodId).toBe("generic-beverage:whole-milk");
    expect(row.macros).not.toBeNull();
    // 200ml whole milk ≈ 122 kcal (61 kcal / 100ml, 1 g/ml)
    expect(row.macros!.calories).toBe(122);
    // bare "milk" also resolves (alias on the whole-milk beverage)
    expect((await verifyOne("milk", "100", "ml")).fatSecretFoodId).toBe(
      "generic-beverage:whole-milk",
    );
  });

  it("resolves the new ENG-746 flour entry + existing staples (flour, salmon)", async () => {
    const flour = await verifyOne("plain flour", "100", "g");
    expect(flour.source).toBe("Suppr");
    expect(flour.fatSecretFoodId).toBe("generic-food:flour");
    expect(flour.macros!.calories).toBe(364);

    const salmon = await verifyOne("salmon", "150", "g");
    expect(salmon.source).toBe("Suppr");
    expect(salmon.fatSecretFoodId).toBe("generic-food:salmon");
  });

  it("does NOT short-circuit an unknown ingredient (it falls through the curated tables)", async () => {
    // 'foie gras' is in neither curated table; with every provider off the
    // only path to source "Suppr" is the curated short-circuit — which must
    // NOT fire here. It should land on the local estimate / unverified path.
    const row = await verifyOne("foie gras", "50", "g");
    expect(row.source).not.toBe("Suppr");
  });
});

describe("verifyIngredients — recipe-level stats row set (ENG-1305)", () => {
  // With all providers off: "brown rice" resolves via the curated table
  // (Suppr, confidence 0.95, accepted) and "mackerel" falls through to the
  // local estimator (Estimated, confidence 0.35 — below the 0.55 accept
  // floor, macros kept on the row but EXCLUDED from totals).
  async function verifyRiceAndMackerel() {
    return verifyIngredients({
      ingredients: [
        { name: "brown rice", amount: "100", unit: "g" },
        { name: "mackerel", amount: "100", unit: "g" },
      ],
      servings: 1,
      provider: "auto",
    });
  }

  it("flags the below-floor row and excludes it from totals", async () => {
    const result = await verifyRiceAndMackerel();
    const rice = result.verified[0]!;
    const mackerel = result.verified[1]!;
    expect(rice.belowAcceptFloor).toBeFalsy();
    expect(mackerel.source).toBe("Estimated");
    expect(mackerel.confidence).toBeLessThan(MIN_ACCEPT_CONFIDENCE);
    expect(mackerel.belowAcceptFloor).toBe(true);
    expect(mackerel.macros).not.toBeNull(); // estimate stays on the row for the UI
    expect(result.belowAcceptFloorCount).toBe(1);
    // Totals sum ONLY the accepted rice row (100 g ≈ 123 kcal).
    expect(result.totals.calories).toBe(123);
  });

  it("min/avg confidence describe the SAME row set the totals sum", async () => {
    const result = await verifyRiceAndMackerel();
    // Pre-ENG-1305 the excluded mackerel row (0.35) dragged min to 0.35 and
    // avg to 0.65 — stats describing a different recipe than the headline
    // numbers. Now both stats describe the single accepted row.
    expect(result.minIngredientConfidence).toBe(0.95);
    expect(result.avgIngredientConfidence).toBe(0.95);
  });

  it("excluded rows still force the review nudge via belowAcceptFloorCount", async () => {
    const result = await verifyRiceAndMackerel();
    // Stats alone no longer carry the excluded row's signal…
    expect(
      ingredientVerifyNeedsReview(result.avgIngredientConfidence, result.minIngredientConfidence),
    ).toBe(false);
    // …the count is what keeps the recipe honest.
    expect(
      ingredientVerifyNeedsReview(
        result.avgIngredientConfidence,
        result.minIngredientConfidence,
        result.belowAcceptFloorCount,
      ),
    ).toBe(true);
  });

  it("all-rows-excluded recipe reports zeroed stats and still nudges review", async () => {
    const result = await verifyIngredients({
      ingredients: [{ name: "mackerel", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });
    expect(result.belowAcceptFloorCount).toBe(1);
    expect(result.totals.calories).toBe(0);
    expect(result.minIngredientConfidence).toBe(0);
    expect(result.avgIngredientConfidence).toBe(0);
    expect(
      ingredientVerifyNeedsReview(
        result.avgIngredientConfidence,
        result.minIngredientConfidence,
        result.belowAcceptFloorCount,
      ),
    ).toBe(true);
  });
});
