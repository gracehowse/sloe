/**
 * `nutrition_entry_ingredients` — per-item AI/photo/voice meal snapshot.
 *
 * ENG-751. The "By ingredient" macro-detail view derives per-ingredient macros
 * for logged **recipes** from `recipe_ingredients × portion_multiplier`,
 * reconciled to the entry total (see {@link ./macroIngredientBreakdown}). AI /
 * photo / voice meals have **no `recipe_id`**: their per-item breakdown lives
 * only in the unpersisted AI response, so historically each entry rendered as a
 * single self-named fallback line carrying its own rounded macros — correct,
 * but lossy (the AI-resolved item name, the un-rounded macros, and the per-item
 * `confidence` + `source` provenance were thrown away on commit).
 *
 * This module persists that breakdown into a child snapshot table so those
 * entries can split, and carries the trust posture forward: **low-confidence
 * items are flagged, never silently filled**.
 *
 * ## Architecture note (read this before extending)
 * Each AI item is committed as its OWN `nutrition_entries` row today (the
 * `commitAiLoggedItems` flow loops `addLoggedMeal` per item — web
 * `NutritionTracker.tsx`, mobile `(tabs)/index.tsx`). So a multi-item AI meal
 * is already N entries; each entry's snapshot is the single high-fidelity row
 * for that one item, carrying the un-rounded macros + `confidence` + `source`
 * the rounded entry column set drops. The schema and read path are written to
 * support N snapshot rows per entry so a future flow that aggregates items into
 * ONE entry splits correctly without a second migration.
 *
 * ## Trust posture
 * - We persist ONLY items the AI pipeline actually returned with macros. Nothing
 *   here mints nutrition values (CLAUDE.md "no invented nutrition values").
 * - `confidence` is preserved on every row; `<0.5` is low-confidence and the
 *   read/render path flags it (mirrors {@link ./aiLogging}'s
 *   `LOW_CONFIDENCE_THRESHOLD`). A low-confidence item is FLAGGED, never dropped.
 *
 * Pure: no React, no Date, no network, no Supabase. The caller does the I/O.
 */

import { LOW_CONFIDENCE_THRESHOLD, type AiLoggedItem } from "./aiLogging";

/** Macros this snapshot stores. Mirrors {@link ./macroIngredientBreakdown}. */
export type SnapshotMacro = "protein" | "carbs" | "fat" | "fiber" | "calories";

/**
 * A `nutrition_entry_ingredients` row as it lives in Postgres (snake_case).
 * `database.types.ts` does NOT yet describe this table — it is regenerated from
 * the LIVE schema, which won't have the table until Grace runs
 * `supabase db push --linked`. Until then, this explicit interface is the typed
 * boundary (cast at the supabase call site), following the `profiles.meal_plan_slots`
 * precedent. Post-apply follow-up: regen `database.types.ts` and drop the casts
 * (tracked under ENG-751 — not a silent TODO).
 */
export interface NutritionEntryIngredientRow {
  id: string;
  entry_id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber_g: number | null;
  /** Match confidence in [0, 1]; `< LOW_CONFIDENCE_THRESHOLD` (0.5) → low. */
  confidence: number | null;
  /** Provenance label — `"AI voice"` / `"AI photo"` (matches `nutrition_entries.source`). */
  source: string | null;
  created_at: string;
}

/**
 * The insert shape — `id` + `created_at` are server-defaulted, so callers omit
 * them. Snake_case so it drops straight onto a `supabase.from(...).insert(...)`.
 */
export type NutritionEntryIngredientInsert = {
  entry_id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber_g: number | null;
  confidence: number | null;
  source: string | null;
};

/** Canonical table name — single-sourced so the call sites can't typo-drift. */
export const NUTRITION_ENTRY_INGREDIENTS_TABLE = "nutrition_entry_ingredients";

/** Display-only feature flag gating the read path's snapshot-split. Default-OFF. */
export const NUTRITION_ENTRY_INGREDIENTS_FLAG = "nutrition_entry_ingredients_v1";

function finiteOrNull(v: number | undefined | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the snapshot insert rows for one entry from the AI items it represents.
 *
 * Defensive + additive (never fabricates):
 *  - Only items with a finite, > 0 calorie value are persisted. An item the AI
 *    returned with no usable macros is skipped, not zero-filled — persisting a
 *    fabricated 0 line would be inventing nutrition the pipeline never produced.
 *  - `confidence` is carried verbatim (clamped to [0, 1]); a low-confidence item
 *    is KEPT (flagged downstream), not dropped — the snapshot is the durable
 *    record of what the AI returned, warts and all.
 *  - `name` falls back to a generic label only when the item is genuinely
 *    nameless, so a row is never blank.
 *
 * @param entryId  the `nutrition_entries.id` this snapshot hangs off
 * @param items    the AI items the entry was logged from (usually one per entry)
 * @param source   the entry's canonical source label (`"AI voice"` / `"AI photo"`)
 */
export function buildEntryIngredientRows(
  entryId: string,
  items: ReadonlyArray<
    Pick<
      AiLoggedItem,
      "name" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "confidence"
    >
  >,
  source: string,
): NutritionEntryIngredientInsert[] {
  if (!entryId || items.length === 0) return [];
  const rows: NutritionEntryIngredientInsert[] = [];
  for (const item of items) {
    const calories = finiteOrNull(item.calories);
    // Skip items the AI returned without a usable calorie value — never
    // fabricate a 0 line for nutrition the pipeline didn't produce.
    if (calories == null || calories <= 0) continue;
    const rawConfidence = finiteOrNull(item.confidence);
    const confidence =
      rawConfidence == null ? null : Math.min(1, Math.max(0, rawConfidence));
    rows.push({
      entry_id: entryId,
      name: (item.name ?? "").trim() || "Item",
      calories,
      protein: finiteOrNull(item.protein),
      carbs: finiteOrNull(item.carbs),
      fat: finiteOrNull(item.fat),
      fiber_g: finiteOrNull(item.fiber),
      confidence,
      source: source || null,
    });
  }
  return rows;
}

/** True when a snapshot row's confidence is below the low-confidence threshold. */
export function isSnapshotRowLowConfidence(
  row: Pick<NutritionEntryIngredientRow, "confidence">,
): boolean {
  const c = row.confidence;
  // A missing confidence is treated as low — we never imply certainty we lack.
  if (c == null || !Number.isFinite(c)) return true;
  return Math.min(1, Math.max(0, c)) < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * The minimal PostgREST surface this module's persist helper needs — both the
 * web (`@supabase/supabase-js`) and mobile clients satisfy it, so the helper is
 * platform-agnostic and lives once in shared code.
 */
export interface SnapshotInsertClient {
  from(table: string): {
    insert(rows: NutritionEntryIngredientInsert[]): PromiseLike<{
      error: { message?: string } | null;
    }>;
  };
}

/** Outcome of a snapshot-insert attempt — purely informational (never thrown). */
export type SnapshotInsertResult =
  | { status: "ok"; rowCount: number }
  | { status: "skipped"; reason: "no-rows" }
  | { status: "failed"; reason: "missing-table" | "error"; message?: string };

function looksLikeMissingSnapshotTable(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    // PostgREST surfaces a missing relation referenced by `.from(...)`.
    msg.includes("relation") && msg.includes("does not exist")
  );
}

/**
 * Persist the per-item snapshot for ONE AI/photo/voice entry — additive +
 * DEFENSIVE. This is the critical guardrail of ENG-751: it runs AFTER and
 * SEPARATELY from the main `nutrition_entries` write and **can never break the
 * meal log**.
 *
 * It NEVER throws. On any failure — the table not existing yet (pre-push), an
 * RLS denial, a transient network error, or a brief FK race with the parent
 * entry insert — it swallows, logs once, and returns a `failed` result. The
 * caller `void`s it; nothing about the meal log depends on its outcome. This
 * mirrors the journal-persistence resilience posture (the meal-logging path is
 * data-loss-sensitive history — we do not regress it for a non-critical
 * snapshot capture).
 *
 * @param client   a supabase client (web or mobile)
 * @param entryId  the parent `nutrition_entries.id`
 * @param items    the AI items the entry represents (built into rows here)
 * @param source   the entry's canonical source label
 */
export async function persistEntryIngredientSnapshot(
  client: SnapshotInsertClient,
  entryId: string,
  items: ReadonlyArray<
    Pick<
      AiLoggedItem,
      "name" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "confidence"
    >
  >,
  source: string,
): Promise<SnapshotInsertResult> {
  const rows = buildEntryIngredientRows(entryId, items, source);
  if (rows.length === 0) return { status: "skipped", reason: "no-rows" };
  try {
    // ENG-751 P3 (review note) — plain INSERT, not an upsert: the snapshot table
    // has no UNIQUE(entry_id, name, source), so re-invoking this for the same
    // entry would duplicate rows. Safe TODAY because it fires exactly ONCE per
    // entry (no retry/queue on the snapshot path — failures are swallowed, not
    // re-driven). Before wiring ANY retry or backfill that could re-invoke this
    // for an existing entry, add a UNIQUE(entry_id, name, source) constraint +
    // switch to upsert (onConflict) or delete-then-insert.
    const { error } = await client.from(NUTRITION_ENTRY_INGREDIENTS_TABLE).insert(rows);
    if (error) {
      const reason = looksLikeMissingSnapshotTable(error.message)
        ? "missing-table"
        : "error";
      if (typeof console !== "undefined") {
        console.warn(
          `[eng751] nutrition_entry_ingredients insert ${reason}:`,
          error.message ?? error,
        );
      }
      return { status: "failed", reason, message: error.message };
    }
    return { status: "ok", rowCount: rows.length };
  } catch (err) {
    // A thrown (vs returned) error — network reject, client misconfig. Swallow:
    // the meal log already landed; the snapshot is best-effort.
    if (typeof console !== "undefined") {
      console.warn(
        "[eng751] nutrition_entry_ingredients insert threw:",
        err instanceof Error ? err.message : err,
      );
    }
    return {
      status: "failed",
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
