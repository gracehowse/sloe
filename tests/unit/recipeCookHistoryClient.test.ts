/**
 * recipe_cook_history client — Supabase-facing CRUD tests (Paprika
 * parity, 2026-04-30).
 *
 * Mirrors the test posture of `recipeNotesClient.test.ts`: a fake
 * chainable supabase-js builder records every call so the assertions
 * can verify owner-scoping (`eq("user_id", userId)`), recipe scoping
 * (`eq("recipe_id", recipeId)`), and the column normalisations the
 * client performs before the row hits Postgres (note clamp, rating
 * 1..5, scale 0..99, duration non-negative).
 *
 * Live RLS tests are deferred to qa-lead — same deferral pattern as
 * the rest of the supabase-client suite.
 */
import { describe, expect, it } from "vitest";

import {
  COOK_HISTORY_NOTE_MAX_LEN,
  clampCookHistoryDuration,
  clampCookHistoryNote,
  clampCookHistoryRating,
  clampCookHistoryScale,
  formatCookHistoryPreview,
  insertCookHistory,
  listRecentCookHistory,
  type CookHistoryRow,
} from "@/lib/nutrition/recipeCookHistoryClient";

const RECIPE_UUID = "11111111-1111-1111-1111-111111111111";
const USER_UUID = "22222222-2222-2222-2222-222222222222";

type Call = {
  op: string;
  table: string;
  payload?: unknown;
  filters: Record<string, unknown>;
  order?: { column: string; ascending: boolean };
  limit?: number;
};

function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (
        op: string,
        ctx: { payload?: unknown; filters: Record<string, unknown>; table: string },
      ) =>
        | { data: unknown; error: null }
        | { data: null; error: unknown }
    >
  >,
) {
  const calls: Call[] = [];

  function builder(table: string, op: string, payload?: unknown) {
    const filters: Record<string, unknown> = {};
    let order: Call["order"];
    let limit: number | undefined;

    const self: any = {
      select(_cols?: string) {
        return self;
      },
      insert(p: unknown) {
        return builder(table, "insert", p);
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        order = { column, ascending: Boolean(opts?.ascending) };
        return self;
      },
      limit(n: number) {
        limit = n;
        return self;
      },
      single: async () => {
        const h = handlers[table];
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters, order, limit });
        const res = h?.(k, { payload, filters, table }) ?? {
          data: null,
          error: new Error(`no handler for ${table} ${k}`),
        };
        return res;
      },
      then(resolve: any, reject?: any) {
        // List queries terminate on the awaited builder itself.
        const h = handlers[table];
        calls.push({ op, table, payload, filters, order, limit });
        const res = h?.(op, { payload, filters, table }) ?? {
          data: null,
          error: null,
        };
        try {
          resolve(res);
        } catch (err) {
          if (reject) reject(err);
          else throw err;
        }
      },
    };
    return self;
  }

  return {
    from: (table: string) => builder(table, "select"),
    calls,
  };
}

// ─── Pure clamp helpers ───────────────────────────────────────────

describe("clampCookHistoryNote", () => {
  it("returns null for missing / empty / whitespace input", () => {
    expect(clampCookHistoryNote(null)).toBeNull();
    expect(clampCookHistoryNote(undefined)).toBeNull();
    expect(clampCookHistoryNote("")).toBeNull();
    expect(clampCookHistoryNote("   ")).toBeNull();
    expect(clampCookHistoryNote(123 as unknown)).toBeNull();
  });
  it("trims surrounding whitespace", () => {
    expect(clampCookHistoryNote("  added garlic  ")).toBe("added garlic");
  });
  it("slices to 500 chars (DB CHECK boundary)", () => {
    const input = "x".repeat(COOK_HISTORY_NOTE_MAX_LEN + 50);
    const out = clampCookHistoryNote(input);
    expect(out?.length).toBe(COOK_HISTORY_NOTE_MAX_LEN);
  });
  it("preserves a 500-char string verbatim", () => {
    const input = "y".repeat(COOK_HISTORY_NOTE_MAX_LEN);
    expect(clampCookHistoryNote(input)).toBe(input);
  });
});

describe("clampCookHistoryRating", () => {
  it("returns null for null / undefined / non-numeric / out-of-range", () => {
    expect(clampCookHistoryRating(null)).toBeNull();
    expect(clampCookHistoryRating(undefined)).toBeNull();
    expect(clampCookHistoryRating("oops")).toBeNull();
    expect(clampCookHistoryRating(0)).toBeNull();
    expect(clampCookHistoryRating(6)).toBeNull();
    expect(clampCookHistoryRating(Number.NaN)).toBeNull();
  });
  it("rounds 1..5 floats to integers", () => {
    expect(clampCookHistoryRating(3.4)).toBe(3);
    expect(clampCookHistoryRating(4.6)).toBe(5);
  });
  it("preserves valid integers", () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(clampCookHistoryRating(r)).toBe(r);
    }
  });
});

describe("clampCookHistoryScale", () => {
  it("returns null for null / non-finite / out-of-range", () => {
    expect(clampCookHistoryScale(null)).toBeNull();
    expect(clampCookHistoryScale(0)).toBeNull();
    expect(clampCookHistoryScale(-1)).toBeNull();
    expect(clampCookHistoryScale(100)).toBeNull();
    expect(clampCookHistoryScale(Number.NaN)).toBeNull();
  });
  it("rounds to 2dp", () => {
    expect(clampCookHistoryScale(0.5)).toBe(0.5);
    expect(clampCookHistoryScale(1.234)).toBe(1.23);
  });
});

describe("clampCookHistoryDuration", () => {
  it("returns null for null / non-finite / negative", () => {
    expect(clampCookHistoryDuration(null)).toBeNull();
    expect(clampCookHistoryDuration(-1)).toBeNull();
    expect(clampCookHistoryDuration(Number.NaN)).toBeNull();
  });
  it("rounds to whole seconds", () => {
    expect(clampCookHistoryDuration(620)).toBe(620);
    expect(clampCookHistoryDuration(620.7)).toBe(621);
    expect(clampCookHistoryDuration(0)).toBe(0);
  });
});

// ─── insertCookHistory ────────────────────────────────────────────

describe("insertCookHistory", () => {
  it("rejects missing userId / recipeId", async () => {
    const sb = makeSupabase({});
    await expect(
      insertCookHistory(sb as any, "", { recipeId: RECIPE_UUID }),
    ).rejects.toThrow(/userId is required/);
    await expect(
      insertCookHistory(sb as any, USER_UUID, { recipeId: "" }),
    ).rejects.toThrow(/recipeId is required/);
  });

  it("rejects non-uuid recipeId with a human message (FK is uuid-only)", async () => {
    const sb = makeSupabase({});
    await expect(
      insertCookHistory(sb as any, USER_UUID, { recipeId: "not-a-uuid" }),
    ).rejects.toThrow(/Save this recipe to your library first/);
  });

  it("writes user_id, recipe_id, and only the provided optional fields", async () => {
    const sb = makeSupabase({
      recipe_cook_history: (op, ctx) => {
        if (op === "insert:single") {
          return {
            data: {
              id: "row-1",
              user_id: ctx.filters["eq:user_id"] ?? (ctx.payload as any).user_id,
              recipe_id: (ctx.payload as any).recipe_id,
              cooked_at: "2026-04-30T12:00:00Z",
              duration_seconds: (ctx.payload as any).duration_seconds ?? null,
              scale_factor: (ctx.payload as any).scale_factor ?? null,
              rating: (ctx.payload as any).rating ?? null,
              note: (ctx.payload as any).note ?? null,
              created_at: "2026-04-30T12:00:00Z",
            },
            error: null,
          };
        }
        return { data: null, error: new Error("unhandled") };
      },
    });

    const row = await insertCookHistory(sb as any, USER_UUID, {
      recipeId: RECIPE_UUID,
      durationSec: 720,
      scaleFactor: 2,
      rating: 4,
      note: "  added garlic  ",
    });

    const insert = sb.calls.find((c) => c.op === "insert:single");
    expect(insert).toBeDefined();
    const payload = insert!.payload as Record<string, unknown>;
    expect(payload.user_id).toBe(USER_UUID);
    expect(payload.recipe_id).toBe(RECIPE_UUID);
    expect(payload.duration_seconds).toBe(720);
    expect(payload.scale_factor).toBe(2);
    expect(payload.rating).toBe(4);
    expect(payload.note).toBe("added garlic"); // trimmed by clamp

    expect(row.userId).toBe(USER_UUID);
    expect(row.recipeId).toBe(RECIPE_UUID);
    expect(row.scaleFactor).toBe(2);
    expect(row.rating).toBe(4);
    expect(row.note).toBe("added garlic");
  });

  it("omits null / out-of-range optional fields from the payload", async () => {
    const sb = makeSupabase({
      recipe_cook_history: (op, ctx) => {
        if (op === "insert:single") {
          return {
            data: {
              id: "row-2",
              user_id: USER_UUID,
              recipe_id: RECIPE_UUID,
              cooked_at: "2026-04-30T12:00:00Z",
              duration_seconds: null,
              scale_factor: null,
              rating: null,
              note: null,
              created_at: "2026-04-30T12:00:00Z",
            },
            error: null,
          };
        }
        return { data: null, error: new Error("unhandled") };
      },
    });

    await insertCookHistory(sb as any, USER_UUID, {
      recipeId: RECIPE_UUID,
      rating: 7, // out of range — clamp drops it
      note: "", // empty — clamp drops it
      scaleFactor: 0, // not positive — clamp drops it
      durationSec: -1, // negative — clamp drops it
    });

    const insert = sb.calls.find((c) => c.op === "insert:single");
    const payload = insert!.payload as Record<string, unknown>;
    expect(payload.user_id).toBe(USER_UUID);
    expect(payload.recipe_id).toBe(RECIPE_UUID);
    // Optional fields must NOT be present (DB CHECK would reject them).
    expect("rating" in payload).toBe(false);
    expect("note" in payload).toBe(false);
    expect("scale_factor" in payload).toBe(false);
    expect("duration_seconds" in payload).toBe(false);
  });

  it("propagates DB error", async () => {
    const sb = makeSupabase({
      recipe_cook_history: () => ({ data: null, error: new Error("boom") }),
    });
    await expect(
      insertCookHistory(sb as any, USER_UUID, { recipeId: RECIPE_UUID }),
    ).rejects.toThrow(/boom/);
  });
});

// ─── listRecentCookHistory ────────────────────────────────────────

describe("listRecentCookHistory", () => {
  it("returns [] for non-uuid recipe id without hitting the DB", async () => {
    const sb = makeSupabase({});
    const out = await listRecentCookHistory(sb as any, USER_UUID, "not-uuid");
    expect(out).toEqual([]);
    expect(sb.calls.length).toBe(0);
  });

  it("filters by user_id + recipe_id and orders by cooked_at desc", async () => {
    const sb = makeSupabase({
      recipe_cook_history: () => ({
        data: [
          {
            id: "h1",
            user_id: USER_UUID,
            recipe_id: RECIPE_UUID,
            cooked_at: "2026-04-30T12:00:00Z",
            duration_seconds: 600,
            scale_factor: "2",
            rating: 4,
            note: "added garlic",
            created_at: "2026-04-30T12:00:00Z",
          },
          {
            id: "h2",
            user_id: USER_UUID,
            recipe_id: RECIPE_UUID,
            cooked_at: "2026-04-29T12:00:00Z",
            duration_seconds: 720,
            scale_factor: null,
            rating: null,
            note: null,
            created_at: "2026-04-29T12:00:00Z",
          },
        ],
        error: null,
      }),
    });

    const rows = await listRecentCookHistory(sb as any, USER_UUID, RECIPE_UUID);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("h1");
    expect(rows[0]!.scaleFactor).toBe(2);
    expect(rows[0]!.note).toBe("added garlic");
    expect(rows[1]!.scaleFactor).toBeNull();

    const call = sb.calls[0]!;
    expect(call.filters["eq:user_id"]).toBe(USER_UUID);
    expect(call.filters["eq:recipe_id"]).toBe(RECIPE_UUID);
    expect(call.order?.column).toBe("cooked_at");
    expect(call.order?.ascending).toBe(false);
    expect(call.limit).toBe(3);
  });

  it("clamps a wild limit to a safe upper bound (no unbounded reads)", async () => {
    const sb = makeSupabase({
      recipe_cook_history: () => ({ data: [], error: null }),
    });
    await listRecentCookHistory(sb as any, USER_UUID, RECIPE_UUID, 9999);
    expect(sb.calls[0]!.limit).toBe(50);
  });

  it("returns [] when supabase returns null data", async () => {
    const sb = makeSupabase({
      recipe_cook_history: () => ({ data: null, error: null } as any),
    });
    const rows = await listRecentCookHistory(sb as any, USER_UUID, RECIPE_UUID);
    expect(rows).toEqual([]);
  });
});

// ─── formatCookHistoryPreview ────────────────────────────────────

describe("formatCookHistoryPreview", () => {
  const baseRow: CookHistoryRow = {
    id: "h1",
    userId: USER_UUID,
    recipeId: RECIPE_UUID,
    cookedAt: "2026-04-30T12:00:00Z",
    durationSec: 600,
    scaleFactor: 2,
    rating: 4,
    note: "added garlic",
    createdAt: "2026-04-30T12:00:00Z",
  };

  it("renders duration + rating + note when all present", () => {
    expect(formatCookHistoryPreview(baseRow)).toBe(
      `10 min, 4 stars, "added garlic"`,
    );
  });
  it("singular star when rating is 1", () => {
    expect(
      formatCookHistoryPreview({ ...baseRow, rating: 1, note: null }),
    ).toBe("10 min, 1 star");
  });
  it("drops missing pieces from left to right", () => {
    expect(
      formatCookHistoryPreview({
        ...baseRow,
        rating: null,
        note: null,
      }),
    ).toBe("10 min");
    expect(
      formatCookHistoryPreview({
        ...baseRow,
        durationSec: null,
        rating: null,
      }),
    ).toBe(`"added garlic"`);
  });
  it("falls back to a date when nothing was captured", () => {
    const out = formatCookHistoryPreview({
      ...baseRow,
      durationSec: null,
      rating: null,
      note: null,
    });
    // Locale-dependent — assert non-empty + not the default fallback
    // sentinel.
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe("Cooked");
  });
  it("truncates over-long notes with an ellipsis", () => {
    const longNote = "x".repeat(120);
    const out = formatCookHistoryPreview({
      ...baseRow,
      durationSec: null,
      rating: null,
      note: longNote,
    });
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(longNote.length + 5);
  });
});
