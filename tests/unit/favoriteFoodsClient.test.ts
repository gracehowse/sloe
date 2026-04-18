/**
 * Supabase-facing CRUD tests for favourite foods (M11 audit, 2026-04-18).
 *
 * These tests were deferred from the original F1 batch alongside the
 * `favoriteKey` unit tests in `favoriteFoods.test.ts`. They exercise the
 * full public surface of `src/lib/nutrition/favoriteFoods.ts`:
 *   - listFavorites     — owner-scoped select, newest-first, empty-on-err
 *   - addFavorite       — happy path + unique-violation recovery
 *   - removeFavorite    — owner + id scoping
 *   - isFavorite        — true/false against the round(calories)/ilike(title) index
 *
 * Mocks a chainable supabase-js-compatible client (same pattern as
 * `savedMealsClient.test.ts`) so we can assert the exact filters /
 * payloads sent without hitting a real Supabase project. Live Supabase
 * integration tests against RLS remain in the qa-lead backlog.
 */
import { describe, expect, it } from "vitest";
import {
  addFavorite,
  isFavorite,
  listFavorites,
  removeFavorite,
} from "@/lib/nutrition/favoriteFoods";

type Call = {
  op: string;
  table: string;
  payload?: unknown;
  filters: Record<string, unknown>;
};

/**
 * Chainable supabase stub. `handlers[table]` receives the resolved op
 * key (e.g. `"insert:single"`, `"select:maybeSingle"`, `"delete"`,
 * `"update"`, or the bare `"select"` for non-terminal chains that are
 * awaited via `.then`) and returns a `{ data, error }` tuple. Methods
 * that don't appear here (`ilike`, `limit`) are tracked in `filters`.
 */
function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (
        op: string,
        ctx: { payload?: unknown; filters: Record<string, unknown>; table: string },
      ) => { data: unknown; error: unknown }
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
      delete() {
        return builder(table, "delete");
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      ilike(col: string, val: unknown) {
        filters[`ilike:${col}`] = val;
        return self;
      },
      limit(n: number) {
        filters[`limit`] = n;
        return self;
      },
      order(col: string, opts?: unknown) {
        filters[`order:${col}`] = opts ?? true;
        return self;
      },
      single: async () => {
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return (
          h?.(k, { payload, filters, table }) ?? {
            data: null,
            error: new Error(`no handler for ${table} ${k}`),
          }
        );
      },
      maybeSingle: async () => {
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h?.(k, { payload, filters, table }) ?? { data: null, error: null };
      },
      then(resolve: any) {
        calls.push({ op, table, payload, filters });
        const h = handlers[table];
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

// ─────────────────────────────── listFavorites ───────────────────────────────

describe("listFavorites", () => {
  it("returns [] when userId is empty (and does not touch supabase)", async () => {
    const sb = makeSupabase({});
    const rows = await listFavorites(sb as any, "");
    expect(rows).toEqual([]);
    expect(sb.calls).toHaveLength(0);
  });

  it("returns [] and swallows errors — favourites are non-critical UX", async () => {
    const sb = makeSupabase({
      user_favorite_foods: () => ({ data: null, error: new Error("permission denied") }),
    });
    const rows = await listFavorites(sb as any, "u1");
    expect(rows).toEqual([]);
  });

  it("maps DB rows to FavoriteFood objects and preserves supabase ordering", async () => {
    const rows = [
      {
        id: "f1",
        recipe_title: "Oatmeal",
        calories: 350,
        protein: 12,
        carbs: 60,
        fat: 6,
        fiber: 8,
        source: "USDA",
        created_at: "2026-04-17T08:00:00Z",
      },
      {
        id: "f2",
        recipe_title: "Chicken salad",
        calories: 420,
        protein: 35,
        carbs: 10,
        fat: 22,
        fiber: null,
        source: null,
        created_at: "2026-04-15T12:00:00Z",
      },
    ];
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_favorite_foods: (_op, ctx) => {
        filtersSeen = ctx.filters;
        return { data: rows, error: null };
      },
    });
    const out = await listFavorites(sb as any, "u1");
    // Owner-scoped + newest-first ordering.
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
    expect(filtersSeen?.["order:created_at"]).toEqual({ ascending: false });
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("f1");
    expect(out[0]!.recipeTitle).toBe("Oatmeal");
    expect(out[0]!.calories).toBe(350);
    expect(out[0]!.fiber).toBe(8);
    expect(out[0]!.source).toBe("USDA");
    // Second row has null fiber/source — those should be absent, not coerced to 0/"".
    expect(out[1]!.fiber).toBeUndefined();
    expect(out[1]!.source).toBeUndefined();
  });

  it("returns [] if data is not an array (defensive)", async () => {
    const sb = makeSupabase({
      user_favorite_foods: () => ({ data: { not: "an array" }, error: null }),
    });
    const rows = await listFavorites(sb as any, "u1");
    expect(rows).toEqual([]);
  });
});

// ─────────────────────────────── addFavorite ────────────────────────────────

describe("addFavorite", () => {
  it("rejects missing userId / empty title", async () => {
    const sb = makeSupabase({});
    await expect(
      addFavorite(sb as any, "", { recipeTitle: "A", calories: 100, protein: 0, carbs: 0, fat: 0 }),
    ).rejects.toThrow(/userId is required/);
    await expect(
      addFavorite(sb as any, "u1", { recipeTitle: "   ", calories: 100, protein: 0, carbs: 0, fat: 0 }),
    ).rejects.toThrow(/recipe title is required/);
  });

  it("inserts normalised payload (trimmed title, rounded cal, 1dp macros) and returns mapped row", async () => {
    const inserted = {
      id: "fav-1",
      recipe_title: "Oatmeal",
      calories: 350,
      protein: 12.3,
      carbs: 60.1,
      fat: 6.0,
      fiber: 8.4,
      source: "USDA",
      created_at: "2026-04-17T08:00:00Z",
    };
    let payloadSeen: any;
    const sb = makeSupabase({
      user_favorite_foods: (op, ctx) => {
        if (op === "insert:single") {
          payloadSeen = ctx.payload;
          return { data: inserted, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await addFavorite(sb as any, "u1", {
      recipeTitle: "  Oatmeal  ",
      calories: 350.4, // rounds to 350
      protein: 12.34, // rounds to 12.3
      carbs: 60.07, // rounds to 60.1
      fat: 6,
      fiberG: 8.444, // rounds to 8.4
      source: "USDA",
    });
    expect(payloadSeen).toMatchObject({
      user_id: "u1",
      recipe_title: "Oatmeal",
      calories: 350,
      protein: 12.3,
      carbs: 60.1,
      fat: 6,
      fiber: 8.4,
      source: "USDA",
    });
    expect(res.id).toBe("fav-1");
    expect(res.recipeTitle).toBe("Oatmeal");
    expect(res.calories).toBe(350);
  });

  it("treats unique-violation (23505) as success — fetches and returns the existing row", async () => {
    const existing = {
      id: "fav-existing",
      recipe_title: "Oatmeal",
      calories: 350,
      protein: 12,
      carbs: 60,
      fat: 6,
      fiber: null,
      source: null,
      created_at: "2026-04-15T08:00:00Z",
    };
    let fetchFiltersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_favorite_foods: (op, ctx) => {
        if (op === "insert:single") {
          return { data: null, error: { code: "23505", message: "duplicate key violates unique constraint" } };
        }
        if (op === "select:maybeSingle") {
          fetchFiltersSeen = ctx.filters;
          return { data: existing, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await addFavorite(sb as any, "u1", {
      recipeTitle: "Oatmeal",
      calories: 350,
      protein: 12,
      carbs: 60,
      fat: 6,
    });
    expect(res.id).toBe("fav-existing");
    // The recovery query must scope to owner + calories + ilike(title) so
    // it matches the DB unique index exactly.
    expect(fetchFiltersSeen?.["eq:user_id"]).toBe("u1");
    expect(fetchFiltersSeen?.["eq:calories"]).toBe(350);
    expect(fetchFiltersSeen?.["ilike:recipe_title"]).toBe("Oatmeal");
  });

  it("also recognises a duplicate-key error by message if code is absent", async () => {
    const existing = {
      id: "fav-existing-2",
      recipe_title: "A",
      calories: 100,
      protein: 0,
      carbs: 0,
      fat: 0,
      created_at: "2026-04-15T08:00:00Z",
    };
    const sb = makeSupabase({
      user_favorite_foods: (op) => {
        if (op === "insert:single") {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        if (op === "select:maybeSingle") return { data: existing, error: null };
        return { data: null, error: null };
      },
    });
    const res = await addFavorite(sb as any, "u1", {
      recipeTitle: "A",
      calories: 100,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(res.id).toBe("fav-existing-2");
  });

  it("propagates non-duplicate errors without attempting a recovery fetch", async () => {
    let fetchAttempted = false;
    const sb = makeSupabase({
      user_favorite_foods: (op) => {
        if (op === "insert:single") {
          return { data: null, error: { code: "42501", message: "permission denied" } };
        }
        if (op === "select:maybeSingle") {
          fetchAttempted = true;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await expect(
      addFavorite(sb as any, "u1", { recipeTitle: "A", calories: 100, protein: 0, carbs: 0, fat: 0 }),
    ).rejects.toMatchObject({ code: "42501" });
    expect(fetchAttempted).toBe(false);
  });
});

// ────────────────────────────── removeFavorite ──────────────────────────────

describe("removeFavorite", () => {
  it("rejects missing userId / favoriteId", async () => {
    const sb = makeSupabase({});
    await expect(removeFavorite(sb as any, "", "f1")).rejects.toThrow(/userId is required/);
    await expect(removeFavorite(sb as any, "u1", "")).rejects.toThrow(/favoriteId is required/);
  });

  it("deletes scoped to (user_id, id) — non-owners cannot slip past", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_favorite_foods: (op, ctx) => {
        if (op === "delete") {
          filtersSeen = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await removeFavorite(sb as any, "u1", "fav-to-kill");
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
    expect(filtersSeen?.["eq:id"]).toBe("fav-to-kill");
  });

  it("propagates the underlying error", async () => {
    const sb = makeSupabase({
      user_favorite_foods: () => ({ data: null, error: new Error("rls denied") }),
    });
    await expect(removeFavorite(sb as any, "u1", "fav-x")).rejects.toThrow(/rls denied/);
  });
});

// ─────────────────────────────── isFavorite ─────────────────────────────────

describe("isFavorite", () => {
  it("returns false when userId or title is empty (and skips supabase)", async () => {
    const sb = makeSupabase({});
    expect(await isFavorite(sb as any, "", "Oatmeal", 350)).toBe(false);
    expect(await isFavorite(sb as any, "u1", "", 350)).toBe(false);
    expect(sb.calls).toHaveLength(0);
  });

  it("returns true when a matching row exists (and scopes filters to match the unique index)", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_favorite_foods: (_op, ctx) => {
        filtersSeen = ctx.filters;
        return { data: { id: "fav-xxx" }, error: null };
      },
    });
    const flag = await isFavorite(sb as any, "u1", "  Oatmeal  ", 350.4);
    expect(flag).toBe(true);
    // Must match the DB index: round(calories), lower(title). We assert
    // the calories was rounded and the title trimmed for the ilike.
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
    expect(filtersSeen?.["eq:calories"]).toBe(350);
    expect(filtersSeen?.["ilike:recipe_title"]).toBe("Oatmeal");
  });

  it("returns false when no row exists", async () => {
    const sb = makeSupabase({
      user_favorite_foods: () => ({ data: null, error: null }),
    });
    expect(await isFavorite(sb as any, "u1", "Oatmeal", 350)).toBe(false);
  });

  it("returns false on any error (never throws — the UI uses this inline for star state)", async () => {
    const sb = makeSupabase({
      user_favorite_foods: () => ({ data: null, error: new Error("boom") }),
    });
    expect(await isFavorite(sb as any, "u1", "Oatmeal", 350)).toBe(false);
  });
});
