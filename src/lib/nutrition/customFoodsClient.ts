/**
 * Custom foods (Batch 3.9) — Supabase CRUD for `public.user_custom_foods`.
 *
 * Shared between web (`FoodSearch.tsx` custom-food entry point,
 * `CreateCustomFoodDialog`) and mobile (`FoodSearchModal.tsx`,
 * `CreateCustomFoodSheet.tsx`). No React, no JSX; callers pass a
 * supabase-js-compatible client so the same file runs in Node for
 * tests, browser for web, and React Native for mobile.
 *
 * Design notes:
 *  - Unique-violation on `(user_id, lower(name))` is handled by
 *    appending " (2)" … " (9)" to the name; beyond that we surface
 *    the error so the UI can prompt the user to rename.
 *  - `updateCustomFood` and `deleteCustomFood` scope the query to
 *    both `id` and `user_id` so even with a stale auth session the
 *    request can never land on another user's row.
 *  - `searchCustomFoods` uses an `or(ilike)` across name + brand so
 *    the food-search panel can surface a user's "Local bakery" custom
 *    even when they typed the brand.
 */

import type { CustomFood, CustomFoodServing } from "./customFoods";
import { dedupeServings, normaliseCustomFoodName } from "./customFoods";

/** Supabase-js-compatible shape. Typed as `any` on purpose — this file
 * must import from neither workspace's generated types. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** Input for `createCustomFood` — all macro fields required (with zero
 * defaults enforced at the UI boundary), `servings` optional. */
export type CreateCustomFoodInput = {
  name: string;
  brand?: string;
  baseGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings?: CustomFoodServing[];
};

/** Partial update — every field optional, undefined fields left alone. */
export type UpdateCustomFoodPatch = Partial<{
  name: string;
  brand: string | null;
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  servings: CustomFoodServing[];
}>;

const PG_UNIQUE_VIOLATION = "23505";
const DEDUPE_SUFFIX_LIMIT = 9; // appends " (2)" up to " (9)"

function safeNumber(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function safeNonNegative(n: unknown, fallback = 0): number {
  const v = safeNumber(n, fallback);
  return v >= 0 ? v : fallback;
}

function rowToCustomFood(row: any): CustomFood {
  const rawServings = Array.isArray(row.servings) ? row.servings : [];
  const servings: CustomFoodServing[] = rawServings
    .map((s: any) => ({
      label: String(s?.label ?? "").trim(),
      grams: safeNonNegative(s?.grams),
    }))
    .filter((s: CustomFoodServing) => s.label.length > 0 && s.grams > 0);

  const food: CustomFood = {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name ?? ""),
    baseGrams: (() => {
      const b = safeNumber(row.base_grams, 100);
      return b > 0 ? b : 100;
    })(),
    calories: safeNonNegative(row.calories),
    protein: safeNonNegative(row.protein),
    carbs: safeNonNegative(row.carbs),
    fat: safeNonNegative(row.fat),
    servings,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
  };
  if (row.brand) food.brand = String(row.brand);
  if (row.fiber != null && Number.isFinite(Number(row.fiber))) {
    food.fiber = safeNonNegative(row.fiber);
  }
  return food;
}

/** Normalise + round the macro payload once so UI, tests, and DB all
 * agree on precision (kcal integer; macros one decimal). */
function payloadForInsert(userId: string, input: CreateCustomFoodInput, nameOverride?: string) {
  const name = normaliseCustomFoodName(nameOverride ?? input.name);
  const brand = typeof input.brand === "string" ? input.brand.trim() : "";
  const baseGrams = (() => {
    const b = safeNumber(input.baseGrams, 100);
    return b > 0 ? b : 100;
  })();
  const servings = dedupeServings(input.servings ?? []);
  const row: Record<string, unknown> = {
    user_id: userId,
    name,
    base_grams: baseGrams,
    calories: Math.round(safeNonNegative(input.calories)),
    protein: Math.round(safeNonNegative(input.protein) * 10) / 10,
    carbs: Math.round(safeNonNegative(input.carbs) * 10) / 10,
    fat: Math.round(safeNonNegative(input.fat) * 10) / 10,
    servings,
  };
  if (brand) row.brand = brand;
  if (input.fiber != null && Number.isFinite(Number(input.fiber))) {
    row.fiber = Math.round(safeNonNegative(input.fiber) * 10) / 10;
  }
  return row;
}

/**
 * List all of a user's custom foods, most-recently-updated first.
 * Returns `[]` on error — the food-search panel falls back to its
 * other tabs rather than propagating the failure.
 */
export async function listCustomFoods(
  supabase: SupabaseLike,
  userId: string,
): Promise<CustomFood[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_custom_foods")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map(rowToCustomFood);
}

/**
 * Create a custom food. On unique-violation we retry with " (2)",
 * " (3)", … up to " (9)" appended; beyond that we surface the
 * underlying error so the UI can prompt the user to rename.
 */
export async function createCustomFood(
  supabase: SupabaseLike,
  userId: string,
  input: CreateCustomFoodInput,
): Promise<CustomFood> {
  if (!userId) throw new Error("createCustomFood: userId is required");
  const baseName = normaliseCustomFoodName(input.name);
  if (!baseName) throw new Error("createCustomFood: name is required");

  let attempt = 1;
  let lastError: unknown = null;
  while (attempt <= DEDUPE_SUFFIX_LIMIT) {
    const name = attempt === 1 ? baseName : `${baseName} (${attempt})`;
    const payload = payloadForInsert(userId, input, name);
    const { data, error } = await supabase
      .from("user_custom_foods")
      .insert(payload)
      .select("*")
      .single();
    if (!error && data) return rowToCustomFood(data);
    lastError = error;
    const isUniqueViolation =
      error &&
      (error.code === PG_UNIQUE_VIOLATION ||
        /duplicate key|unique/i.test(String(error.message ?? "")));
    if (!isUniqueViolation) break;
    attempt += 1;
  }
  throw lastError ?? new Error("createCustomFood: unknown Supabase error");
}

/**
 * Update a custom food owned by `userId`. Fields not present in
 * `patch` are left unchanged. Scopes the update to `(id, user_id)`
 * so a stale session can never touch another user's row.
 */
export async function updateCustomFood(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  patch: UpdateCustomFoodPatch,
): Promise<CustomFood> {
  if (!userId) throw new Error("updateCustomFood: userId is required");
  if (!id) throw new Error("updateCustomFood: id is required");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const n = normaliseCustomFoodName(patch.name);
    if (!n) throw new Error("updateCustomFood: name cannot be empty");
    update.name = n;
  }
  if (patch.brand !== undefined) {
    update.brand = patch.brand == null ? null : String(patch.brand).trim() || null;
  }
  if (patch.baseGrams !== undefined) {
    const b = safeNumber(patch.baseGrams);
    if (!(b > 0)) throw new Error("updateCustomFood: baseGrams must be > 0");
    update.base_grams = b;
  }
  if (patch.calories !== undefined) update.calories = Math.round(safeNonNegative(patch.calories));
  if (patch.protein !== undefined) update.protein = Math.round(safeNonNegative(patch.protein) * 10) / 10;
  if (patch.carbs !== undefined) update.carbs = Math.round(safeNonNegative(patch.carbs) * 10) / 10;
  if (patch.fat !== undefined) update.fat = Math.round(safeNonNegative(patch.fat) * 10) / 10;
  if (patch.fiber !== undefined) {
    update.fiber =
      patch.fiber == null || !Number.isFinite(Number(patch.fiber))
        ? null
        : Math.round(safeNonNegative(patch.fiber) * 10) / 10;
  }
  if (patch.servings !== undefined) update.servings = dedupeServings(patch.servings);

  const { data, error } = await supabase
    .from("user_custom_foods")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("updateCustomFood: update returned no row");
  return rowToCustomFood(data);
}

/** Delete a custom food. Scoped to `(id, user_id)`. */
export async function deleteCustomFood(
  supabase: SupabaseLike,
  userId: string,
  id: string,
): Promise<void> {
  if (!userId) throw new Error("deleteCustomFood: userId is required");
  if (!id) throw new Error("deleteCustomFood: id is required");
  const { error } = await supabase
    .from("user_custom_foods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Case-insensitive `ilike` across `name` + `brand` for a user's custom
 * foods. Used by the food-search panel to surface "Custom" matches at
 * the top. Returns `[]` for empty queries.
 */
export async function searchCustomFoods(
  supabase: SupabaseLike,
  userId: string,
  query: string,
): Promise<CustomFood[]> {
  if (!userId) return [];
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return [];
  // Escape PostgREST `or()` wildcards — comma / parenthesis would be
  // treated as filter boundaries. Accept alphanumerics + space + hyphen.
  const safe = q.replace(/[^\p{L}\p{N}\s\-']/gu, " ").replace(/\s+/g, " ").trim();
  if (!safe) return [];
  const pattern = `%${safe}%`;
  const { data, error } = await supabase
    .from("user_custom_foods")
    .select("*")
    .eq("user_id", userId)
    .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data)) return [];
  return data.map(rowToCustomFood);
}
