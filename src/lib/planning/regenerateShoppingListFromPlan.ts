// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig,
// which rejects `.ts` import paths).
//
// ENG-1527 — the shared "Update from plan" re-sync. When the meal plan changes
// after a shopping list has already been generated, the list goes stale (the
// `· plan changed since` subtitle). Re-running the plan generator's
// delete-and-replace would clobber every checked-off row + household-mate manual
// addition. This module regenerates the list from the current plan and persists
// ONLY the delta (INSERT new rows, UPDATE changed quantities — preserving
// `checked` — DELETE rows for recipes no longer in the plan), leaving checked
// rows and manual (empty-`source`) additions untouched. Both web
// (`ShoppingList` via `AppDataContext`) and mobile (`shopping.tsx`) call
// `regenerateShoppingListFromPlan` so the semantics are identical by
// construction.
import type { DayPlan } from "../../types/recipe";
import { fingerprintMealPlanForShopping } from "./mealPlanFingerprint";
import {
  generateShoppingListFromRecipeEntries,
  shoppingListIngredientMultiplier,
  type RecipeIngredientRow,
} from "./generateShoppingList";
import { isMealPlanPlaceholderLikeTitle } from "../nutrition/portionMultiplier";
import { filterShoppingItemsByPantry } from "./pantryStaples";
import { shoppingMergeKey } from "./shoppingMergePrimitives";
import {
  shoppingScopeInsertStamp,
  shoppingScopeReadFilters,
  type ShoppingScope,
} from "../household/shoppingScope";

// ── Pure reconciliation ──────────────────────────────────────────────────────

/** An existing persisted `shopping_items` row (only the fields the merge needs). */
export interface ReconcileExistingRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
  checked: boolean;
  /** Comma-separated recipe titles. `""` = manual / household addition. */
  source: string;
}

/** A freshly generated target row (from {@link generateShoppingListFromRecipeEntries}). */
export interface ReconcileGeneratedItem {
  name: string;
  amount: string;
  unit: string;
  category: string;
  from: string;
}

export interface ShoppingListReconcilePlan {
  /** Generated rows with no existing match → INSERT (unchecked). */
  inserts: ReconcileGeneratedItem[];
  /** Existing plan rows whose quantity/source changed → UPDATE (keeps `checked`). */
  updates: Array<{ id: string; amount: string; source: string }>;
  /** Existing plan-sourced rows for recipes no longer in the plan → DELETE. */
  deletes: string[];
  /** Manual (empty-`source`) rows preserved untouched — household/custom additions. */
  keptManualCount: number;
  /** Matched rows that stayed checked — surfaced for the success message. */
  keptCheckedCount: number;
}

/**
 * Diff the current persisted list against the freshly generated target and
 * decide the minimal set of writes that preserves user state.
 *
 * Rules:
 *  - Generated item matches an existing row (same normalised name + unit) →
 *    UPDATE the row's amount/source; `checked`/`checked_by` are left alone.
 *  - Generated item with no match → INSERT a new unchecked row.
 *  - Existing row with no matching generated item:
 *      · empty `source` → it's a manual / household addition → KEEP untouched.
 *      · non-empty `source` → it came from a recipe that's gone from the plan
 *        (or became a pantry staple) → DELETE.
 *
 * Existing rows are matched first-wins per merge key; the generator already
 * collapses duplicates so a target key is unique, and a manual row that happens
 * to collide with a plan key is a benign edge (it adopts the plan quantity).
 */
export function reconcileShoppingListFromPlan(input: {
  existing: readonly ReconcileExistingRow[];
  generated: readonly ReconcileGeneratedItem[];
}): ShoppingListReconcilePlan {
  const existingByKey = new Map<string, ReconcileExistingRow>();
  for (const row of input.existing) {
    const key = shoppingMergeKey(row.name, row.unit);
    if (!existingByKey.has(key)) existingByKey.set(key, row);
  }

  const inserts: ReconcileGeneratedItem[] = [];
  const updates: Array<{ id: string; amount: string; source: string }> = [];
  const matchedIds = new Set<string>();
  const seenGenKeys = new Set<string>();

  for (const gen of input.generated) {
    const key = shoppingMergeKey(gen.name, gen.unit);
    if (seenGenKeys.has(key)) continue; // generator merges by key; guard dupes
    seenGenKeys.add(key);
    const match = existingByKey.get(key);
    if (!match) {
      inserts.push(gen);
      continue;
    }
    matchedIds.add(match.id);
    if (match.amount !== gen.amount || match.source !== gen.from) {
      updates.push({ id: match.id, amount: gen.amount, source: gen.from });
    }
  }

  const deletes: string[] = [];
  let keptManualCount = 0;
  let keptCheckedCount = 0;
  for (const row of input.existing) {
    if (matchedIds.has(row.id)) {
      if (row.checked) keptCheckedCount += 1;
      continue;
    }
    if (row.source.trim() === "") {
      keptManualCount += 1; // manual / household addition — preserve
      continue;
    }
    deletes.push(row.id); // plan-sourced but gone from the plan → stale
  }

  return { inserts, updates, deletes, keptManualCount, keptCheckedCount };
}

// ── Host orchestration ───────────────────────────────────────────────────────

type QueryResult = { data: Array<Record<string, unknown>> | null; error: { message?: string } | null };

interface FilterBuilder extends PromiseLike<QueryResult> {
  eq: (col: string, val: string) => FilterBuilder;
  is: (col: string, val: null) => FilterBuilder;
  in: (col: string, vals: string[]) => FilterBuilder;
  order: (col: string, opts: { ascending: boolean }) => FilterBuilder;
}

type ShoppingInsertRow = {
  user_id: string;
  household_id: string | null;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  source: string;
};

/** Minimal structural client shape — both the web + mobile supabase clients satisfy it. */
export interface RegenShoppingClient {
  from: (table: string) => {
    select: (cols: string) => FilterBuilder;
    insert: (rows: ShoppingInsertRow[]) => PromiseLike<{ error: { message?: string } | null }>;
    update: (patch: { amount?: string; source?: string }) => {
      eq: (col: string, val: string) => PromiseLike<{ error: { message?: string } | null }>;
    };
    delete: () => {
      in: (col: string, vals: string[]) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
}

export type RegenerateShoppingListResult =
  | {
      ok: true;
      addedCount: number;
      updatedCount: number;
      removedCount: number;
      keptManualCount: number;
      keptCheckedCount: number;
      /** Fingerprint of the plan the list now reflects — caller persists it. */
      planFingerprint: string;
      /** Plan anchor (day-0 `start_date`) for the subtitle, or `null`. */
      planStartDate: string | null;
    }
  | { ok: false; error: string };

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

/**
 * Regenerate the shopping list from the current plan NON-destructively.
 *
 * Reads the plan (`meal_plan_days` + `meal_plan_meals`) for the given slot,
 * resolves each planned recipe's ingredients + servings, runs the shared
 * generator (pantry staples filtered out), then reconciles against the live
 * `shopping_items` for the scope and persists only the delta. Returns counts +
 * the new plan fingerprint / anchor so the caller can clear the out-of-sync flag.
 */
export async function regenerateShoppingListFromPlan(input: {
  client: RegenShoppingClient;
  scope: ShoppingScope;
  /** Cloud `meal_plan_days.slot_id` of the active plan slot. */
  planSlotId: string;
  pantryStaples: readonly string[];
}): Promise<RegenerateShoppingListResult> {
  const { client, scope, planSlotId, pantryStaples } = input;
  const userId = scope.userId;

  // 1. Read the plan days for the active slot.
  const dayRes = await client
    .from("meal_plan_days")
    .select("id, day, start_date")
    .eq("user_id", userId)
    .eq("slot_id", planSlotId)
    .order("day", { ascending: true });
  if (dayRes.error) return { ok: false, error: dayRes.error.message ?? "plan read failed" };
  const dayRows = dayRes.data ?? [];
  if (dayRows.length === 0) return { ok: false, error: "No active plan to update from" };

  const dayById = new Map<string, { day: number }>();
  for (const d of dayRows) dayById.set(toStr(d.id), { day: Number(d.day ?? 0) });
  const planStartDate = (() => {
    const raw = toStr(dayRows[0]!.start_date);
    return raw.length >= 10 ? raw.slice(0, 10) : null;
  })();

  // 2. Read the meals for those days.
  const mealRes = await client
    .from("meal_plan_meals")
    .select("plan_day_id, slot_index, recipe_title, recipe_id, portion_multiplier, is_placeholder")
    .in("plan_day_id", [...dayById.keys()]);
  if (mealRes.error) return { ok: false, error: mealRes.error.message ?? "plan meals read failed" };
  const mealRows = mealRes.data ?? [];

  // 3. Resolve servings for the referenced recipes (portion ÷ servings scaling).
  const recipeIds = [
    ...new Set(mealRows.map((m) => toStr(m.recipe_id)).filter(Boolean)),
  ];
  const servingsById = new Map<string, number>();
  if (recipeIds.length > 0) {
    const recRes = await client.from("recipes").select("id, servings").in("id", recipeIds);
    if (recRes.error) return { ok: false, error: recRes.error.message ?? "recipe read failed" };
    for (const r of recRes.data ?? []) {
      const s = Number(r.servings);
      if (Number.isFinite(s) && s > 0) servingsById.set(toStr(r.id), s);
    }
  }

  // 4. Build the shared generator's entries (portion-scaled), skipping
  //    placeholder + title-less slots exactly as the plan generator does.
  const entries: Array<{ title: string; multiplier: number }> = [];
  const titleToIdMap = new Map<string, string>();
  for (const m of mealRows) {
    const title = toStr(m.recipe_title);
    const recipeId = toStr(m.recipe_id);
    if (
      !title ||
      !recipeId ||
      isMealPlanPlaceholderLikeTitle(title, { isPlaceholder: Boolean(m.is_placeholder) })
    ) {
      continue;
    }
    if (!titleToIdMap.has(title)) titleToIdMap.set(title, recipeId);
    const pm =
      m.portion_multiplier != null ? Number(m.portion_multiplier) : undefined;
    entries.push({
      title,
      multiplier: shoppingListIngredientMultiplier(pm, servingsById.get(recipeId)),
    });
  }
  if (entries.length === 0) return { ok: false, error: "No recipes in the current plan" };

  // 5. Fetch ingredients once and generate the target list.
  const uniqueIds = [...new Set([...titleToIdMap.values()])];
  const ingRes = await client
    .from("recipe_ingredients")
    .select("recipe_id, name, amount, unit")
    .in("recipe_id", uniqueIds);
  if (ingRes.error) return { ok: false, error: ingRes.error.message ?? "ingredient read failed" };
  const ingredientsByRecipeId = new Map<string, RecipeIngredientRow[]>();
  for (const row of ingRes.data ?? []) {
    const rid = toStr(row.recipe_id);
    if (!rid) continue;
    const bucket = ingredientsByRecipeId.get(rid) ?? [];
    bucket.push({ name: toStr(row.name), amount: toStr(row.amount), unit: toStr(row.unit) });
    ingredientsByRecipeId.set(rid, bucket);
  }
  const generatedRaw = generateShoppingListFromRecipeEntries({
    entries,
    recipeTitleToId: (title) => titleToIdMap.get(title) ?? null,
    ingredientsByRecipeId,
  });
  const generated = filterShoppingItemsByPantry(generatedRaw, pantryStaples);

  // 6. Read the live list for the scope and reconcile.
  let chain = client
    .from("shopping_items")
    .select("id, name, amount, unit, category, checked, source");
  for (const [col, op, val] of shoppingScopeReadFilters(scope)) {
    chain = op === "is" ? chain.is(col, val) : chain.eq(col, val as string);
  }
  const listRes = await chain;
  if (listRes.error) return { ok: false, error: listRes.error.message ?? "list read failed" };
  const existing: ReconcileExistingRow[] = (listRes.data ?? []).map((r) => ({
    id: toStr(r.id),
    name: toStr(r.name),
    amount: toStr(r.amount),
    unit: toStr(r.unit),
    checked: Boolean(r.checked),
    source: toStr(r.source),
  }));

  const plan = reconcileShoppingListFromPlan({
    existing,
    generated: generated.map((g) => ({
      name: g.name,
      amount: g.amount,
      unit: g.unit,
      category: g.category,
      from: g.from,
    })),
  });

  // 7. Persist the delta — deletes first (so a key that moves rows never
  //    duplicates), then updates (preserve checked), then inserts.
  if (plan.deletes.length > 0) {
    for (let i = 0; i < plan.deletes.length; i += 50) {
      const { error } = await client
        .from("shopping_items")
        .delete()
        .in("id", plan.deletes.slice(i, i + 50));
      if (error) return { ok: false, error: error.message ?? "delete failed" };
    }
  }
  for (const u of plan.updates) {
    const { error } = await client
      .from("shopping_items")
      .update({ amount: u.amount, source: u.source })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message ?? "update failed" };
  }
  if (plan.inserts.length > 0) {
    const stamp = shoppingScopeInsertStamp(scope);
    const rows: ShoppingInsertRow[] = plan.inserts.map((it) => ({
      user_id: stamp.user_id,
      household_id: stamp.household_id,
      name: it.name,
      amount: it.amount,
      unit: it.unit,
      category: it.category,
      checked: false,
      source: it.from,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await client.from("shopping_items").insert(rows.slice(i, i + 50));
      if (error) return { ok: false, error: error.message ?? "insert failed" };
    }
  }

  // 8. Fingerprint the plan the list now reflects. Reconstruct the in-memory
  //    plan shape the planner fingerprints (meals sorted by slot_index,
  //    placeholders stripped, portionMultiplier dropped) so the caller's stored
  //    fingerprint matches the planner's — no false "plan changed" on next edit.
  const mealsByDay = new Map<number, Array<{ slotIndex: number; title: string; isPlaceholder: boolean }>>();
  for (const m of mealRows) {
    const meta = dayById.get(toStr(m.plan_day_id));
    if (!meta) continue;
    const bucket = mealsByDay.get(meta.day) ?? [];
    bucket.push({
      slotIndex: Number(m.slot_index ?? 0),
      title: toStr(m.recipe_title),
      isPlaceholder: Boolean(m.is_placeholder),
    });
    mealsByDay.set(meta.day, bucket);
  }
  const fingerprintPlan = [...mealsByDay.entries()].map(([day, meals]) => ({
    day,
    meals: meals
      .slice()
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .filter((m) => !isMealPlanPlaceholderLikeTitle(m.title, { isPlaceholder: m.isPlaceholder }))
      .map((m) => ({ recipeTitle: m.title, portionMultiplier: undefined, isPlaceholder: false })),
  })) as unknown as DayPlan[];

  return {
    ok: true,
    addedCount: plan.inserts.length,
    updatedCount: plan.updates.length,
    removedCount: plan.deletes.length,
    keptManualCount: plan.keptManualCount,
    keptCheckedCount: plan.keptCheckedCount,
    planFingerprint: fingerprintMealPlanForShopping(fingerprintPlan),
    planStartDate,
  };
}
