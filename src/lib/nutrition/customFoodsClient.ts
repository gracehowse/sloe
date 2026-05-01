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

import type { CustomFood, CustomFoodServing, CustomFoodSource } from "./customFoods";
import {
  dedupeServings,
  normaliseCustomFoodName,
  validateCustomFoodBarcode,
} from "./customFoods";

const VALID_CUSTOM_FOOD_SOURCES: ReadonlyArray<CustomFoodSource> = [
  "manual",
  "photo_correction",
  "voice_correction",
];

function safeSource(raw: unknown): CustomFoodSource {
  if (typeof raw === "string" && (VALID_CUSTOM_FOOD_SOURCES as readonly string[]).includes(raw)) {
    return raw as CustomFoodSource;
  }
  return "manual";
}

/** Supabase-js-compatible shape. Typed as `any` on purpose — this file
 * must import from neither workspace's generated types. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** Input for `createCustomFood` — all macro fields required (with zero
 * defaults enforced at the UI boundary), everything else optional. */
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
  /** Packaged-food display-only hint; not used in per-portion math. */
  servingsPerContainer?: number;
  /** Optional detailed micros. g for sugar / sat fat, mg for sodium. */
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  /** Optional barcode (EAN-8 / UPC-A / EAN-13 / GTIN-14 — digits only). */
  barcode?: string;
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
  servingsPerContainer: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  barcode: string | null;
}>;

const PG_UNIQUE_VIOLATION = "23505";
const DEDUPE_SUFFIX_LIMIT = 9; // appends " (2)" up to " (9)"

/**
 * Column list for list + search queries. Explicit (not `select("*")`)
 * so adding a heavy / unused column to `user_custom_foods` (e.g. a
 * denormalised photo JSON) doesn't silently balloon the list-panel
 * payload. Must stay in sync with `rowToCustomFood` — every column
 * read there needs to appear here. Detail / single-row fetches keep
 * `select("*")` because they're one-row roundtrips where the cost of
 * a future column is negligible. M7 (2026-04-21).
 */
const CUSTOM_FOOD_LIST_COLUMNS =
  "id, user_id, name, brand, base_grams, calories, protein, carbs, fat, fiber, servings, servings_per_container, sugar_g, saturated_fat_g, sodium_mg, barcode, source, created_at, updated_at";

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
  // Detailed micros + packaging fields (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`).
  if (
    row.servings_per_container != null &&
    Number.isFinite(Number(row.servings_per_container))
  ) {
    const v = safeNumber(row.servings_per_container);
    if (v > 0) food.servingsPerContainer = v;
  }
  if (row.sugar_g != null && Number.isFinite(Number(row.sugar_g))) {
    food.sugarG = safeNonNegative(row.sugar_g);
  }
  if (row.saturated_fat_g != null && Number.isFinite(Number(row.saturated_fat_g))) {
    food.saturatedFatG = safeNonNegative(row.saturated_fat_g);
  }
  if (row.sodium_mg != null && Number.isFinite(Number(row.sodium_mg))) {
    food.sodiumMg = safeNonNegative(row.sodium_mg);
  }
  if (typeof row.barcode === "string" && row.barcode.trim()) {
    food.barcode = row.barcode.trim();
  }
  // `source` is non-null in the DB (defaults to "manual") but we still
  // sanitise the read so a corrupt or missing value can never poison
  // the field — `safeSource` falls back to "manual" on anything
  // unrecognised. Older rows written before the source migration land
  // as "manual" automatically via the column default.
  if (row.source != null) {
    food.source = safeSource(row.source);
  }
  return food;
}

/**
 * Macros payload for `upsertCustomFoodFromPhotoCorrection`. Stored as
 * a "per-serving anchor" — the corrected macros describe the portion
 * the user photographed, not a per-100g basis. We persist with
 * `base_grams = 100` as a synthetic divisor only because the schema
 * requires one; no scaling happens on the read path (the photo-log
 * lookup uses the macros directly).
 */
export type PhotoCorrectionMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional. Stored only when the corrected item carried a finite
   *  fiber value (the project rule "never invent nutrition values"
   *  bars us from defaulting unknown fiber to 0). */
  fiber?: number;
};

/**
 * Upsert a corrected food into the user's personal food bank, keyed
 * on `(user_id, lower(name))`. Used by the photo-log review path:
 * after the user confirms a photo log with corrections, this writes
 * a `source: "photo_correction"` row so the next photo log of the
 * same item can suggest the corrected macros directly without
 * re-asking the AI.
 *
 * Idempotent — a second correction of the same food name overwrites
 * the previous macros (the user's most-recent intent wins). The
 * unique index `(user_id, lower(name))` enforces dedupe; we read the
 * existing row first, then UPDATE or INSERT accordingly. We do NOT
 * touch rows whose `source` is `manual` — a user's hand-curated
 * "Granola" should never be silently overwritten by a photo-log
 * correction with the same name. Manual rows return early with no
 * write so the user's curated entry stays canonical; the photo-log
 * still commits the meal because the helper is fire-and-forget.
 *
 * Returns the upserted row (or `null` when the user already has a
 * manual row with the same name — see above). Errors propagate so
 * the caller can fail-closed and skip the analytics emit.
 */
export async function upsertCustomFoodFromPhotoCorrection(
  supabase: SupabaseLike,
  userId: string,
  rawName: string,
  macros: PhotoCorrectionMacros,
): Promise<CustomFood | null> {
  if (!userId) throw new Error("upsertCustomFoodFromPhotoCorrection: userId is required");
  const name = normaliseCustomFoodName(rawName);
  if (!name) throw new Error("upsertCustomFoodFromPhotoCorrection: name is required");

  const calories = Math.round(safeNonNegative(macros.calories));
  const protein = Math.round(safeNonNegative(macros.protein) * 10) / 10;
  const carbs = Math.round(safeNonNegative(macros.carbs) * 10) / 10;
  const fat = Math.round(safeNonNegative(macros.fat) * 10) / 10;
  const fiber =
    macros.fiber != null && Number.isFinite(Number(macros.fiber))
      ? Math.round(safeNonNegative(macros.fiber) * 10) / 10
      : null;

  // Look up existing row by (user_id, lower(name)) — the unique index.
  // We can't use `ilike` here because Postgres `ilike` is case-fold but
  // not equal-case-insensitive; an exact `lower(name) = lower($1)` via
  // `ilike` with no wildcards is the same as a case-insensitive equality.
  const { data: existingRows } = await supabase
    .from("user_custom_foods")
    .select("id, source")
    .eq("user_id", userId)
    .ilike("name", name);
  const existing =
    Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

  // Carve-out: never overwrite a `manual` row. The user's hand-curated
  // food is the canonical record; an AI photo correction with the
  // same name should not stomp it.
  if (existing && safeSource((existing as { source?: unknown }).source) === "manual") {
    return null;
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    const update: Record<string, unknown> = {
      calories,
      protein,
      carbs,
      fat,
      fiber,
      source: "photo_correction" as CustomFoodSource,
      updated_at: nowIso,
    };
    const { data, error } = await supabase
      .from("user_custom_foods")
      .update(update)
      .eq("id", (existing as { id: string }).id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !data) {
      throw error ?? new Error("upsertCustomFoodFromPhotoCorrection: update returned no row");
    }
    return rowToCustomFood(data);
  }

  // Insert: synthetic `base_grams = 100` anchor — the macros describe
  // the photographed portion; the read path uses them directly without
  // scaling (see helper comment).
  const insertRow: Record<string, unknown> = {
    user_id: userId,
    name,
    base_grams: 100,
    calories,
    protein,
    carbs,
    fat,
    servings: [],
    source: "photo_correction" as CustomFoodSource,
  };
  if (fiber != null) insertRow.fiber = fiber;
  const { data, error } = await supabase
    .from("user_custom_foods")
    .insert(insertRow)
    .select("*")
    .single();
  if (error || !data) {
    throw error ?? new Error("upsertCustomFoodFromPhotoCorrection: insert returned no row");
  }
  return rowToCustomFood(data);
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
  if (
    input.servingsPerContainer != null &&
    Number.isFinite(Number(input.servingsPerContainer)) &&
    Number(input.servingsPerContainer) > 0
  ) {
    // Packaging hint — round to 2dp because labels commonly read "2.5
    // servings per container"; any more precision is spurious.
    row.servings_per_container = Math.round(Number(input.servingsPerContainer) * 100) / 100;
  }
  if (input.sugarG != null && Number.isFinite(Number(input.sugarG))) {
    row.sugar_g = Math.round(safeNonNegative(input.sugarG) * 10) / 10;
  }
  if (input.saturatedFatG != null && Number.isFinite(Number(input.saturatedFatG))) {
    row.saturated_fat_g = Math.round(safeNonNegative(input.saturatedFatG) * 10) / 10;
  }
  if (input.sodiumMg != null && Number.isFinite(Number(input.sodiumMg))) {
    // Sodium stored in mg, rounded to integer (labels report mg as whole).
    row.sodium_mg = Math.round(safeNonNegative(input.sodiumMg));
  }
  // Barcode is validated at the input boundary; reject a bad one loudly
  // rather than silently drop it — the user's intent was clearly "this
  // is the package".
  if (input.barcode != null) {
    const parsed = validateCustomFoodBarcode(input.barcode);
    if (!parsed.ok) {
      throw new Error(`createCustomFood: ${parsed.reason}`);
    }
    if (parsed.value) row.barcode = parsed.value;
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
    .select(CUSTOM_FOOD_LIST_COLUMNS)
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
  if (patch.servingsPerContainer !== undefined) {
    if (patch.servingsPerContainer == null) {
      update.servings_per_container = null;
    } else {
      const v = Number(patch.servingsPerContainer);
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error("updateCustomFood: servingsPerContainer must be > 0 or null");
      }
      update.servings_per_container = Math.round(v * 100) / 100;
    }
  }
  if (patch.sugarG !== undefined) {
    update.sugar_g =
      patch.sugarG == null || !Number.isFinite(Number(patch.sugarG))
        ? null
        : Math.round(safeNonNegative(patch.sugarG) * 10) / 10;
  }
  if (patch.saturatedFatG !== undefined) {
    update.saturated_fat_g =
      patch.saturatedFatG == null || !Number.isFinite(Number(patch.saturatedFatG))
        ? null
        : Math.round(safeNonNegative(patch.saturatedFatG) * 10) / 10;
  }
  if (patch.sodiumMg !== undefined) {
    update.sodium_mg =
      patch.sodiumMg == null || !Number.isFinite(Number(patch.sodiumMg))
        ? null
        : Math.round(safeNonNegative(patch.sodiumMg));
  }
  if (patch.barcode !== undefined) {
    if (patch.barcode == null) {
      update.barcode = null;
    } else {
      const parsed = validateCustomFoodBarcode(patch.barcode);
      if (!parsed.ok) {
        throw new Error(`updateCustomFood: ${parsed.reason}`);
      }
      update.barcode = parsed.value ?? null;
    }
  }

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
    .select(CUSTOM_FOOD_LIST_COLUMNS)
    .eq("user_id", userId)
    .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data)) return [];
  return data.map(rowToCustomFood);
}
