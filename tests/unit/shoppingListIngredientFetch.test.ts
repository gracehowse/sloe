/**
 * ENG-1668 follow-up — seed catalogue ids must not hit `recipe_id` uuid col.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShoppingListIngredientsByRecipeId } from "../../src/lib/planning/shoppingListIngredientFetch";
import { findSeedRecipeById } from "../../src/lib/recipes/seedRecipesV2";

const SEED_ID = "seed-v2-mediterranean-tomato-butter-bean-orzo";

describe("fetchShoppingListIngredientsByRecipeId", () => {
  const inMock = vi.fn();
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ in: inMock })),
    })),
  };

  beforeEach(() => {
    inMock.mockReset();
    client.from.mockClear();
  });

  it("loads seed ingredients from the catalogue without querying Postgres", async () => {
    const seed = findSeedRecipeById(SEED_ID);
    expect(seed, "fixture seed must exist in catalogue").toBeTruthy();

    const { ingredientsByRecipeId, error } = await fetchShoppingListIngredientsByRecipeId(
      client,
      [SEED_ID],
    );

    expect(error).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
    const rows = ingredientsByRecipeId.get(SEED_ID) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        unit: "g",
      }),
    );
  });

  it("queries only non-seed ids and merges with seed rows", async () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    inMock.mockResolvedValue({
      data: [
        {
          recipe_id: uuid,
          name: "Olive oil",
          amount: 15,
          unit: "ml",
        },
      ],
      error: null,
    });

    const { ingredientsByRecipeId, error } = await fetchShoppingListIngredientsByRecipeId(
      client,
      [SEED_ID, uuid],
    );

    expect(error).toBeNull();
    expect(client.from).toHaveBeenCalledWith("recipe_ingredients");
    expect(inMock).toHaveBeenCalledWith("recipe_id", [uuid]);
    expect(ingredientsByRecipeId.get(uuid)?.[0]?.name).toBe("Olive oil");
    expect(ingredientsByRecipeId.get(SEED_ID)?.length).toBeGreaterThan(0);
  });

  it("surfaces the DB error without dropping already-resolved seed rows", async () => {
    const uuid = "22222222-2222-4222-8222-222222222222";
    inMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });

    const { ingredientsByRecipeId, error } = await fetchShoppingListIngredientsByRecipeId(
      client,
      [SEED_ID, uuid],
    );

    expect(error).toMatch(/connection reset/);
    expect(ingredientsByRecipeId.get(SEED_ID)?.length).toBeGreaterThan(0);
  });
});
