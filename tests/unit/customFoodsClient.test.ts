/**
 * Supabase-facing CRUD tests for custom foods (Batch 3.9).
 *
 * Mocks a supabase-js-compatible query builder with just enough surface
 * to exercise each public function in `src/lib/nutrition/customFoodsClient.ts`.
 * Live integration tests against a seeded Supabase project are deferred
 * to the qa-lead backlog (they need the RLS policies applied to a real
 * project).
 */
import { describe, expect, it } from "vitest";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "@/lib/nutrition/customFoodsClient";

type HandlerCtx = { payload?: unknown; filters: Record<string, unknown>; table: string };
type Handler = (
  op: string,
  ctx: HandlerCtx,
) => { data: unknown; error: null } | { data: null; error: unknown };

/**
 * Minimal chainable supabase mock. Methods are a subset of the real
 * client — select / insert / update / delete / eq / or / order / limit
 * / single.
 */
function makeSupabase(handlers: Partial<Record<string, Handler>>) {
  const calls: Array<{ op: string; table: string; payload?: unknown; filters: Record<string, unknown> }> = [];

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
      ilike(col: string, val: unknown) {
        filters[`ilike:${col}`] = val;
        return self;
      },
      or(filter: string) {
        filters["or"] = filter;
        return self;
      },
      order(col: string, opts?: unknown) {
        filters[`order:${col}`] = opts ?? true;
        return self;
      },
      limit(n: number) {
        filters["limit"] = n;
        return self;
      },
      single: async () => {
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters, table }) : { data: null, error: new Error(`no handler for ${table} ${k}`) };
      },
      maybeSingle: async () => {
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters, table }) : { data: null, error: null };
      },
      then(resolve: any) {
        calls.push({ op, table, payload, filters });
        const h = handlers[table];
        const res = h ? h(op, { payload, filters, table }) : { data: null, error: null };
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

const sampleRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "cf-1",
  user_id: "u1",
  name: "Granola",
  brand: null,
  base_grams: 100,
  calories: 450,
  protein: 10,
  carbs: 60,
  fat: 18,
  fiber: 6,
  servings: [{ label: "1 bowl", grams: 80 }],
  created_at: "2026-04-21T10:00:00Z",
  updated_at: "2026-04-21T10:00:00Z",
  ...overrides,
});

// ── listCustomFoods ─────────────────────────────────────────────────

describe("listCustomFoods", () => {
  it("returns [] when userId is empty", async () => {
    const sb = makeSupabase({});
    const rows = await listCustomFoods(sb as any, "");
    expect(rows).toEqual([]);
    expect(sb.calls).toHaveLength(0);
  });

  it("returns [] when the query errors (swallowed — panel falls back)", async () => {
    const sb = makeSupabase({
      user_custom_foods: () => ({ data: null, error: new Error("denied") }),
    });
    const rows = await listCustomFoods(sb as any, "u1");
    expect(rows).toEqual([]);
  });

  it("maps rows to CustomFood shape, ordered by updated_at desc", async () => {
    const sb = makeSupabase({
      user_custom_foods: (_op, ctx) => {
        expect(ctx.filters["eq:user_id"]).toBe("u1");
        expect(ctx.filters["order:updated_at"]).toMatchObject({ ascending: false });
        return { data: [sampleRow(), sampleRow({ id: "cf-2", name: "Hummus", fiber: null })], error: null };
      },
    });
    const rows = await listCustomFoods(sb as any, "u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe("Granola");
    expect(rows[0]!.fiber).toBe(6);
    expect(rows[0]!.servings).toEqual([{ label: "1 bowl", grams: 80 }]);
    // Fiber key absent when DB returns null.
    expect("fiber" in rows[1]!).toBe(false);
  });
});

// ── createCustomFood ───────────────────────────────────────────────

describe("createCustomFood", () => {
  it("throws when userId is missing", async () => {
    const sb = makeSupabase({});
    await expect(
      createCustomFood(sb as any, "", {
        name: "x",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).rejects.toThrow(/userId is required/);
  });

  it("throws when name is empty / whitespace", async () => {
    const sb = makeSupabase({});
    await expect(
      createCustomFood(sb as any, "u1", {
        name: "   ",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).rejects.toThrow(/name is required/);
  });

  it("defaults base_grams to 100 and normalises the name", async () => {
    let seenPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          seenPayload = ctx.payload;
          return { data: sampleRow({ name: "Homemade granola" }), error: null };
        }
        return { data: null, error: null };
      },
    });
    await createCustomFood(sb as any, "u1", {
      name: "  Homemade   granola  ",
      calories: 400.6,
      protein: 7.77,
      carbs: 60.11,
      fat: 12.49,
    });
    expect(seenPayload.name).toBe("Homemade granola");
    expect(seenPayload.user_id).toBe("u1");
    expect(seenPayload.base_grams).toBe(100);
    expect(seenPayload.calories).toBe(401); // rounded integer
    expect(seenPayload.protein).toBe(7.8);
    expect(seenPayload.carbs).toBe(60.1);
    expect(seenPayload.fat).toBe(12.5);
    expect(seenPayload.servings).toEqual([]);
  });

  it("on unique-violation appends ' (2)' ... ' (9)' then throws", async () => {
    const attempts: string[] = [];
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          attempts.push(String((ctx.payload as any).name));
          return { data: null, error: { code: "23505", message: "duplicate key value" } };
        }
        return { data: null, error: null };
      },
    });
    await expect(
      createCustomFood(sb as any, "u1", {
        name: "Granola",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).rejects.toMatchObject({ code: "23505" });
    // First attempt is the raw name, then " (2)" through " (9)" — 9 total.
    expect(attempts).toEqual([
      "Granola",
      "Granola (2)",
      "Granola (3)",
      "Granola (4)",
      "Granola (5)",
      "Granola (6)",
      "Granola (7)",
      "Granola (8)",
      "Granola (9)",
    ]);
  });

  it("returns the first non-collision attempt", async () => {
    let calls = 0;
    const sb = makeSupabase({
      user_custom_foods: (op, _ctx) => {
        if (op === "insert:single") {
          calls += 1;
          if (calls === 1 || calls === 2) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          return { data: sampleRow({ name: "Granola (3)" }), error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await createCustomFood(sb as any, "u1", {
      name: "Granola",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    // Third attempt succeeds — DB row name reflects the suffix the
    // client resolved to on the winning retry.
    expect(out.name).toBe("Granola (3)");
    expect(calls).toBe(3);
  });

  it("propagates non-unique-violation errors without retrying", async () => {
    let attempts = 0;
    const sb = makeSupabase({
      user_custom_foods: (op) => {
        if (op === "insert:single") {
          attempts += 1;
          return { data: null, error: { code: "42501", message: "permission denied" } };
        }
        return { data: null, error: null };
      },
    });
    await expect(
      createCustomFood(sb as any, "u1", {
        name: "Granola",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).rejects.toMatchObject({ code: "42501" });
    expect(attempts).toBe(1);
  });

  it("de-dupes servings and strips invalid rows before persisting", async () => {
    let seenPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          seenPayload = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await createCustomFood(sb as any, "u1", {
      name: "Granola",
      calories: 100,
      protein: 1,
      carbs: 20,
      fat: 2,
      servings: [
        { label: "1 Bowl", grams: 80 },
        { label: "1 BOWL", grams: 999 }, // dedupes against first
        { label: "", grams: 50 }, // empty — dropped
        { label: "1 scoop", grams: 0 }, // invalid grams — dropped
        { label: "1 tbsp", grams: 12 },
      ],
    });
    expect(seenPayload.servings).toEqual([
      { label: "1 Bowl", grams: 80 },
      { label: "1 tbsp", grams: 12 },
    ]);
  });

  // ── TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19) — round-trip
  // the five new optional fields (natural serving → servings[0],
  // servings_per_container, sugar / sat-fat / sodium, barcode).
  it("persists the natural serving as servings[0] and the new micros + barcode", async () => {
    let seenPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          seenPayload = ctx.payload;
          return {
            data: sampleRow({
              servings: [{ label: "1 slice", grams: 30 }],
              servings_per_container: 8,
              sugar_g: 4,
              saturated_fat_g: 0.5,
              sodium_mg: 120,
              barcode: "5012345678900",
            }),
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    const out = await createCustomFood(sb as any, "u1", {
      name: "Sliced bread",
      calories: 240,
      protein: 9,
      carbs: 45,
      fat: 3,
      servings: [{ label: "1 slice", grams: 30 }],
      servingsPerContainer: 8,
      sugarG: 4,
      saturatedFatG: 0.5,
      sodiumMg: 120,
      barcode: " 5012345678900 ", // trims
    });
    // Payload into the DB — snake_case, rounded per the UI precision rules.
    expect(seenPayload.servings).toEqual([{ label: "1 slice", grams: 30 }]);
    expect(seenPayload.servings_per_container).toBe(8);
    expect(seenPayload.sugar_g).toBe(4);
    expect(seenPayload.saturated_fat_g).toBe(0.5);
    expect(seenPayload.sodium_mg).toBe(120);
    expect(seenPayload.barcode).toBe("5012345678900");
    // Returned row projects back into the camelCase domain shape.
    expect(out.servings).toEqual([{ label: "1 slice", grams: 30 }]);
    expect(out.servingsPerContainer).toBe(8);
    expect(out.sugarG).toBe(4);
    expect(out.saturatedFatG).toBe(0.5);
    expect(out.sodiumMg).toBe(120);
    expect(out.barcode).toBe("5012345678900");
  });

  it("rounds sugar / sat fat to 1dp and sodium to an integer mg", async () => {
    let seenPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          seenPayload = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await createCustomFood(sb as any, "u1", {
      name: "Cheese",
      calories: 100,
      protein: 7,
      carbs: 1,
      fat: 8,
      sugarG: 1.23,
      saturatedFatG: 4.567,
      sodiumMg: 182.4,
    });
    expect(seenPayload.sugar_g).toBe(1.2);
    expect(seenPayload.saturated_fat_g).toBe(4.6);
    expect(seenPayload.sodium_mg).toBe(182);
  });

  it("rejects a malformed barcode loudly (never silently drops)", async () => {
    const sb = makeSupabase({});
    await expect(
      createCustomFood(sb as any, "u1", {
        name: "Cereal",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        barcode: "12345", // 5 digits — not an allowed GTIN length
      }),
    ).rejects.toThrow(/valid 8, 12, 13, or 14-digit barcode/);
  });

  it("omits servings_per_container when absent or non-positive", async () => {
    let seenPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "insert:single") {
          seenPayload = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await createCustomFood(sb as any, "u1", {
      name: "Muffin",
      calories: 100,
      protein: 2,
      carbs: 20,
      fat: 2,
      servingsPerContainer: 0, // ignored — not positive
    });
    expect("servings_per_container" in seenPayload).toBe(false);
  });
});

// ── updateCustomFood ────────────────────────────────────────────────

describe("updateCustomFood", () => {
  it("throws on missing userId / id", async () => {
    const sb = makeSupabase({});
    await expect(updateCustomFood(sb as any, "", "cf-1", { name: "x" })).rejects.toThrow(
      /userId is required/,
    );
    await expect(updateCustomFood(sb as any, "u1", "", { name: "x" })).rejects.toThrow(
      /id is required/,
    );
  });

  it("scopes the update to (id, user_id) so stale sessions cannot cross-update", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    let payloadSeen: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "update:single") {
          filtersSeen = ctx.filters;
          payloadSeen = ctx.payload;
          return { data: sampleRow({ id: "cf-1", name: "Granola v2" }), error: null };
        }
        return { data: null, error: null };
      },
    });
    await updateCustomFood(sb as any, "u1", "cf-1", { name: "Granola v2" });
    expect(filtersSeen?.["eq:id"]).toBe("cf-1");
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
    expect(payloadSeen.name).toBe("Granola v2");
    // updated_at is always bumped on patch.
    expect(typeof payloadSeen.updated_at).toBe("string");
  });

  it("clears brand / fiber when patch provides null", async () => {
    let payloadSeen: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "update:single") {
          payloadSeen = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await updateCustomFood(sb as any, "u1", "cf-1", { brand: null, fiber: null });
    expect(payloadSeen.brand).toBeNull();
    expect(payloadSeen.fiber).toBeNull();
  });

  it("rejects non-positive baseGrams", async () => {
    const sb = makeSupabase({});
    await expect(
      updateCustomFood(sb as any, "u1", "cf-1", { baseGrams: 0 }),
    ).rejects.toThrow(/baseGrams must be > 0/);
  });

  it("rejects an emptied name", async () => {
    const sb = makeSupabase({});
    await expect(
      updateCustomFood(sb as any, "u1", "cf-1", { name: "   " }),
    ).rejects.toThrow(/name cannot be empty/);
  });

  // ── TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19) — the five
  // new fields must round-trip through update with nullable semantics.
  it("patches the new micros + packaging + barcode fields", async () => {
    let payloadSeen: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "update:single") {
          payloadSeen = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await updateCustomFood(sb as any, "u1", "cf-1", {
      servingsPerContainer: 10,
      sugarG: 2.37,
      saturatedFatG: 1.2,
      sodiumMg: 140,
      barcode: "012345678905",
    });
    expect(payloadSeen.servings_per_container).toBe(10);
    expect(payloadSeen.sugar_g).toBe(2.4);
    expect(payloadSeen.saturated_fat_g).toBe(1.2);
    expect(payloadSeen.sodium_mg).toBe(140);
    expect(payloadSeen.barcode).toBe("012345678905");
  });

  it("clears micros + barcode + servings_per_container when patch provides null", async () => {
    let payloadSeen: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "update:single") {
          payloadSeen = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await updateCustomFood(sb as any, "u1", "cf-1", {
      servingsPerContainer: null,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: null,
      barcode: null,
    });
    expect(payloadSeen.servings_per_container).toBeNull();
    expect(payloadSeen.sugar_g).toBeNull();
    expect(payloadSeen.saturated_fat_g).toBeNull();
    expect(payloadSeen.sodium_mg).toBeNull();
    expect(payloadSeen.barcode).toBeNull();
  });

  it("rejects a non-positive servings_per_container on update", async () => {
    const sb = makeSupabase({});
    await expect(
      updateCustomFood(sb as any, "u1", "cf-1", { servingsPerContainer: 0 }),
    ).rejects.toThrow(/servingsPerContainer must be > 0 or null/);
  });

  it("rejects a malformed barcode on update (soft error, never silent)", async () => {
    const sb = makeSupabase({});
    await expect(
      updateCustomFood(sb as any, "u1", "cf-1", { barcode: "12345" }),
    ).rejects.toThrow(/valid 8, 12, 13, or 14-digit barcode/);
  });
});

// ── deleteCustomFood ────────────────────────────────────────────────

describe("deleteCustomFood", () => {
  it("throws on missing userId / id", async () => {
    const sb = makeSupabase({});
    await expect(deleteCustomFood(sb as any, "", "cf-1")).rejects.toThrow(/userId is required/);
    await expect(deleteCustomFood(sb as any, "u1", "")).rejects.toThrow(/id is required/);
  });

  it("scopes the delete to (id, user_id)", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "delete") {
          filtersSeen = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await deleteCustomFood(sb as any, "u1", "cf-1");
    expect(filtersSeen?.["eq:id"]).toBe("cf-1");
    expect(filtersSeen?.["eq:user_id"]).toBe("u1");
  });

  it("surfaces the underlying error", async () => {
    const sb = makeSupabase({
      user_custom_foods: () => ({ data: null, error: new Error("denied") }),
    });
    await expect(deleteCustomFood(sb as any, "u1", "cf-1")).rejects.toThrow(/denied/);
  });
});

// ── searchCustomFoods ───────────────────────────────────────────────

describe("searchCustomFoods", () => {
  it("returns [] for empty / whitespace-only query", async () => {
    const sb = makeSupabase({});
    expect(await searchCustomFoods(sb as any, "u1", "")).toEqual([]);
    expect(await searchCustomFoods(sb as any, "u1", "   ")).toEqual([]);
    expect(sb.calls).toHaveLength(0);
  });

  it("returns [] when userId is missing", async () => {
    const sb = makeSupabase({});
    expect(await searchCustomFoods(sb as any, "", "granola")).toEqual([]);
  });

  it("builds an ilike filter across both name and brand", async () => {
    let orSeen: unknown;
    const sb = makeSupabase({
      user_custom_foods: (_op, ctx) => {
        orSeen = ctx.filters["or"];
        return { data: [sampleRow()], error: null };
      },
    });
    const rows = await searchCustomFoods(sb as any, "u1", "granola");
    expect(rows).toHaveLength(1);
    expect(typeof orSeen).toBe("string");
    // Must cover both fields so brand-typed queries surface custom foods.
    expect(String(orSeen)).toContain("name.ilike.%granola%");
    expect(String(orSeen)).toContain("brand.ilike.%granola%");
  });

  it("sanitises characters that would confuse the PostgREST or-filter", async () => {
    let orSeen: unknown;
    const sb = makeSupabase({
      user_custom_foods: (_op, ctx) => {
        orSeen = ctx.filters["or"];
        return { data: [], error: null };
      },
    });
    await searchCustomFoods(sb as any, "u1", "bread, rolls (fresh)");
    // The filter uses `,` between fields by design (PostgREST syntax),
    // but commas / parens inside the query pattern would be treated as
    // filter boundaries. Assert on the ilike patterns only.
    const s = String(orSeen);
    const patternMatches = s.match(/ilike\.%([^%]+)%/g) ?? [];
    for (const m of patternMatches) {
      expect(m).not.toContain(",");
      expect(m).not.toContain("(");
      expect(m).not.toContain(")");
    }
    expect(s).toContain("bread rolls fresh");
  });

  it("returns [] when supabase errors (search is non-critical UX)", async () => {
    const sb = makeSupabase({
      user_custom_foods: () => ({ data: null, error: new Error("oops") }),
    });
    expect(await searchCustomFoods(sb as any, "u1", "granola")).toEqual([]);
  });
});

// ── upsertCustomFoodFromPhotoCorrection (round 4 audit, 2026-04-30) ──

import { upsertCustomFoodFromPhotoCorrection } from "@/lib/nutrition/customFoodsClient";

describe("upsertCustomFoodFromPhotoCorrection", () => {
  /**
   * Tests below mock the helper's internal read+write loop:
   *  - Initial `select(...).eq.ilike(name)` to discover an existing
   *    row (used to decide insert vs update vs skip-manual).
   *  - Branched `insert/update` finalising the row.
   *
   * The handler tracks whether a `select` has been seen (so the
   * second call returns the post-write row shape if needed).
   */

  it("throws when userId is missing", async () => {
    const sb = makeSupabase({});
    await expect(
      upsertCustomFoodFromPhotoCorrection(sb as any, "", "Salmon", {
        calories: 200,
        protein: 25,
        carbs: 0,
        fat: 12,
      }),
    ).rejects.toThrow(/userId is required/);
  });

  it("throws when name is empty / whitespace", async () => {
    const sb = makeSupabase({});
    await expect(
      upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "  ", {
        calories: 200,
        protein: 25,
        carbs: 0,
        fat: 12,
      }),
    ).rejects.toThrow(/name is required/);
  });

  it("inserts a new row with source=photo_correction when no row exists", async () => {
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "select") {
          // Helper reads via ilike(name) to peek for existing.
          return { data: [], error: null };
        }
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return {
            data: sampleRow({
              source: "photo_correction",
              calories: insertPayload.calories,
              protein: insertPayload.protein,
              carbs: insertPayload.carbs,
              fat: insertPayload.fat,
            }),
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    const out = await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Salmon", {
      calories: 250,
      protein: 30,
      carbs: 0,
      fat: 14,
    });
    expect(out?.source).toBe("photo_correction");
    expect(insertPayload.user_id).toBe("u1");
    expect(insertPayload.name).toBe("Salmon");
    expect(insertPayload.source).toBe("photo_correction");
    expect(insertPayload.base_grams).toBe(100);
    // Macros stored at full precision (kcal integer; grams 1dp).
    expect(insertPayload.calories).toBe(250);
    expect(insertPayload.protein).toBe(30);
  });

  it("returns null when a manual row blocks the overwrite", async () => {
    let writeCalls = 0;
    const sb = makeSupabase({
      user_custom_foods: (op) => {
        if (op === "select") {
          return {
            data: [{ id: "cf-manual-1", source: "manual" }],
            error: null,
          };
        }
        if (op === "insert:single" || op === "update:single") {
          writeCalls += 1;
        }
        return { data: null, error: null };
      },
    });
    const out = await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Granola", {
      calories: 300,
      protein: 5,
      carbs: 50,
      fat: 8,
    });
    expect(out).toBeNull();
    expect(writeCalls).toBe(0);
  });

  it("updates an existing photo_correction row in place", async () => {
    let updatePayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "select") {
          return {
            data: [{ id: "cf-photo-1", source: "photo_correction" }],
            error: null,
          };
        }
        if (op === "update:single") {
          updatePayload = ctx.payload;
          return { data: sampleRow({ source: "photo_correction", calories: 280 }), error: null };
        }
        return { data: null, error: null };
      },
    });
    const out = await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Salmon", {
      calories: 280,
      protein: 33,
      carbs: 0,
      fat: 15,
    });
    expect(out?.source).toBe("photo_correction");
    expect(updatePayload.calories).toBe(280);
    expect(updatePayload.source).toBe("photo_correction");
    // updated_at MUST be refreshed so the bank's most-recently-touched
    // ordering surfaces the freshly-corrected row first in search.
    expect(updatePayload.updated_at).toBeDefined();
  });

  it("normalises the name (trim + collapse internal whitespace)", async () => {
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "select") return { data: [], error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: sampleRow({ name: "Salmon fillet" }), error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "  Salmon   fillet  ", {
      calories: 220,
      protein: 28,
      carbs: 0,
      fat: 11,
    });
    expect(insertPayload.name).toBe("Salmon fillet");
  });

  it("clamps negative macros to 0 (no negative nutrition values)", async () => {
    let insertPayload: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "select") return { data: [], error: null };
        if (op === "insert:single") {
          insertPayload = ctx.payload;
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Salmon", {
      calories: -100,
      protein: -5,
      carbs: 0,
      fat: 12,
    });
    expect(insertPayload.calories).toBe(0);
    expect(insertPayload.protein).toBe(0);
  });

  it("only stores fiber when the input carries a finite fiber value", async () => {
    let withFiber: any = null;
    let withoutFiber: any = null;
    const sb = makeSupabase({
      user_custom_foods: (op, ctx) => {
        if (op === "select") return { data: [], error: null };
        if (op === "insert:single") {
          if ("fiber" in (ctx.payload as Record<string, unknown>)) {
            withFiber = ctx.payload;
          } else {
            withoutFiber = ctx.payload;
          }
          return { data: sampleRow(), error: null };
        }
        return { data: null, error: null };
      },
    });
    await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Lentils", {
      calories: 230,
      protein: 18,
      carbs: 40,
      fat: 1,
      fiber: 8,
    });
    await upsertCustomFoodFromPhotoCorrection(sb as any, "u1", "Bread", {
      calories: 240,
      protein: 9,
      carbs: 45,
      fat: 3,
    });
    expect(withFiber?.fiber).toBe(8);
    expect(withoutFiber?.fiber).toBeUndefined();
  });
});

/**
 * NOTE — Live Supabase integration tests are deferred. They'd exercise
 * the RLS policies added in `20260421150000_user_custom_foods.sql`
 * against a seeded project (owner can CRUD, non-owner cannot). Tracked
 * on the qa-lead backlog.
 */
