/**
 * Personal recipe notes — Supabase-facing CRUD tests (Batch 3.8).
 *
 * Mocks a supabase-js-compatible query builder with enough surface to
 * exercise every public function in
 * `src/lib/nutrition/recipeNotesClient.ts`:
 *   - getUserRecipeNotes
 *   - upsertUserRecipeNotes     (create path + update path)
 *   - incrementCookCount        (create-on-missing + increment)
 *
 * Owner-scoping is asserted — every read / write must include an
 * `eq("user_id", userId)` filter so a mis-configured client cannot
 * touch another user's row.
 *
 * Live RLS tests against Supabase are deferred to qa-lead (needs a
 * seeded project) — same pattern as `savedMealsClient.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  getUserRecipeNotes,
  upsertUserRecipeNotes,
  incrementCookCount,
} from "@/lib/nutrition/recipeNotesClient";

type Call = { op: string; table: string; payload?: unknown; filters: Record<string, unknown> };

/**
 * Fake chainable supabase-js client — subset of `savedMealsClient.test.ts`.
 * Each `from(table)` returns a builder whose methods record their
 * invocation and can be seeded with a per-call response via `handlers`.
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
        // Terminal await — rarely used here (all public fns terminate
        // on single / maybeSingle) but available for safety.
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

// -- getUserRecipeNotes --

describe("getUserRecipeNotes", () => {
  it("rejects missing userId / recipeId", async () => {
    const sb = makeSupabase({});
    await expect(getUserRecipeNotes(sb as any, "", "r1")).rejects.toThrow(/userId is required/);
    await expect(getUserRecipeNotes(sb as any, "u1", "")).rejects.toThrow(/recipeId is required/);
  });

  it("returns null when no row exists", async () => {
    const sb = makeSupabase({
      user_recipe_notes: () => ({ data: null, error: null }),
    });
    const notes = await getUserRecipeNotes(sb as any, "u1", "r1");
    expect(notes).toBeNull();
  });

  it("scopes the read to (user_id, recipe_id)", async () => {
    let filters: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_recipe_notes: (_op, ctx) => {
        filters = ctx.filters;
        return { data: null, error: null };
      },
    });
    await getUserRecipeNotes(sb as any, "u1", "r1");
    expect(filters?.["eq:user_id"]).toBe("u1");
    expect(filters?.["eq:recipe_id"]).toBe("r1");
  });

  it("maps the DB row into the UserRecipeNotes shape", async () => {
    const row = {
      id: "n1",
      user_id: "u1",
      recipe_id: "r1",
      notes: "Less salt next time.",
      personal_rating: 4,
      cook_count: 3,
      last_cooked_at: "2026-04-16T18:00:00Z",
      created_at: "2026-04-10T08:00:00Z",
      updated_at: "2026-04-17T08:00:00Z",
    };
    const sb = makeSupabase({
      user_recipe_notes: () => ({ data: row, error: null }),
    });
    const notes = await getUserRecipeNotes(sb as any, "u1", "r1");
    expect(notes).toMatchObject({
      id: "n1",
      userId: "u1",
      recipeId: "r1",
      notes: "Less salt next time.",
      personalRating: 4,
      cookCount: 3,
      lastCookedAt: "2026-04-16T18:00:00Z",
    });
  });

  it("propagates read errors so the UI can surface a toast", async () => {
    const sb = makeSupabase({
      user_recipe_notes: () => ({ data: null, error: new Error("permission denied") }),
    });
    await expect(getUserRecipeNotes(sb as any, "u1", "r1")).rejects.toThrow(/permission denied/);
  });
});

// -- upsertUserRecipeNotes — create path --

describe("upsertUserRecipeNotes (create path)", () => {
  it("inserts a new row when none exists, scoped to userId", async () => {
    const insertedRow = {
      id: "n-new",
      user_id: "u1",
      recipe_id: "r1",
      notes: "Try less salt",
      personal_rating: 4,
      cook_count: 0,
      last_cooked_at: null,
      created_at: "2026-04-17T08:00:00Z",
      updated_at: "2026-04-17T08:00:00Z",
    };
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: insertedRow, error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await upsertUserRecipeNotes(sb as any, "u1", "r1", {
      notes: "Try less salt",
      personalRating: 4,
    });
    expect(out.id).toBe("n-new");
    expect(out.personalRating).toBe(4);
    expect(out.notes).toBe("Try less salt");
    expect(insertPayload).toMatchObject({
      user_id: "u1",
      recipe_id: "r1",
      notes: "Try less salt",
      personal_rating: 4,
    });
  });

  it("defaults notes to '' and personal_rating to null when not passed", async () => {
    const insertedRow = {
      id: "n-new2",
      user_id: "u1",
      recipe_id: "r1",
      notes: "",
      personal_rating: null,
      cook_count: 0,
      last_cooked_at: null,
      created_at: "2026-04-17T08:00:00Z",
      updated_at: "2026-04-17T08:00:00Z",
    };
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: insertedRow, error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertUserRecipeNotes(sb as any, "u1", "r1", {});
    expect(insertPayload.notes).toBe("");
    expect(insertPayload.personal_rating).toBeNull();
  });

  it("coerces out-of-range ratings to null so the DB CHECK never fires", async () => {
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: {
            id: "n-new3", user_id: "u1", recipe_id: "r1", notes: "",
            personal_rating: null, cook_count: 0, last_cooked_at: null,
            created_at: "x", updated_at: "x",
          }, error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { personalRating: 7 });
    expect(insertPayload.personal_rating).toBeNull();
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { personalRating: 0 });
    expect(insertPayload.personal_rating).toBeNull();
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { personalRating: -3 });
    expect(insertPayload.personal_rating).toBeNull();
  });
});

// -- upsertUserRecipeNotes — update path --

describe("upsertUserRecipeNotes (update path)", () => {
  it("updates the existing row and preserves cook_count untouched", async () => {
    const existing = {
      id: "n1", user_id: "u1", recipe_id: "r1",
      notes: "Old notes", personal_rating: 3,
      cook_count: 5, last_cooked_at: "2026-04-10T10:00:00Z",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-10T10:00:00Z",
    };
    let updatePayload: any = null;
    let updateFilters: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: existing, error: null };
        if (op === "update:single") {
          updatePayload = ctx.payload;
          updateFilters = ctx.filters;
          return { data: { ...existing, notes: "Less salt", personal_rating: 5 }, error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await upsertUserRecipeNotes(sb as any, "u1", "r1", {
      notes: "Less salt",
      personalRating: 5,
    });
    expect(out.notes).toBe("Less salt");
    expect(out.personalRating).toBe(5);
    // cook_count must NOT be part of the update payload — the rating
    // autosave should never zero out the cook counter.
    expect(updatePayload).not.toHaveProperty("cook_count");
    // Owner-scoped update.
    expect(updateFilters?.["eq:user_id"]).toBe("u1");
    expect(updateFilters?.["eq:id"]).toBe("n1");
  });

  it("only sends notes when notes is passed (rating untouched)", async () => {
    const existing = {
      id: "n1", user_id: "u1", recipe_id: "r1",
      notes: "Old notes", personal_rating: 3, cook_count: 0,
      last_cooked_at: null, created_at: "x", updated_at: "x",
    };
    let updatePayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: existing, error: null };
        if (op === "update:single") {
          updatePayload = ctx.payload;
          return { data: { ...existing, notes: "New" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { notes: "New" });
    expect(updatePayload).toHaveProperty("notes", "New");
    expect(updatePayload).not.toHaveProperty("personal_rating");
  });

  it("sends personal_rating=null when the user clears their rating", async () => {
    const existing = {
      id: "n1", user_id: "u1", recipe_id: "r1",
      notes: "", personal_rating: 4, cook_count: 0,
      last_cooked_at: null, created_at: "x", updated_at: "x",
    };
    let updatePayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: existing, error: null };
        if (op === "update:single") {
          updatePayload = ctx.payload;
          return { data: { ...existing, personal_rating: null }, error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { personalRating: null });
    expect(updatePayload.personal_rating).toBeNull();
  });

  it("clamps notes length to 10_000 chars so the DB CHECK never fires", async () => {
    const existing = {
      id: "n1", user_id: "u1", recipe_id: "r1",
      notes: "", personal_rating: null, cook_count: 0,
      last_cooked_at: null, created_at: "x", updated_at: "x",
    };
    let updatePayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: existing, error: null };
        if (op === "update:single") {
          updatePayload = ctx.payload;
          return { data: existing, error: null };
        }
        return { data: null, error: null };
      },
    });
    const huge = "a".repeat(12_000);
    await upsertUserRecipeNotes(sb as any, "u1", "r1", { notes: huge });
    expect(typeof updatePayload.notes).toBe("string");
    expect(updatePayload.notes.length).toBe(10_000);
  });
});

// -- incrementCookCount --

describe("incrementCookCount", () => {
  it("rejects missing userId / recipeId", async () => {
    const sb = makeSupabase({});
    await expect(incrementCookCount(sb as any, "", "r1")).rejects.toThrow(/userId is required/);
    await expect(incrementCookCount(sb as any, "u1", "")).rejects.toThrow(/recipeId is required/);
  });

  it("increments cook_count +1 and sets last_cooked_at on an existing row", async () => {
    const existing = {
      id: "n1", user_id: "u1", recipe_id: "r1",
      notes: "", personal_rating: null, cook_count: 3,
      last_cooked_at: "2026-04-10T00:00:00Z",
      created_at: "x", updated_at: "x",
    };
    let updatePayload: any = null;
    let updateFilters: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: existing, error: null };
        if (op === "update:single") {
          updatePayload = ctx.payload;
          updateFilters = ctx.filters;
          return { data: { ...existing, cook_count: 4, last_cooked_at: "2026-04-17T08:00:00Z" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await incrementCookCount(sb as any, "u1", "r1");
    expect(out.cookCount).toBe(4);
    expect(updatePayload.cook_count).toBe(4);
    expect(typeof updatePayload.last_cooked_at).toBe("string");
    // Owner-scoped.
    expect(updateFilters?.["eq:user_id"]).toBe("u1");
  });

  it("creates a new row with cook_count=1 when no row exists", async () => {
    const insertedRow = {
      id: "n-new", user_id: "u1", recipe_id: "r1",
      notes: "", personal_rating: null,
      cook_count: 1, last_cooked_at: "2026-04-17T08:00:00Z",
      created_at: "x", updated_at: "x",
    };
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_recipe_notes: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: insertedRow, error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await incrementCookCount(sb as any, "u1", "r1");
    expect(out.cookCount).toBe(1);
    expect(insertPayload.cook_count).toBe(1);
    expect(typeof insertPayload.last_cooked_at).toBe("string");
    expect(insertPayload.user_id).toBe("u1");
    expect(insertPayload.recipe_id).toBe("r1");
  });

  it("surfaces a read error and does not write", async () => {
    let writeCalled = false;
    const sb = makeSupabase({
      user_recipe_notes: (op) => {
        if (op === "select:maybeSingle") return { data: null, error: new Error("read denied") };
        if (op === "update:single" || op === "insert:single") {
          writeCalled = true;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await expect(incrementCookCount(sb as any, "u1", "r1")).rejects.toThrow(/read denied/);
    expect(writeCalled).toBe(false);
  });
});

/**
 * NOTE — Live RLS tests against a seeded Supabase project are deferred
 * (qa-lead backlog). This suite exercises the operation shape that the
 * web + mobile UIs depend on; RLS integration tests guard the rule
 * "owner only" at the DB level.
 */
