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
