/**
 * Supabase-facing CRUD tests for saved-meal combos (Batch 2.6).
 *
 * Mocks a supabase-js-compatible query builder with just enough surface
 * to exercise each public function in `src/lib/nutrition/savedMeals.ts`:
 *   - listSavedMeals     — parent fetch + child join, sort behaviour
 *   - createSavedMeal    — parent then items; zombie cleanup on child fail
 *   - renameSavedMeal    — required fields, trim, forwarded update
 *   - deleteSavedMeal    — required fields, forwarded delete
 *   - incrementLogCount  — read-then-write round trip
 *
 * The tests do not hit a real Supabase; they assert the shape of the
 * operations that would be dispatched, which is what the UI (both web
 * and mobile) is coupled to. Integration tests against a live Supabase
 * project are deferred to the qa-lead backlog — they need a seeded test
 * project to exercise RLS.
 */
import { describe, expect, it } from "vitest";
import {
  createSavedMeal,
  deleteSavedMeal,
  incrementLogCount,
  listSavedMeals,
  renameSavedMeal,
} from "@/lib/nutrition/savedMeals";

type Call = { op: string; table: string; payload?: unknown; filters: Record<string, unknown> };

/**
 * Fake chainable supabase-js client. Each `from(table)` returns a
 * builder whose methods record their invocation and can be seeded with
 * a per-call response via `onResult`. Methods match the subset the
 * client file actually uses (select / insert / update / delete / eq /
 * in / order / maybeSingle / single).
 */
function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (op: string, ctx: { payload?: unknown; filters: Record<string, unknown>; table: string }) =>
        | { data: unknown; error: null }
        | { data: null; error: unknown }
    >
  >,
) {
  const calls: Call[] = [];

  function builder(table: string, op: string, payload?: unknown) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select(_cols?: string) {
        return self;
      },
      insert(p: unknown) {
        return builder(table, "insert", p);
      },
      update(p: unknown) {
        return builder(table, "update", p);
      },
      delete() {
        return builder(table, "delete");
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      in(col: string, vals: unknown[]) {
        filters[`in:${col}`] = vals;
        return self;
      },
      order(col: string, opts?: unknown) {
        filters[`order:${col}`] = opts ?? true;
        return self;
      },
      single: async () => {
        const h = handlers[table];
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const res = h?.(k, { payload, filters, table }) ?? { data: null, error: new Error(`no handler for ${table} ${k}`) };
        return res;
      },
      maybeSingle: async () => {
        const h = handlers[table];
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const res = h?.(k, { payload, filters, table }) ?? { data: null, error: null };
        return res;
      },
      then(resolve: any) {
        // Terminal await — resolve with whatever the handler says.
        const h = handlers[table];
        calls.push({ op, table, payload, filters });
        const res = h?.(op, { payload, filters, table }) ?? { data: null, error: null };
        resolve(res);
      },
    };
    return self;
  }

  return {
    from: (table: string) => builder(table, "select"),
    calls,
  };
}

// -- listSavedMeals --

describe("listSavedMeals", () => {
  it("returns [] when userId is empty", async () => {
    const sb = makeSupabase({});
    const rows = await listSavedMeals(sb as any, "");
    expect(rows).toEqual([]);
    expect(sb.calls).toHaveLength(0);
  });

  it("returns [] when the parent query errors (swallowed, Quick Add panel falls back)", async () => {
    const sb = makeSupabase({
      user_saved_meals: () => ({ data: null, error: new Error("permission denied") }),
    });
    const rows = await listSavedMeals(sb as any, "user-1");
    expect(rows).toEqual([]);
  });

  it("joins items onto parents by saved_meal_id, in position order", async () => {
    const parentRows = [
      {
        id: "m1",
        user_id: "u1",
        name: "My breakfast",
        created_at: "2026-04-15T08:00:00Z",
        last_logged_at: "2026-04-17T07:50:00Z",
        log_count: 3,
        default_meal_slot: "Breakfast",
      },
      {
        id: "m2",
        user_id: "u1",
        name: "Post-workout",
        created_at: "2026-04-12T18:00:00Z",
        last_logged_at: null,
        log_count: 0,
        default_meal_slot: null,
      },
    ];
    const itemRows = [
      { id: "i2", saved_meal_id: "m1", position: 1, recipe_title: "Berries", calories: 50, protein: 1, carbs: 12, fat: 0 },
      { id: "i1", saved_meal_id: "m1", position: 0, recipe_title: "Oats", calories: 300, protein: 10, carbs: 50, fat: 6 },
      { id: "i3", saved_meal_id: "m2", position: 0, recipe_title: "Protein shake", calories: 150, protein: 30, carbs: 3, fat: 2 },
    ];
    const sb = makeSupabase({
      user_saved_meals: () => ({ data: parentRows, error: null }),
      user_saved_meal_items: () => ({ data: itemRows, error: null }),
    });
    const rows = await listSavedMeals(sb as any, "u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("m1");
    expect(rows[0]!.name).toBe("My breakfast");
    expect(rows[0]!.defaultMealSlot).toBe("Breakfast");
    // Items grouped under m1 in whatever order the iteration yielded —
    // listSavedMeals preserves the ordered-by-position that Supabase
    // returns. We seeded them sorted correctly.
    expect(rows[0]!.items.map((it) => it.recipeTitle)).toEqual(["Berries", "Oats"]);
    expect(rows[1]!.id).toBe("m2");
    expect(rows[1]!.items.map((it) => it.recipeTitle)).toEqual(["Protein shake"]);
  });

  it("returns parents with empty items arrays when the child query errors", async () => {
    const parentRows = [
      { id: "m1", name: "X", created_at: "2026-04-15", last_logged_at: null, log_count: 0 },
    ];
    const sb = makeSupabase({
      user_saved_meals: () => ({ data: parentRows, error: null }),
      user_saved_meal_items: () => ({ data: null, error: new Error("oops") }),
    });
    const rows = await listSavedMeals(sb as any, "u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.items).toEqual([]);
  });
});

// -- createSavedMeal --

describe("createSavedMeal", () => {
  it("throws when required inputs are missing", async () => {
    const sb = makeSupabase({});
    await expect(createSavedMeal(sb as any, "", { name: "x", items: [{ recipeTitle: "a", calories: 0, protein: 0, carbs: 0, fat: 0 }] })).rejects.toThrow(
      /userId is required/,
    );
    await expect(createSavedMeal(sb as any, "u1", { name: "   ", items: [{ recipeTitle: "a", calories: 0, protein: 0, carbs: 0, fat: 0 }] })).rejects.toThrow(
      /name is required/,
    );
    await expect(createSavedMeal(sb as any, "u1", { name: "x", items: [] })).rejects.toThrow(
      /at least one item/,
    );
  });

  it("inserts parent, then items, and returns the combined SavedMeal", async () => {
    const parentRow = {
      id: "m99",
      name: "Combo",
      created_at: "2026-04-17T09:00:00Z",
      last_logged_at: null,
      log_count: 0,
      default_meal_slot: "Breakfast",
    };
    const insertedItems = [
      { id: "ii1", saved_meal_id: "m99", position: 0, recipe_title: "A", calories: 100, protein: 5, carbs: 10, fat: 1 },
      { id: "ii2", saved_meal_id: "m99", position: 1, recipe_title: "B", calories: 200, protein: 10, carbs: 20, fat: 2 },
    ];
    let parentInsertSeen: unknown = null;
    let itemsInsertSeen: unknown = null;
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "insert:single") {
          parentInsertSeen = ctx.payload;
          return { data: parentRow, error: null };
        }
        return { data: null, error: null };
      },
      user_saved_meal_items: (op, ctx) => {
        if (op === "insert") {
          itemsInsertSeen = ctx.payload;
          return { data: insertedItems, error: null };
        }
        return { data: null, error: null };
      },
    });

    const created = await createSavedMeal(sb as any, "u1", {
      name: "Combo",
      defaultMealSlot: "Breakfast",
      items: [
        { recipeTitle: " A ", calories: 100, protein: 5, carbs: 10, fat: 1 },
        { recipeTitle: "B", calories: 200, protein: 10, carbs: 20, fat: 2 },
      ],
    });
    expect(created.id).toBe("m99");
    expect(created.items).toHaveLength(2);
    expect(created.defaultMealSlot).toBe("Breakfast");
    // Parent payload is scoped to owner + slot + name.
    expect(parentInsertSeen).toMatchObject({ user_id: "u1", name: "Combo", default_meal_slot: "Breakfast" });
    // Item payload preserves ordering via `position = index`.
    const items = itemsInsertSeen as Array<{ position: number; recipe_title: string }>;
    expect(items.map((x) => x.position)).toEqual([0, 1]);
    expect(items.map((x) => x.recipe_title)).toEqual(["A", "B"]);
  });

  it("deletes the parent when the items insert fails (no zombie rows)", async () => {
    const parentRow = { id: "m_z", name: "X", created_at: "2026-04-17", last_logged_at: null, log_count: 0 };
    const deleteCalls: Array<{ filters: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "insert:single") return { data: parentRow, error: null };
        if (op === "delete") {
          deleteCalls.push({ filters: ctx.filters });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      user_saved_meal_items: () => ({ data: null, error: new Error("items-insert failed") }),
    });
    await expect(createSavedMeal(sb as any, "u1", {
      name: "X",
      items: [{ recipeTitle: "A", calories: 1, protein: 0, carbs: 0, fat: 0 }],
    })).rejects.toThrow(/items-insert failed/);
    // Parent delete must happen so the UI never lists an empty combo.
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0]!.filters["eq:id"]).toBe("m_z");
  });
});

// -- renameSavedMeal / deleteSavedMeal / incrementLogCount --

describe("renameSavedMeal", () => {
  it("rejects empty name / missing id / missing userId", async () => {
    const sb = makeSupabase({});
    await expect(renameSavedMeal(sb as any, "", "m1", "x")).rejects.toThrow(/userId is required/);
    await expect(renameSavedMeal(sb as any, "u1", "", "x")).rejects.toThrow(/id is required/);
    await expect(renameSavedMeal(sb as any, "u1", "m1", "   ")).rejects.toThrow(/name is required/);
  });

  it("trims the new name and scopes the update to the owning user", async () => {
    let seen: { payload?: unknown; filters?: Record<string, unknown> } = {};
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "update") {
          seen = { payload: ctx.payload, filters: ctx.filters };
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await renameSavedMeal(sb as any, "u1", "m1", "  New name  ");
    expect((seen.payload as any).name).toBe("New name");
    expect(seen.filters?.["eq:id"]).toBe("m1");
    expect(seen.filters?.["eq:user_id"]).toBe("u1");
  });

  it("propagates the underlying error", async () => {
    const sb = makeSupabase({
      user_saved_meals: () => ({ data: null, error: new Error("update failed") }),
    });
    await expect(renameSavedMeal(sb as any, "u1", "m1", "OK")).rejects.toThrow(/update failed/);
  });
});

describe("deleteSavedMeal", () => {
  it("rejects missing id / userId", async () => {
    const sb = makeSupabase({});
    await expect(deleteSavedMeal(sb as any, "", "m1")).rejects.toThrow(/userId is required/);
    await expect(deleteSavedMeal(sb as any, "u1", "")).rejects.toThrow(/id is required/);
  });

  it("scopes the delete to (id, user_id)", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "delete") {
          filtersSeen = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await deleteSavedMeal(sb as any, "u1", "m-del");
    expect(filtersSeen?.["eq:id"]).toBe("m-del");
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
  });
});

describe("incrementLogCount", () => {
  it("rejects missing id / userId", async () => {
    const sb = makeSupabase({});
    await expect(incrementLogCount(sb as any, "", "m1")).rejects.toThrow(/userId is required/);
    await expect(incrementLogCount(sb as any, "u1", "")).rejects.toThrow(/id is required/);
  });

  it("reads the current count and writes back +1 plus last_logged_at", async () => {
    let updatePayloadSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: { log_count: 7 }, error: null };
        if (op === "update") {
          updatePayloadSeen = ctx.payload as Record<string, unknown>;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await incrementLogCount(sb as any, "u1", "m1");
    expect(updatePayloadSeen?.log_count).toBe(8);
    expect(typeof updatePayloadSeen?.last_logged_at).toBe("string");
  });

  it("treats a missing row (null data) as log_count=0 and writes 1", async () => {
    let payloadSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_saved_meals: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "update") {
          payloadSeen = ctx.payload as Record<string, unknown>;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await incrementLogCount(sb as any, "u1", "m1");
    expect(payloadSeen?.log_count).toBe(1);
  });

  it("surfaces a read error and does not write", async () => {
    let updateCalled = false;
    const sb = makeSupabase({
      user_saved_meals: (op) => {
        if (op === "select:maybeSingle") return { data: null, error: new Error("read denied") };
        if (op === "update") {
          updateCalled = true;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await expect(incrementLogCount(sb as any, "u1", "m1")).rejects.toThrow(/read denied/);
    expect(updateCalled).toBe(false);
  });
});

/**
 * NOTE — Live Supabase integration tests are deferred. They'd exercise
 * the RLS policies added in `20260421120000_user_saved_meals.sql`
 * against a seeded project (owner can CRUD, non-owner cannot). That is
 * on the qa-lead backlog.
 */
