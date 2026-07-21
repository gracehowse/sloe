// @vitest-environment node
/**
 * ENG-1600 mobile parity pin. Batch-cook's "scale to shopping" action
 * (`apps/mobile/app/batch-cook.tsx` `scaleToShopping`) previously persisted
 * via `upsertShoppingListJsonItems`, writing to the dead
 * `shopping_lists`/`shopping_lists_legacy` JSON blob no live Shopping screen
 * reads — items added this way never appeared on `/shopping`. It must now
 * run off the SAME shared persistence the web `MealPlanner.tsx`
 * `scaleBatchCookToShopping` uses — no reinvented merge/write logic on
 * mobile. Importing `scaleBatchCookToShoppingList` through the
 * `@suppr/shared/planning/scaleBatchCookToShoppingList` alias proves it
 * resolves and the mobile build gets identical scope/pantry/multiplier/
 * delta-merge semantics. Full persistence-shape coverage (household
 * stamping, pantry-staple exclusion, merge-vs-insert) lives in the shared
 * test: `tests/unit/scaleBatchCookToShoppingList.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { scaleBatchCookToShoppingList } from "@suppr/shared/planning/scaleBatchCookToShoppingList";

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

function fakeClient(rows: Row[]) {
  const inserts: Record<string, unknown>[] = [];
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
        insert(newRows: Record<string, unknown>[]) {
          inserts.push(...newRows);
          return Promise.resolve({ error: null });
        },
        update() {
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };
  return { client, inserts, tablesQueried };
}

describe("ENG-1600 mobile — batch-cook scale-to-shopping shared persistence", () => {
  it("resolves through the @suppr/shared alias and inserts into shopping_items — never a JSON blob table", async () => {
    const { client, inserts, tablesQueried } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Batch Chilli",
      recipeServings: 4,
      portions: 8,
      ingredients: [{ name: "kidney beans", amount: "400", unit: "g" }],
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.addedCount).toBe(1);
    expect(inserts).toHaveLength(1);
    // 8 portions ÷ 4 servings = 2x multiplier → 400 * 2 = 800.
    expect(inserts[0]).toMatchObject({ name: "kidney beans", amount: "800", unit: "g" });
    expect(tablesQueried.every((t) => t === "shopping_items")).toBe(true);
  });

  it("excludes pantry staples and reports nothing-to-add rather than silently upserting an empty list", async () => {
    const { client, inserts } = fakeClient([]);

    const res = await scaleBatchCookToShoppingList({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Just Salt",
      recipeServings: 2,
      portions: 4,
      ingredients: [{ name: "salt", amount: "1", unit: "tsp" }],
      pantryStaples: ["salt"],
    });

    expect(res.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});
