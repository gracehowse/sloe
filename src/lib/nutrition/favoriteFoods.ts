/**
 * Favourite foods — Supabase CRUD for `public.user_favorite_foods`.
 *
 * Shared between web (`src/app/components/suppr/quick-add-panel.tsx`)
 * and mobile (`apps/mobile/app/(tabs)/index.tsx` — Quick Add panel).
 * No React, no JSX; callers pass in a compatible supabase-js client so
 * the same file runs in Node for tests, browser for web, and React
 * Native for mobile.
 *
 * Invariants:
 *  - The unique index on (user_id, lower(recipe_title), round(calories))
 *    prevents duplicates. `addFavorite` treats a unique-violation as
 *    success and returns the existing row.
 *  - There is no UPDATE policy; to change a favourite the caller
 *    deletes + re-inserts.
 *  - `isFavorite` and `favoriteKey` lower-case the title and round the
 *    calories exactly like the DB index so the star-state check in the
 *    UI stays in sync with the DB.
 */

import type { FoodHistoryItem } from "./foodHistory";

/** One row as returned by `select * from user_favorite_foods`. */
export type FavoriteFood = FoodHistoryItem & {
  id: string;
  createdAt: string;
};

/** Minimal payload needed to star a meal. Shape accepts both the mobile
 * `JournalMeal` (uses `fiberG`) and the web `LoggedMeal`. */
export type FavoriteFoodInput = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  fiber?: number;
  source?: string | null;
  source_id?: string | null;
};

/** Cross-platform supabase-js shape — typed as `any` on purpose so this
 * file does not import from either workspace's database types. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = "23505";

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Canonical dedupe key — matches the DB unique index and
 * `foodHistoryKey` from `foodHistory.ts`. */
export function favoriteKey(title: string, calories: number): string {
  return `${String(title ?? "").trim().toLowerCase()}|${Math.round(safeNumber(calories))}`;
}

function rowToFavorite(row: any): FavoriteFood {
  return {
    id: String(row.id),
    recipeTitle: String(row.recipe_title ?? ""),
    calories: safeNumber(row.calories),
    protein: safeNumber(row.protein),
    carbs: safeNumber(row.carbs),
    fat: safeNumber(row.fat),
    ...(row.fiber != null ? { fiber: safeNumber(row.fiber) } : {}),
    ...(row.source ? { source: String(row.source) } : {}),
    count: 1,
    createdAt: String(row.created_at ?? ""),
    lastLoggedAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function normaliseInput(meal: FavoriteFoodInput): {
  recipe_title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  source: string | null;
  source_id: string | null;
} {
  const fiber =
    typeof meal.fiberG === "number"
      ? meal.fiberG
      : typeof meal.fiber === "number"
      ? meal.fiber
      : null;
  return {
    recipe_title: String(meal.recipeTitle ?? "").trim(),
    calories: Math.round(safeNumber(meal.calories)),
    protein: Math.round(safeNumber(meal.protein) * 10) / 10,
    carbs: Math.round(safeNumber(meal.carbs) * 10) / 10,
    fat: Math.round(safeNumber(meal.fat) * 10) / 10,
    fiber: fiber != null ? Math.round(fiber * 10) / 10 : null,
    source: meal.source ? String(meal.source) : null,
    source_id: meal.source_id ? String(meal.source_id) : null,
  };
}

/**
 * Fetch all of a user's favourite foods, newest first.
 * Returns an empty array if the call fails (callers render the empty
 * state rather than propagating — favourites are non-critical UX).
 */
export async function listFavorites(
  supabase: SupabaseLike,
  userId: string,
): Promise<FavoriteFood[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_favorite_foods")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map(rowToFavorite);
}

/**
 * Insert a favourite. On unique-violation we fetch and return the
 * existing row — same identity, no UI disruption.
 */
export async function addFavorite(
  supabase: SupabaseLike,
  userId: string,
  meal: FavoriteFoodInput,
): Promise<FavoriteFood> {
  if (!userId) throw new Error("addFavorite: userId is required");
  const row = normaliseInput(meal);
  if (!row.recipe_title) throw new Error("addFavorite: recipe title is required");

  const { data, error } = await supabase
    .from("user_favorite_foods")
    .insert({ ...row, user_id: userId })
    .select("*")
    .single();

  if (!error && data) return rowToFavorite(data);

  // Treat unique-violation as success — the favourite already exists.
  if (error && (error.code === PG_UNIQUE_VIOLATION || /duplicate key/i.test(String(error.message ?? "")))) {
    const { data: existing, error: fetchErr } = await supabase
      .from("user_favorite_foods")
      .select("*")
      .eq("user_id", userId)
      .eq("calories", row.calories)
      .ilike("recipe_title", row.recipe_title)
      .limit(1)
      .maybeSingle();
    if (!fetchErr && existing) return rowToFavorite(existing);
  }

  throw error ?? new Error("addFavorite: unknown Supabase error");
}

/** Delete a favourite row by id. */
export async function removeFavorite(
  supabase: SupabaseLike,
  userId: string,
  favoriteId: string,
): Promise<void> {
  if (!userId) throw new Error("removeFavorite: userId is required");
  if (!favoriteId) throw new Error("removeFavorite: favoriteId is required");
  const { error } = await supabase
    .from("user_favorite_foods")
    .delete()
    .eq("user_id", userId)
    .eq("id", favoriteId);
  if (error) throw error;
}

/**
 * Cheap check to decide whether a row should render its star filled.
 * Uses the same casing/rounding rule as the DB unique index.
 */
export async function isFavorite(
  supabase: SupabaseLike,
  userId: string,
  recipeTitle: string,
  calories: number,
): Promise<boolean> {
  if (!userId || !recipeTitle) return false;
  const cal = Math.round(safeNumber(calories));
  const { data, error } = await supabase
    .from("user_favorite_foods")
    .select("id")
    .eq("user_id", userId)
    .eq("calories", cal)
    .ilike("recipe_title", recipeTitle.trim())
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
