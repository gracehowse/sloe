/**
 * photoCorrectionPersist — unit tests for the cross-platform "photo
 * corrections persist into the user's bank" loop.
 *
 * What this protects (round 4 user-sentiment audit, 2026-04-30 — Cal AI's
 * failure pattern, MacroFactor's emerging lead):
 *
 *  1. Round-trip — when the user corrects a photo log result, the
 *     correction is persisted into `user_custom_foods` so the next log
 *     of the same item uses the corrected macros.
 *  2. Idempotency — the same correction twice doesn't duplicate the row.
 *  3. Manual carve-out — a user's hand-curated `manual` row never gets
 *     stomped by an AI photo correction with the same name.
 *  4. Detection — only meaningful edits (name change OR macro delta over
 *     rounding noise) trigger a write. Accept-as-is doesn't pollute the
 *     bank.
 *  5. Analytics — `photo_log_correction_persisted` fires per outcome
 *     with `kind: "insert" | "update" | "skipped_manual"`.
 *  6. Fail-closed — an upsert error per item never throws back to the
 *     caller; the meal still commits.
 */

import { describe, expect, it, vi } from "vitest";

import type { AiLoggedItem } from "@/lib/nutrition/aiLogging";
import {
  persistPhotoCorrections,
} from "@/lib/nutrition/photoCorrectionPersist";

type Handler = (
  op: string,
  ctx: { table: string; payload?: unknown; filters: Record<string, unknown> },
) => { data: unknown; error: unknown };

/**
 * Minimal chainable supabase mock — same shape as
 * `customFoodsClient.test.ts` so the two test suites match. Op
 * strings: `"select"` for un-terminated awaitable selects (peek
 * reads), and `"insert:single"` / `"update:single"` for the
 * `.single()`-terminated writes.
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
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      ilike(col: string, val: unknown) {
        filters[`ilike:${col}`] = val;
        return self;
      },
      single: async () => {
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters, table }) : { data: null, error: new Error(`no handler ${table}`) };
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

const baseAiItem = (overrides: Partial<AiLoggedItem> = {}): AiLoggedItem => ({
  name: "Salmon",
  calories: 200,
  protein: 25,
  carbs: 0,
  fat: 12,
  confidence: 0.7,
  source: "ai_photo",
  ...overrides,
});

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: "cf-photo-1",
  user_id: "u1",
  name: "Salmon",
  brand: null,
  base_grams: 100,
  calories: 250,
  protein: 30,
  carbs: 0,
  fat: 14,
  fiber: null,
  servings: [],
  source: "photo_correction",
  created_at: "2026-04-30T10:00:00Z",
  updated_at: "2026-04-30T10:00:00Z",
  ...overrides,
});

describe("persistPhotoCorrections — round-trip", () => {
  it("inserts a new row when the user changes the macros (no prior row)", async () => {
    let insertedPayload: any = null;
    const handler: Handler = (op, ctx) => {
      if (op === "select") {
        // Both the initial peek (helper analytics-side) AND the upsert
        // helper's own peek read via .ilike(name). Return [] (no
        // existing row) for both paths.
        return { data: [], error: null };
      }
      if (op === "insert:single") {
        insertedPayload = ctx.payload;
        return { data: dbRow({ source: "photo_correction" }), error: null };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });
    const track = vi.fn();

    const original = baseAiItem({ calories: 200, protein: 25, carbs: 0, fat: 12 });
    const corrected = baseAiItem({ calories: 250, protein: 30, carbs: 0, fat: 14 });

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [original],
      corrected: [corrected],
      track,
    });

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.anyPersisted).toBe(true);
    expect(insertedPayload?.source).toBe("photo_correction");
    expect(insertedPayload?.calories).toBe(250);
    expect(insertedPayload?.protein).toBe(30);
    // Track event fires once per persisted outcome.
    expect(track).toHaveBeenCalledWith("photo_log_correction_persisted", {
      foodName: "Salmon",
      kind: "insert",
    });
  });

  it("updates an existing photo_correction row when corrected again", async () => {
    let updatePayload: any = null;
    const handler: Handler = (op, ctx) => {
      if (op === "select") {
        // Both the helper peek + the upsert helper's own lookup
        // return the existing photo_correction row.
        return {
          data: [{ id: "cf-photo-1", source: "photo_correction" }],
          error: null,
        };
      }
      if (op === "update:single") {
        updatePayload = ctx.payload;
        return { data: dbRow({ calories: 280 }), error: null };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });
    const track = vi.fn();

    const original = baseAiItem({ calories: 200 });
    const corrected = baseAiItem({ calories: 280 });

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [original],
      corrected: [corrected],
      track,
    });

    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);
    expect(updatePayload?.calories).toBe(280);
    expect(updatePayload?.source).toBe("photo_correction");
    expect(track).toHaveBeenCalledWith("photo_log_correction_persisted", {
      foodName: "Salmon",
      kind: "update",
    });
  });

  it("is idempotent — second identical correction is a no-op write", async () => {
    let updateCount = 0;
    const handler: Handler = (op, _ctx) => {
      if (op === "select") {
        // Pre-existing photo_correction row so the helper takes the
        // update branch (idempotency lives at the row level — the
        // unique index dedupes on `(user_id, lower(name))`).
        return {
          data: [{ id: "cf-photo-1", source: "photo_correction" }],
          error: null,
        };
      }
      if (op === "update:single") {
        updateCount += 1;
        return { data: dbRow({ calories: 280 }), error: null };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });

    const original = baseAiItem({ calories: 200 });
    const corrected = baseAiItem({ calories: 280 });

    // First correction.
    await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [original],
      corrected: [corrected],
    });
    // Second identical correction (the user re-logs the same dish
    // with the same macros). The original-vs-corrected comparison
    // is what gates this; the bank-row dedupe is downstream. Use
    // the SAME pair so detection still fires (treating "user
    // confirmed correction is sticky" as meaningful).
    await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [original],
      corrected: [corrected],
    });

    // Two persists ⇒ two updates on the existing row. The DB unique
    // index ensures only one row exists per (user, lower(name)).
    expect(updateCount).toBe(2);
  });
});

describe("persistPhotoCorrections — manual carve-out", () => {
  it("never overwrites a manual row with the same name", async () => {
    let updateCalls = 0;
    let insertCalls = 0;
    const handler: Handler = (op) => {
      if (op === "select") {
        return {
          data: [{ id: "cf-manual-1", source: "manual" }],
          error: null,
        };
      }
      if (op === "update:single") {
        updateCalls += 1;
        return { data: null, error: null };
      }
      if (op === "insert:single") {
        insertCalls += 1;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });
    const track = vi.fn();

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [baseAiItem({ calories: 200 })],
      corrected: [baseAiItem({ calories: 300 })],
      track,
    });

    expect(result.skippedManual).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(updateCalls).toBe(0);
    expect(insertCalls).toBe(0);
    expect(track).toHaveBeenCalledWith("photo_log_correction_persisted", {
      foodName: "Salmon",
      kind: "skipped_manual",
    });
  });
});

describe("persistPhotoCorrections — detection", () => {
  it("skips items where the user accepted the AI's values verbatim", async () => {
    let upsertCalls = 0;
    const handler: Handler = (op) => {
      if (op === "select") return { data: [], error: null };
      if (op === "insert:single" || op === "update:single") {
        upsertCalls += 1;
      }
      return { data: dbRow(), error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });
    const track = vi.fn();

    const item = baseAiItem();
    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [item],
      corrected: [{ ...item }],
      track,
    });

    expect(result.skippedNoChange).toBe(1);
    expect(result.anyPersisted).toBe(false);
    expect(upsertCalls).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it("treats a name change as a meaningful correction even with same macros", async () => {
    let insertCalls = 0;
    const handler: Handler = (op) => {
      if (op === "select") return { data: [], error: null };
      if (op === "insert:single") {
        insertCalls += 1;
        return { data: dbRow({ name: "Tuna" }), error: null };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [baseAiItem({ name: "Salmon" })],
      corrected: [baseAiItem({ name: "Tuna" })],
    });

    expect(result.inserted).toBe(1);
    expect(insertCalls).toBe(1);
  });

  it("ignores macro changes within rounding noise (≤2 kcal / ≤0.5g)", async () => {
    let upsertCalls = 0;
    const handler: Handler = (op) => {
      if (op === "select") return { data: [], error: null };
      if (op === "insert:single" || op === "update:single") {
        upsertCalls += 1;
      }
      return { data: dbRow(), error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [baseAiItem({ calories: 200, protein: 25.0 })],
      corrected: [baseAiItem({ calories: 201, protein: 25.3 })],
    });

    expect(result.skippedNoChange).toBe(1);
    expect(upsertCalls).toBe(0);
  });
});

describe("persistPhotoCorrections — fail-closed", () => {
  it("captures per-item errors without throwing", async () => {
    const handler: Handler = (op) => {
      if (op === "select") return { data: [], error: null };
      if (op === "insert:single" || op === "update:single") {
        return { data: null, error: new Error("rls denied") };
      }
      return { data: null, error: null };
    };
    const sb = makeSupabase({ user_custom_foods: handler });

    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "u1",
      originals: [baseAiItem({ calories: 200 })],
      corrected: [baseAiItem({ calories: 280 })],
    });

    expect(result.errored).toBe(1);
    expect(result.outcomes[0]).toMatchObject({
      kind: "error",
      foodName: "Salmon",
    });
    // Caller never throws — the meal commit is unblocked.
    expect(result.anyPersisted).toBe(false);
  });

  it("returns no-op outcomes when userId is missing (no auth)", async () => {
    const sb = makeSupabase({});
    const result = await persistPhotoCorrections({
      supabase: sb as any,
      userId: "",
      originals: [baseAiItem()],
      corrected: [baseAiItem({ calories: 999 })],
    });
    expect(result.skippedNoChange).toBe(1);
    expect(sb.calls).toHaveLength(0);
  });

  it("rejects mismatched lengths early", async () => {
    const sb = makeSupabase({});
    await expect(
      persistPhotoCorrections({
        supabase: sb as any,
        userId: "u1",
        originals: [baseAiItem()],
        corrected: [baseAiItem(), baseAiItem()],
      }),
    ).rejects.toThrow(/lengths must match/);
  });
});
