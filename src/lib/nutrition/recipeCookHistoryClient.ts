/**
 * recipe_cook_history — Supabase CRUD (Paprika parity, 2026-04-30).
 *
 * Per-cook session log with optional duration, scale, rating, and
 * free-text note. Writes happen on the Cook screen completion card;
 * reads happen on the next Cook open to surface "Last time" preview
 * cards.
 *
 * Distinct from `user_recipe_notes` (which holds rolling rating /
 * notes / cook count per user-per-recipe). This client is for the
 * append-only per-cook log only.
 *
 * No React, no JSX — caller passes a supabase-js-compatible client so
 * the same module runs on web, in React Native, and in Node tests.
 *
 * Migration: `supabase/migrations/20260504100000_recipe_cook_history.sql`.
 */

import { mapPersistenceError } from "./persistenceErrors";

/** Loose supabase-js shape — the file must not pull in the workspace's
 *  generated types. Both web and mobile pass their own client. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** Normalised UI-shape for one history row. */
export type CookHistoryRow = {
  id: string;
  userId: string;
  recipeId: string;
  /** ISO timestamp of when the cook completed. */
  cookedAt: string;
  /** Cook-mode session length in seconds, or null. */
  durationSec: number | null;
  /** Scale factor the user picked, or null when no scale chosen. */
  scaleFactor: number | null;
  /** 1..5 rating for THIS cook, or null when not rated. */
  rating: number | null;
  /** Free-text per-cook note, or null when blank. */
  note: string | null;
  createdAt: string;
};

/** Fields the caller can pass to insert a new history row. All optional
 *  except `recipeId` so a future "I just cooked this" surface can
 *  write a row without a duration / scale / rating / note. */
export type InsertCookHistoryInput = {
  recipeId: string;
  durationSec?: number | null;
  scaleFactor?: number | null;
  rating?: number | null;
  note?: string | null;
  /** Override `cooked_at` from the default `now()` — used by tests
   *  and any retroactive-log surface. ISO string. */
  cookedAt?: string;
};

/** Same uuid shape gate the recipe-notes client uses. Non-uuid recipe
 *  ids (legacy numeric, in-memory drafts) cannot have history rows
 *  because the FK references `recipes.id` (uuid). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** Per-cook note cap — must match the DB CHECK in
 *  `recipe_cook_history.note`. Re-declared here so the UI clamp + DB
 *  check stay in lock-step. */
export const COOK_HISTORY_NOTE_MAX_LEN = 500;

/** Clamp + normalise `note` input. Trims trailing whitespace, returns
 *  null for an empty string (DB stores NULL not ''), and slices any
 *  paste that overran the 500-char cap so the write can't fail. */
export function clampCookHistoryNote(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.length > COOK_HISTORY_NOTE_MAX_LEN
    ? trimmed.slice(0, COOK_HISTORY_NOTE_MAX_LEN)
    : trimmed;
}

/** Coerce a rating value to a clean 1..5 integer, or null. Mirrors the
 *  `user_recipe_notes` rating coercion so the two surfaces never
 *  disagree on what counts as "no rating". */
export function clampCookHistoryRating(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

/** Coerce a scale factor to a finite positive number, or null. We do
 *  NOT enforce the preset set here — the DB CHECK allows up to 99x
 *  for forward compat, and a future "5x" preset shouldn't need a
 *  client release before the row can be written. */
export function clampCookHistoryScale(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 99) return null;
  return Math.round(n * 100) / 100;
}

/** Coerce duration to a non-negative integer of seconds, or null. */
export function clampCookHistoryDuration(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function rowToHistory(row: any): CookHistoryRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    recipeId: String(row.recipe_id),
    cookedAt: String(row.cooked_at ?? ""),
    durationSec:
      row.duration_seconds == null ? null : Number(row.duration_seconds),
    scaleFactor:
      row.scale_factor == null ? null : Number(row.scale_factor),
    rating: row.rating == null ? null : Number(row.rating),
    note: row.note == null || row.note === "" ? null : String(row.note),
    createdAt: String(row.created_at ?? ""),
  };
}

/**
 * Insert one cook-history row for the current user. Returns the
 * persisted row so the UI can chain a "saved" toast off the resolved
 * promise. Throws on database error — callers should catch and toast
 * the user.
 *
 * `recipeId` must be a uuid (the FK to `recipes.id`). Non-uuid ids
 * resolve to a thrown error that the caller can surface as "Save the
 * recipe to your library first" — same posture as `recipeNotesClient`.
 */
export async function insertCookHistory(
  supabase: SupabaseLike,
  userId: string,
  input: InsertCookHistoryInput,
): Promise<CookHistoryRow> {
  if (!userId) throw new Error("insertCookHistory: userId is required");
  if (!input.recipeId) throw new Error("insertCookHistory: recipeId is required");
  if (!isUuid(input.recipeId)) {
    throw new Error(
      "Save this recipe to your library first — cook history only persists for saved recipes.",
    );
  }
  const payload: Record<string, unknown> = {
    user_id: userId,
    recipe_id: input.recipeId,
  };
  if (input.cookedAt) payload.cooked_at = input.cookedAt;
  const dur = clampCookHistoryDuration(input.durationSec);
  if (dur != null) payload.duration_seconds = dur;
  const scale = clampCookHistoryScale(input.scaleFactor);
  if (scale != null) payload.scale_factor = scale;
  const rating = clampCookHistoryRating(input.rating);
  if (rating != null) payload.rating = rating;
  const note = clampCookHistoryNote(input.note);
  if (note != null) payload.note = note;

  const { data, error } = await supabase
    .from("recipe_cook_history")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    // F-144 (2026-05-10): catch the recipe-wipe FK cascade so users
    // see actionable copy instead of a raw constraint error.
    throw mapPersistenceError(error ?? new Error("insertCookHistory: insert returned no row"));
  }
  return rowToHistory(data);
}

/**
 * Fetch the most recent cook-history rows for a (user, recipe). Returns
 * newest-first; capped at `limit` (default 3 — matches the "Last time"
 * card scope on both platforms). Empty array when there is no history
 * yet. Errors bubble.
 */
export async function listRecentCookHistory(
  supabase: SupabaseLike,
  userId: string,
  recipeId: string,
  limit: number = 3,
): Promise<CookHistoryRow[]> {
  if (!userId) throw new Error("listRecentCookHistory: userId is required");
  if (!recipeId) throw new Error("listRecentCookHistory: recipeId is required");
  if (!isUuid(recipeId)) return [];
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(50, Math.floor(limit)) : 3;
  const { data, error } = await supabase
    .from("recipe_cook_history")
    .select("*")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .order("cooked_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map(rowToHistory);
}

/**
 * Format a single history row as the one-line preview rendered on the
 * "Last time" card: e.g. `Last time: 12 min, 4 stars, "added garlic"`.
 *
 * Pieces are dropped from left to right when missing — a row with no
 * rating still renders the duration; a row with no note still renders
 * the duration + rating. When everything is null we surface the bare
 * date so the row is never blank.
 *
 * Pure helper — no Date locale handling beyond `toLocaleDateString`.
 */
export function formatCookHistoryPreview(row: CookHistoryRow): string {
  const parts: string[] = [];
  if (row.durationSec != null && row.durationSec > 0) {
    const mins = Math.max(1, Math.round(row.durationSec / 60));
    parts.push(`${mins} min`);
  }
  if (row.rating != null) {
    parts.push(`${row.rating} star${row.rating === 1 ? "" : "s"}`);
  }
  if (row.note) {
    const truncated = row.note.length > 80 ? `${row.note.slice(0, 77)}…` : row.note;
    parts.push(`"${truncated}"`);
  }
  if (parts.length === 0) {
    // Nothing captured — fall back to a date so the row isn't empty.
    try {
      const d = new Date(row.cookedAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    } catch {
      /* fall through */
    }
    return "Cooked";
  }
  return parts.join(", ");
}
