/**
 * Personal recipe notes — Supabase CRUD (Batch 3.8).
 *
 * Per-user, per-recipe "my personal feelings" storage:
 *   - free-form `notes` ("less salt next time")
 *   - private `personal_rating` (1..5 or null)
 *   - `cook_count` + `last_cooked_at` bookkeeping
 *
 * Table `public.user_recipe_notes` — see migration
 * `20260421140000_user_recipe_notes_ratings.sql`.
 *
 * Shared by the web `RecipeDetail.tsx` and the mobile `recipe/[id].tsx`.
 * No React, no JSX — callers pass a supabase-js-compatible client so
 * the same file runs in Node tests, browser, and React Native.
 *
 * Design notes:
 *  - Owner-only RLS guards the DB; every call also filters by
 *    `user_id` so an incorrectly-scoped client cannot read another
 *    user's row.
 *  - `upsertUserRecipeNotes` is idempotent. It reads the row, and
 *    either inserts or updates. We do NOT use supabase.upsert() —
 *    the onConflict form is finicky with RLS and we want the read
 *    anyway to compose with the UI's "did we find existing notes?"
 *    boolean.
 *  - `incrementCookCount` is read-then-write. Concurrent double-taps
 *    from two devices may drop a count; this is acceptable for a
 *    behaviour counter, not a billing counter.
 *  - Null / empty inputs are handled defensively. An empty `notes`
 *    string is valid ("user cleared their notes"); null rating is
 *    valid ("user cleared their rating").
 */

/** Supabase-js-compatible shape. Typed as `any` on purpose — this file
 * must import from neither workspace's generated types. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** The normalised shape the UI consumes. */
export type UserRecipeNotes = {
  id: string;
  userId: string;
  recipeId: string;
  notes: string;
  /** 1..5 or null for "no rating". */
  personalRating: number | null;
  cookCount: number;
  /** ISO timestamp string of the last "Mark as cooked" press, or null. */
  lastCookedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Fields a caller can pass to `upsertUserRecipeNotes`. Both optional
 * so the caller can update notes without touching the rating and
 * vice-versa. `undefined` means "don't change"; `null` on rating means
 * "clear". */
export type UpsertNotesInput = {
  notes?: string;
  personalRating?: number | null;
};

const MAX_NOTES_LEN = 10_000;

/**
 * `user_recipe_notes.recipe_id` is a uuid. Non-uuid recipe ids (e.g.
 * in-memory imports not yet persisted, or legacy numeric ids that slipped
 * past a join) would trip a 22P02 "invalid input syntax for type uuid"
 * error on Postgres — surfaced to testers as "Could not load notes".
 * Gate reads/writes on a quick uuid shape check so those cases become
 * "no notes yet" rather than an error alert.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function safeInt(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.trunc(v));
}

function normaliseRating(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.round(n);
  if (clamped < 1 || clamped > 5) return null;
  return clamped;
}

function rowToNotes(row: any): UserRecipeNotes {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    recipeId: String(row.recipe_id),
    notes: typeof row.notes === "string" ? row.notes : "",
    personalRating: normaliseRating(row.personal_rating),
    cookCount: safeInt(row.cook_count, 0),
    lastCookedAt: row.last_cooked_at ? String(row.last_cooked_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * Fetch the user's notes row for a recipe. Returns `null` when the
 * row does not exist (the user hasn't rated / noted this recipe yet).
 * Errors bubble so callers can surface a toast — the UI treats "no
 * data" and "read failed" differently.
 */
export async function getUserRecipeNotes(
  supabase: SupabaseLike,
  userId: string,
  recipeId: string,
): Promise<UserRecipeNotes | null> {
  if (!userId) throw new Error("getUserRecipeNotes: userId is required");
  if (!recipeId) throw new Error("getUserRecipeNotes: recipeId is required");
  // Non-uuid recipe ids cannot have notes — return null rather than
  // letting Postgres reject the query shape (F-38, 2026-04-21).
  if (!isUuid(recipeId)) return null;
  const { data, error } = await supabase
    .from("user_recipe_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToNotes(data);
}

/**
 * Create-or-update a user's notes row for a recipe.
 *
 * Rules:
 *  - `notes` is clamped to MAX_NOTES_LEN (matches DB CHECK constraint —
 *    clamp here so the row never fails the write and the textarea
 *    autosave always completes).
 *  - `personalRating` null clears the rating; 1..5 sets it; out-of-
 *    range / non-numeric values are coerced to null (the DB CHECK
 *    would reject them otherwise).
 *  - `updated_at` is bumped to `now()` on every call.
 */
export async function upsertUserRecipeNotes(
  supabase: SupabaseLike,
  userId: string,
  recipeId: string,
  input: UpsertNotesInput,
): Promise<UserRecipeNotes> {
  if (!userId) throw new Error("upsertUserRecipeNotes: userId is required");
  if (!recipeId) throw new Error("upsertUserRecipeNotes: recipeId is required");
  if (!isUuid(recipeId)) {
    throw new Error(
      "Save this recipe to your library first — notes only persist for saved recipes.",
    );
  }

  const { data: existing, error: readErr } = await supabase
    .from("user_recipe_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (readErr) throw readErr;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    updated_at: now,
  };
  if (input.notes !== undefined) {
    const trimmed = String(input.notes);
    payload.notes = trimmed.length > MAX_NOTES_LEN
      ? trimmed.slice(0, MAX_NOTES_LEN)
      : trimmed;
  }
  if (input.personalRating !== undefined) {
    payload.personal_rating = normaliseRating(input.personalRating);
  }

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("user_recipe_notes")
      .update(payload)
      .eq("id", (existing as any).id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updErr || !updated) throw updErr ?? new Error("upsertUserRecipeNotes: update failed");
    return rowToNotes(updated);
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    recipe_id: recipeId,
    notes: payload.notes ?? "",
    personal_rating: payload.personal_rating ?? null,
    updated_at: now,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("user_recipe_notes")
    .insert(insertPayload)
    .select("*")
    .single();
  if (insErr || !inserted) throw insErr ?? new Error("upsertUserRecipeNotes: insert failed");
  return rowToNotes(inserted);
}

/**
 * +1 to `cook_count` and set `last_cooked_at = now()`. If the row
 * does not exist yet, creates it with `cook_count = 1`. Read-then-
 * write; concurrent increments from two devices may drop a count.
 */
export async function incrementCookCount(
  supabase: SupabaseLike,
  userId: string,
  recipeId: string,
): Promise<UserRecipeNotes> {
  if (!userId) throw new Error("incrementCookCount: userId is required");
  if (!recipeId) throw new Error("incrementCookCount: recipeId is required");

  const { data: existing, error: readErr } = await supabase
    .from("user_recipe_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (readErr) throw readErr;

  const now = new Date().toISOString();
  if (existing) {
    const current = safeInt((existing as any).cook_count, 0);
    const { data: updated, error: updErr } = await supabase
      .from("user_recipe_notes")
      .update({
        cook_count: current + 1,
        last_cooked_at: now,
        updated_at: now,
      })
      .eq("id", (existing as any).id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updErr || !updated) throw updErr ?? new Error("incrementCookCount: update failed");
    return rowToNotes(updated);
  }

  const { data: inserted, error: insErr } = await supabase
    .from("user_recipe_notes")
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      notes: "",
      personal_rating: null,
      cook_count: 1,
      last_cooked_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (insErr || !inserted) throw insErr ?? new Error("incrementCookCount: insert failed");
  return rowToNotes(inserted);
}
