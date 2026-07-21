import { describe, it, expect } from "vitest";
import { scaleBatchCookToShoppingList } from "@/lib/planning/scaleBatchCookToShoppingList";

/**
 * ENG-1600 — batch-cook's "scale to shopping" used to persist via
 * `upsertShoppingListJsonItems`, writing to the dead `shopping_lists`/
 * `shopping_lists_legacy` JSON blob no live Shopping screen reads (see
 * `docs/journeys/shopping-list.md` "Fixed bug" section). These tests prove
 * the replacement — `scaleBatchCookToShoppingList` — persists exclusively
 * through the relational `shopping_items` table via the same ENG-943
 * delta-merge appender the single-recipe "Add to shopping list" action uses.
 */

type Row = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  source: string;
  checked_by: string | null;
};

/**
 * Minimal fake Supabase client: a thenable read chain + insert/update spies,
 * plus a `tablesQueried` log so tests can assert every query targeted
 * `shopping_items` — never a `shopping_lists`-shaped table.
 */
function fakeClient(rows: Row[]) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ patch: unknown; id: string }> = [];
  const tablesQueried: string[] = [];
  const read = {
    eq() {
      return read;
    },
    is() {
      return read;
    },
    then(onfulfilled: (res: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve(onfulfilled({ data: rows, error: null }));
    },
  };
  const client = {
    from(table: string) {
      tablesQueried.push(table);
      return {
        select() {
          return read;
        },
        insert(newRows: Array<Record<string, unknown>>) {
          inserts.push(...newRows);
          return Promise.resolve({ error: null });
        },
        update(patch: unknown) {
          return {
            eq(_col: string, id: string) {
              updates.push({ patch, id });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, inserts, updates, tablesQueried };
}

describe("scaleBatchCookToShoppingList (ENG-1600)", () => {
  it("persists the scaled recipe into shopping_items — never a shopping_lists JSON blob", async () => {
    const { client, inserts, tablesQueried } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Chicken Curry",
      recipeServings: 2,
      portions: 6,
      ingredients: [{ name: "chicken breast", amount: "300", unit: "g" }],
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.addedCount).toBe(1);
    expect(inserts).toHaveLength(1);
    // 6 portions ÷ 2 servings = 3x multiplier → 300 * 3 = 900.
    expect(inserts[0]).toMatchObject({ name: "chicken breast", amount: "900", unit: "g" });
    // Every table this write touched was `shopping_items` — the legacy
    // `shopping_lists`/`shopping_lists_legacy` blob is never written.
    expect(tablesQueried.length).toBeGreaterThan(0);
    expect(tablesQueried.every((t) => t === "shopping_items")).toBe(true);
  });

  it("excludes pantry-staple ingredients before persisting", async () => {
    const { client, inserts } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Pasta",
      recipeServings: 2,
      portions: 4,
      ingredients: [
        { name: "salt", amount: "1", unit: "tsp" },
        { name: "pasta", amount: "200", unit: "g" },
      ],
      pantryStaples: ["salt"],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as { name: string }).name).toBe("pasta");
  });

  it("returns an error and persists nothing when every ingredient is a pantry staple", async () => {
    const { client, inserts } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Rice",
      recipeServings: 2,
      portions: 4,
      ingredients: [{ name: "salt", amount: "1", unit: "tsp" }],
      pantryStaples: ["salt"],
    });

    expect(res.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("stamps household_id on inserts for a household scope", async () => {
    const { client, inserts } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "household", userId: "u1", householdId: "hh1" },
      recipeTitle: "Stew",
      recipeServings: 4,
      portions: 8,
      ingredients: [{ name: "beef", amount: "400", unit: "g" }],
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ household_id: "hh1", user_id: "u1" });
  });

  it("merges into an existing shopping_items row (sum) instead of duplicating it", async () => {
    const { client, inserts, updates } = fakeClient([
      {
        id: "row-1",
        name: "rice",
        amount: "200",
        unit: "g",
        category: "Grains",
        checked: false,
        source: "Plan",
        checked_by: null,
      },
    ]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Pilaf",
      recipeServings: 2,
      portions: 4,
      ingredients: [{ name: "rice", amount: "150", unit: "g" }],
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe("row-1");
    // portions(4) ÷ servings(2) = 2x multiplier → 150 * 2 = 300, + 200 existing = 500.
    expect((updates[0]?.patch as { amount: string }).amount).toBe("500");
  });
});
