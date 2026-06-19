import { describe, expect, it, vi } from "vitest";
import {
  buildEntryIngredientRows,
  isSnapshotRowLowConfidence,
  persistEntryIngredientSnapshot,
  type NutritionEntryIngredientInsert,
  type SnapshotInsertClient,
} from "../../src/lib/nutrition/nutritionEntryIngredients";

/**
 * ENG-751 — per-item AI/photo/voice snapshot capture.
 *
 * These tests protect three contracts:
 *  1. The builder NEVER fabricates nutrition — items with no usable macros are
 *     skipped, not zero-filled; confidence + source are carried verbatim.
 *  2. Low-confidence is FLAGGED, never dropped (trust posture).
 *  3. The persist path is DEFENSIVE — a missing table, an RLS denial, a network
 *     reject, or a thrown error all swallow and return a result; nothing ever
 *     throws back into the caller, so the meal log can never be broken by it.
 */

const item = (over: Record<string, unknown> = {}) => ({
  name: "Chicken",
  calories: 200,
  protein: 30,
  carbs: 0,
  fat: 8,
  fiber: 1,
  confidence: 0.9,
  ...over,
});

describe("buildEntryIngredientRows", () => {
  it("maps an AI item to a snapshot row, carrying confidence + source", () => {
    const rows = buildEntryIngredientRows("entry-1", [item()], "AI photo");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject<Partial<NutritionEntryIngredientInsert>>({
      entry_id: "entry-1",
      name: "Chicken",
      calories: 200,
      protein: 30,
      carbs: 0,
      fat: 8,
      fiber_g: 1,
      confidence: 0.9,
      source: "AI photo",
    });
  });

  it("skips items with no usable calorie value — never fabricates a 0 line", () => {
    const rows = buildEntryIngredientRows(
      "entry-1",
      [
        item({ name: "Has macros", calories: 150 }),
        item({ name: "No calories", calories: 0 }),
        item({ name: "NaN calories", calories: Number.NaN }),
        item({ name: "Missing calories", calories: undefined }),
      ],
      "AI voice",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Has macros");
  });

  it("KEEPS low-confidence items (flagged downstream), never drops them", () => {
    const rows = buildEntryIngredientRows(
      "entry-1",
      [item({ name: "Uncertain", confidence: 0.2 })],
      "AI photo",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].confidence).toBe(0.2);
    expect(isSnapshotRowLowConfidence(rows[0])).toBe(true);
  });

  it("clamps out-of-range confidence into [0, 1]", () => {
    const rows = buildEntryIngredientRows(
      "entry-1",
      [
        item({ name: "Too high", confidence: 1.5 }),
        item({ name: "Negative", confidence: -0.3 }),
      ],
      "AI photo",
    );
    expect(rows[0].confidence).toBe(1);
    expect(rows[1].confidence).toBe(0);
  });

  it("preserves null macros + a missing confidence without inventing values", () => {
    const rows = buildEntryIngredientRows(
      "entry-1",
      [{ name: "Sparse", calories: 100, confidence: undefined } as never],
      "AI photo",
    );
    expect(rows[0].protein).toBeNull();
    expect(rows[0].confidence).toBeNull();
    // A missing confidence is treated as low downstream (we never imply certainty).
    expect(isSnapshotRowLowConfidence(rows[0])).toBe(true);
  });

  it("falls back to a generic name only when the item is genuinely nameless", () => {
    const rows = buildEntryIngredientRows(
      "entry-1",
      [item({ name: "   " })],
      "AI photo",
    );
    expect(rows[0].name).toBe("Item");
  });

  it("returns no rows for an empty entry id or no items", () => {
    expect(buildEntryIngredientRows("", [item()], "AI photo")).toHaveLength(0);
    expect(buildEntryIngredientRows("entry-1", [], "AI photo")).toHaveLength(0);
  });
});

describe("persistEntryIngredientSnapshot — defensive write path", () => {
  const makeClient = (
    impl: () => Promise<{ error: { message?: string } | null }>,
  ): { client: SnapshotInsertClient; insert: ReturnType<typeof vi.fn> } => {
    const insert = vi.fn(impl);
    const client: SnapshotInsertClient = { from: () => ({ insert }) };
    return { client, insert };
  };

  it("inserts N rows for a multi-item AI meal and reports ok", async () => {
    const { client, insert } = makeClient(async () => ({ error: null }));
    const result = await persistEntryIngredientSnapshot(
      client,
      "entry-1",
      [item({ name: "A" }), item({ name: "B" })],
      "AI photo",
    );
    expect(result).toEqual({ status: "ok", rowCount: 2 });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
  });

  it("skips the insert entirely when there are no persistable rows", async () => {
    const { client, insert } = makeClient(async () => ({ error: null }));
    const result = await persistEntryIngredientSnapshot(
      client,
      "entry-1",
      [item({ calories: 0 })], // no usable macros → no rows
      "AI photo",
    );
    expect(result).toEqual({ status: "skipped", reason: "no-rows" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("swallows a missing-table error (pre-push) — never throws", async () => {
    const { client } = makeClient(async () => ({
      error: { message: "Could not find the table 'public.nutrition_entry_ingredients' in the schema cache" },
    }));
    const result = await persistEntryIngredientSnapshot(client, "entry-1", [item()], "AI photo");
    expect(result).toEqual({
      status: "failed",
      reason: "missing-table",
      message: expect.stringContaining("Could not find the table"),
    });
  });

  it("swallows an RLS / generic error — never throws", async () => {
    const { client } = makeClient(async () => ({
      error: { message: "new row violates row-level security policy" },
    }));
    const result = await persistEntryIngredientSnapshot(client, "entry-1", [item()], "AI photo");
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.reason).toBe("error");
  });

  it("swallows a THROWN error (network reject) — never propagates to the caller", async () => {
    const client: SnapshotInsertClient = {
      from: () => ({
        insert: () => Promise.reject(new Error("network down")),
      }),
    };
    // The whole point: this must resolve, not reject. If it threw, the await
    // would reject and the test would fail.
    const result = await persistEntryIngredientSnapshot(client, "entry-1", [item()], "AI photo");
    expect(result.status).toBe("failed");
  });
});
