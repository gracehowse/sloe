/**
 * Saved meals (Batch 2.6) — Supabase CRUD for `public.user_saved_meals` and
 * `public.user_saved_meal_items`. A saved meal is a reusable **combo of
 * multiple foods** — e.g. "My usual breakfast" = oats + berries + protein
 * powder. This is intentionally different from:
 *   - `recipes`             — multi-step cooked things with ingredients
 *   - `user_favorite_foods` — single-item favourites (Batch 1.3)
 *
 * Shared by the web Quick Add panel (`saved-meals-tab.tsx`) and the mobile
 * Quick Add panel (inline in `apps/mobile/app/(tabs)/index.tsx`). No React,
 * no JSX; callers pass a supabase-js-compatible client so the same file
 * runs in Node for tests, browser for web, and React Native for mobile.
 *
 * Design notes:
 *  - Parent insert happens first, then items are inserted in a single
 *    batch keyed by `saved_meal_id`. If the items insert fails the caller
 *    is responsible for cleaning up the parent — callers here react by
 *    deleting the parent row before propagating the error, so the UI
 *    never sees a "zombie" saved meal with zero items.
 *  - `incrementLogCount` uses a read-then-write round-trip because we do
 *    not have an RPC for atomic increment. Concurrent double-taps in the
 *    UI are guarded by an optimistic local pending set; at worst two
 *    devices racing each other drop one count increment, which is
 *    acceptable for a sort-key counter.
 *  - Pure summary math lives in `savedMealsLogic.ts`; this file stays
 *    focused on I/O so the pure helpers remain trivially testable.
 */

/** Supabase-js-compatible shape. Typed as `any` on purpose — this file
 * must import from neither workspace's generated types. */
type SupabaseLike = {
  from: (table: string) => any;
};

/** One item inside a saved combo. `id` and `position` are server-assigned
 * after an insert; `portionMultiplier` defaults to `1`. Fiber and water
 * are optional because not every source provides them. */
export type SavedMealItem = {
  id?: string;
  position: number;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  waterMl?: number;
  portionMultiplier?: number;
  source?: string;
  sourceId?: string;
};

/** Parent row + its items in display order. */
export type SavedMeal = {
  id: string;
  name: string;
  defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
  items: SavedMealItem[];
  createdAt: string;
  lastLoggedAt?: string;
  logCount: number;
};

/** Input shape for `createSavedMeal` — the caller supplies items without
 * `id` or `position`; we assign `position = index` on insert. */
export type SavedMealInput = {
  name: string;
  defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
  items: Array<Omit<SavedMealItem, "id" | "position">>;
};

function safeNumber(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function safeNonNegative(n: unknown, fallback = 0): number {
  const v = safeNumber(n, fallback);
  return v >= 0 ? v : fallback;
}

function normaliseSlot(
  raw: unknown,
): "Breakfast" | "Lunch" | "Dinner" | "Snacks" | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (s === "Breakfast" || s === "Lunch" || s === "Dinner" || s === "Snacks") {
    return s;
  }
  return undefined;
}

function rowToItem(row: any): SavedMealItem {
  const item: SavedMealItem = {
    id: String(row.id),
    position: Math.max(0, Math.trunc(safeNumber(row.position, 0))),
    recipeTitle: String(row.recipe_title ?? ""),
    calories: safeNonNegative(row.calories),
    protein: safeNonNegative(row.protein),
    carbs: safeNonNegative(row.carbs),
    fat: safeNonNegative(row.fat),
    portionMultiplier:
      row.portion_multiplier != null && Number.isFinite(Number(row.portion_multiplier))
        ? Math.max(0.01, Number(row.portion_multiplier))
        : 1,
  };
  if (row.fiber != null && Number.isFinite(Number(row.fiber))) {
    item.fiber = safeNonNegative(row.fiber);
  }
  if (row.water_ml != null && Number.isFinite(Number(row.water_ml))) {
    item.waterMl = safeNonNegative(row.water_ml);
  }
  if (row.source) item.source = String(row.source);
  if (row.source_id) item.sourceId = String(row.source_id);
  return item;
}

function rowToMeal(row: any, items: SavedMealItem[]): SavedMeal {
  const meal: SavedMeal = {
    id: String(row.id),
    name: String(row.name ?? ""),
    items,
    createdAt: String(row.created_at ?? ""),
    logCount: Math.max(0, Math.trunc(safeNumber(row.log_count, 0))),
  };
  const slot = normaliseSlot(row.default_meal_slot);
  if (slot) meal.defaultMealSlot = slot;
  if (row.last_logged_at) meal.lastLoggedAt = String(row.last_logged_at);
  return meal;
}

/** Normalise an input item for DB insert. Clamps negatives to zero,
 * rounds macros to one decimal, trims title. `portionMultiplier`
 * defaults to 1 and must stay > 0. */
function itemToRow(
  savedMealId: string,
  position: number,
  item: Omit<SavedMealItem, "id" | "position">,
): Record<string, unknown> {
  const pm = item.portionMultiplier != null ? safeNumber(item.portionMultiplier, 1) : 1;
  const row: Record<string, unknown> = {
    saved_meal_id: savedMealId,
    position,
    recipe_title: String(item.recipeTitle ?? "").trim(),
    calories: Math.round(safeNonNegative(item.calories) * 10) / 10,
    protein: Math.round(safeNonNegative(item.protein) * 10) / 10,
    carbs: Math.round(safeNonNegative(item.carbs) * 10) / 10,
    fat: Math.round(safeNonNegative(item.fat) * 10) / 10,
    portion_multiplier: pm > 0 ? pm : 1,
  };
  if (item.fiber != null && Number.isFinite(Number(item.fiber))) {
    row.fiber = Math.round(safeNonNegative(item.fiber) * 10) / 10;
  }
  if (item.waterMl != null && Number.isFinite(Number(item.waterMl))) {
    row.water_ml = Math.round(safeNonNegative(item.waterMl));
  }
  if (item.source) row.source = String(item.source);
  if (item.sourceId) row.source_id = String(item.sourceId);
  return row;
}

/**
 * List all saved meals for a user, newest-re-logged first, then
 * newest-created. Items are joined in position order so callers render
 * them in the user's chosen sequence.
 *
 * Returns an empty array on error — the Quick Add panel falls back to
 * its other tabs rather than propagating the failure.
 */
export async function listSavedMeals(
  supabase: SupabaseLike,
  userId: string,
): Promise<SavedMeal[]> {
  if (!userId) return [];
  const { data: parentRows, error: parentErr } = await supabase
    .from("user_saved_meals")
    .select("*")
    .eq("user_id", userId)
    .order("last_logged_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (parentErr || !Array.isArray(parentRows) || parentRows.length === 0) return [];

  const parentIds = parentRows.map((r: any) => String(r.id));
  const { data: itemRows, error: itemsErr } = await supabase
    .from("user_saved_meal_items")
    .select("*")
    .in("saved_meal_id", parentIds)
    .order("position", { ascending: true });

  const itemsByMealId = new Map<string, SavedMealItem[]>();
  if (!itemsErr && Array.isArray(itemRows)) {
    for (const r of itemRows) {
      const key = String(r.saved_meal_id);
      const arr = itemsByMealId.get(key) ?? [];
      arr.push(rowToItem(r));
      itemsByMealId.set(key, arr);
    }
  }

  return parentRows.map((row: any) => rowToMeal(row, itemsByMealId.get(String(row.id)) ?? []));
}

/**
 * Create a saved meal with its items. Assigns `position = index`. If the
 * items insert fails, the parent is deleted to avoid a zombie row.
 * Throws the underlying Supabase error on failure.
 */
export async function createSavedMeal(
  supabase: SupabaseLike,
  userId: string,
  input: SavedMealInput,
): Promise<SavedMeal> {
  if (!userId) throw new Error("createSavedMeal: userId is required");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("createSavedMeal: name is required");
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("createSavedMeal: at least one item is required");
  }
  const slot = normaliseSlot(input.defaultMealSlot);

  const parentInsert: Record<string, unknown> = {
    user_id: userId,
    name,
    log_count: 0,
  };
  if (slot) parentInsert.default_meal_slot = slot;

  const { data: parentRow, error: parentErr } = await supabase
    .from("user_saved_meals")
    .insert(parentInsert)
    .select("*")
    .single();
  if (parentErr || !parentRow) {
    throw parentErr ?? new Error("createSavedMeal: parent insert failed");
  }

  const savedMealId = String((parentRow as any).id);
  const itemRows = input.items.map((it, idx) => itemToRow(savedMealId, idx, it));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from("user_saved_meal_items")
    .insert(itemRows)
    .select("*");

  if (itemsErr) {
    // Clean up the zombie parent so the UI doesn't list an empty combo.
    await supabase.from("user_saved_meals").delete().eq("id", savedMealId);
    throw itemsErr;
  }

  const items = Array.isArray(insertedItems)
    ? insertedItems
        .map(rowToItem)
        .sort((a, b) => a.position - b.position)
    : [];
  return rowToMeal(parentRow, items);
}

/** Rename a saved meal. Trims whitespace; rejects empty names. */
export async function renameSavedMeal(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  name: string,
): Promise<void> {
  if (!userId) throw new Error("renameSavedMeal: userId is required");
  if (!id) throw new Error("renameSavedMeal: id is required");
  const nextName = String(name ?? "").trim();
  if (!nextName) throw new Error("renameSavedMeal: name is required");
  const { error } = await supabase
    .from("user_saved_meals")
    .update({ name: nextName })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Delete a saved meal. Items cascade via FK `on delete cascade`. */
export async function deleteSavedMeal(
  supabase: SupabaseLike,
  userId: string,
  id: string,
): Promise<void> {
  if (!userId) throw new Error("deleteSavedMeal: userId is required");
  if (!id) throw new Error("deleteSavedMeal: id is required");
  const { error } = await supabase
    .from("user_saved_meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Increment `log_count` and set `last_logged_at = now()` for the given
 * combo. Called when the user taps the one-tap log button. Read-then-
 * write — concurrent writes from two devices may drop a count; this is
 * acceptable for a sort-key counter, not a billing counter.
 */
export async function incrementLogCount(
  supabase: SupabaseLike,
  userId: string,
  id: string,
): Promise<void> {
  if (!userId) throw new Error("incrementLogCount: userId is required");
  if (!id) throw new Error("incrementLogCount: id is required");
  const { data, error: readErr } = await supabase
    .from("user_saved_meals")
    .select("log_count")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw readErr;
  const current = data && Number.isFinite(Number((data as any).log_count))
    ? Number((data as any).log_count)
    : 0;
  const { error: writeErr } = await supabase
    .from("user_saved_meals")
    .update({
      log_count: current + 1,
      last_logged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (writeErr) throw writeErr;
}
