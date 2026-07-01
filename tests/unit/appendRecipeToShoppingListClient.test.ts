import { describe, it, expect } from "vitest";
import { appendRecipeToShoppingListClient } from "@/lib/planning/appendRecipeToShoppingListClient";

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
 * Minimal fake Supabase client: a thenable read chain + insert/update spies.
 * Mirrors the structural `ShoppingClient` the helper expects.
 */
function fakeClient(rows: Row[]) {
  const inserts: unknown[] = [];
  const updates: Array<{ patch: unknown; id: string }> = [];
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
    from() {
      return {
        select() {
          return read;
        },
        insert(newRows: unknown[]) {
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
  return { client, inserts, updates };
}

describe("appendRecipeToShoppingListClient — persists only the delta", () => {
  it("inserts brand-new rows and leaves checked existing rows untouched", async () => {
    const { client, inserts, updates } = fakeClient([
      {
        id: "row-1",
        name: "rice",
        amount: "200",
        unit: "g",
        category: "Grains",
        checked: true,
        source: "Plan",
        checked_by: null,
      },
    ]);

    const res = await appendRecipeToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Curry",
      ingredients: [{ name: "chicken breast", amount: "300", unit: "g" }],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.addedCount).toBe(1);
    // The checked rice row did not change → no update issued for it.
    expect(updates).toHaveLength(0);
    // One insert for the new chicken row.
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as { name: string }).name.toLowerCase()).toContain("chicken");
  });

  it("UPDATEs an existing row when the recipe merges into it (sum) — preserving the row id", async () => {
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

    const res = await appendRecipeToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "Pilaf",
      ingredients: [{ name: "rice", amount: "150", unit: "g" }],
    });

    expect(res.ok).toBe(true);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe("row-1");
    expect((updates[0]?.patch as { amount: string }).amount).toBe("350");
  });

  it("returns an error result when the read fails (no partial writes)", async () => {
    const failingRead = {
      eq() {
        return failingRead;
      },
      is() {
        return failingRead;
      },
      then(onfulfilled: (res: { data: null; error: { message: string } }) => unknown) {
        return Promise.resolve(onfulfilled({ data: null, error: { message: "boom" } }));
      },
    };
    const client = {
      from() {
        return {
          select() {
            return failingRead;
          },
          insert() {
            return Promise.resolve({ error: null });
          },
          update() {
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    };

    const res = await appendRecipeToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      recipeTitle: "X",
      ingredients: [{ name: "rice", amount: "1", unit: "g" }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("boom");
  });
});
