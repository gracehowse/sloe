import { describe, it, expect } from "vitest";
import { syncPlanEditToShoppingListClient } from "@/lib/planning/syncPlanEditToShoppingListClient";

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
 * Minimal fake Supabase client: a thenable read chain + insert/update/delete
 * spies. Mirrors the structural client the sync helper expects.
 */
function fakeClient(rows: Row[]) {
  const inserts: unknown[] = [];
  const updates: Array<{ patch: unknown; id: string }> = [];
  const deletes: string[] = [];
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
        delete() {
          return {
            in(_col: string, ids: string[]) {
              deletes.push(...ids);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, inserts, updates, deletes };
}

describe("syncPlanEditToShoppingListClient — persists only the delta", () => {
  it("ADD: inserts new rows and leaves checked existing rows untouched", async () => {
    const { client, inserts, updates, deletes } = fakeClient([
      {
        id: "row-rice",
        name: "rice",
        amount: "200",
        unit: "g",
        category: "Grains",
        checked: true,
        source: "Curry",
        checked_by: null,
      },
    ]);
    const res = await syncPlanEditToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      edit: {
        kind: "add",
        recipe: { title: "Bowl", ingredients: [{ name: "avocado", amount: "1", unit: "" }] },
      },
    });
    expect(res.ok).toBe(true);
    // rice untouched (no update), avocado inserted, nothing deleted.
    expect(updates).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as { name: string }).name).toBe("avocado");
  });

  it("REMOVE: deletes the emptied row, never a full wipe", async () => {
    const { client, inserts, updates, deletes } = fakeClient([
      {
        id: "row-chicken",
        name: "chicken",
        amount: "300",
        unit: "g",
        category: "Meat",
        checked: false,
        source: "Curry",
        checked_by: null,
      },
      {
        id: "row-manual",
        name: "batteries",
        amount: "1",
        unit: "",
        category: "Other",
        checked: false,
        source: "",
        checked_by: null,
      },
    ]);
    const res = await syncPlanEditToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      edit: {
        kind: "remove",
        recipe: { title: "Curry", ingredients: [{ name: "chicken", amount: "300", unit: "g" }] },
      },
    });
    expect(res.ok).toBe(true);
    // Only the emptied chicken row is deleted; the manual batteries row survives.
    expect(deletes).toEqual(["row-chicken"]);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("REMOVE-shared: decrements (UPDATE) rather than deletes when another recipe still sources it", async () => {
    const { client, updates, deletes } = fakeClient([
      {
        id: "row-rice",
        name: "rice",
        amount: "300",
        unit: "g",
        category: "Grains",
        checked: true,
        source: "Curry, Bowl",
        checked_by: null,
      },
    ]);
    const res = await syncPlanEditToShoppingListClient({
      client: client as never,
      scope: { kind: "solo", userId: "u1" },
      edit: {
        kind: "remove",
        recipe: { title: "Curry", ingredients: [{ name: "rice", amount: "200", unit: "g" }] },
      },
    });
    expect(res.ok).toBe(true);
    expect(deletes).toHaveLength(0); // still sourced by Bowl → kept
    expect(updates).toHaveLength(1);
    expect((updates[0].patch as { amount: string; source: string })).toEqual({
      amount: "100",
      source: "Bowl",
    });
  });

  it("surfaces a read error as { ok: false } without writing anything", async () => {
    const failing = {
      from() {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              is() {
                return this;
              },
              then(onfulfilled: (r: { data: null; error: { message: string } }) => unknown) {
                return Promise.resolve(onfulfilled({ data: null, error: { message: "boom" } }));
              },
            };
          },
        };
      },
    };
    const res = await syncPlanEditToShoppingListClient({
      client: failing as never,
      scope: { kind: "solo", userId: "u1" },
      edit: { kind: "add", recipe: { title: "X", ingredients: [{ name: "y", amount: "1", unit: "" }] } },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("boom");
  });
});
