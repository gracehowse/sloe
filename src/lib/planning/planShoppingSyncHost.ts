// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
// ENG-957 — the platform-agnostic host glue for the plan→shopping-list re-sync.
// Both web (AppDataContext) and mobile (planner.tsx) call `runPlanShoppingSync`
// so the ingredient fetch + client sync + analytics payload are identical by
// construction (no divergent reimplementation). The host supplies a supabase
// client, the shopping scope, and an edit described by recipe *ids* (+ scaled
// multipliers); this module resolves each id's ingredient lines and drives the
// shared `syncPlanEditToShoppingListClient`.
import type { ShoppingScope } from "../household/shoppingScope";
import type { RecipeIngredientLine } from "./appendRecipeToShoppingList";
import { shoppingListIngredientMultiplier } from "./generateShoppingList";
import {
  syncPlanEditToShoppingListClient,
  type SyncPlanEditClientResult,
} from "./syncPlanEditToShoppingListClient";
import type { PlanShoppingEdit, PlanSyncRecipe } from "./syncPlanEditToShoppingList";

/** A planned recipe reference the host resolves ingredients for. */
export type PlanSyncRecipeRef = {
  id: string;
  title: string;
  /** portion ÷ servings scale for this planned meal; defaults to 1. */
  multiplier?: number;
};

/** Edit described by recipe *ids* — the host-facing shape. */
export type PlanShoppingEditRef =
  | { kind: "add"; recipe: PlanSyncRecipeRef }
  | { kind: "remove"; recipe: PlanSyncRecipeRef }
  | { kind: "swap"; out: PlanSyncRecipeRef; in: PlanSyncRecipeRef };

/** Minimal client shape needed to fetch recipe ingredients. */
type IngredientFetchClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{
        data: Array<{ recipe_id?: string | null; name?: string | null; amount?: number | string | null; unit?: string | null }> | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export type RunPlanShoppingSyncResult =
  | ({
      ok: true;
      /** editKind for the analytics payload. */
      editKind: PlanShoppingEdit["kind"];
    } & Omit<Extract<SyncPlanEditClientResult, { ok: true }>, "ok">)
  | { ok: false; error: string }
  /** Nothing to do (no resolvable recipe ids) — a silent no-op, not an error. */
  | { ok: true; editKind: PlanShoppingEdit["kind"]; skipped: true };

function editRecipeIds(edit: PlanShoppingEditRef): string[] {
  if (edit.kind === "swap") return [edit.out.id, edit.in.id];
  return [edit.recipe.id];
}

async function fetchIngredientsByRecipeId(
  client: IngredientFetchClient,
  recipeIds: readonly string[],
): Promise<{ map: Map<string, RecipeIngredientLine[]>; error?: string }> {
  const ids = [...new Set(recipeIds.filter(Boolean))];
  const map = new Map<string, RecipeIngredientLine[]>();
  if (ids.length === 0) return { map };
  const { data, error } = await client
    .from("recipe_ingredients")
    .select("recipe_id, name, amount, unit")
    .in("recipe_id", ids);
  if (error) return { map, error: error.message ?? "ingredient fetch failed" };
  for (const row of data ?? []) {
    const rid = String(row.recipe_id ?? "");
    if (!rid) continue;
    const bucket = map.get(rid) ?? [];
    bucket.push({
      name: String(row.name ?? ""),
      amount: row.amount != null ? String(row.amount) : "",
      unit: String(row.unit ?? ""),
    });
    map.set(rid, bucket);
  }
  return { map };
}

function toSyncRecipe(
  ref: PlanSyncRecipeRef,
  map: Map<string, RecipeIngredientLine[]>,
): PlanSyncRecipe | null {
  const ingredients = map.get(ref.id);
  if (!ingredients || ingredients.length === 0) return null;
  return { title: ref.title, ingredients, multiplier: ref.multiplier };
}

/**
 * Resolve a ref-shaped edit's ingredients and drive the shared client sync.
 * Returns `{ ok, skipped: true }` when no recipe in the edit has ingredient
 * data (nothing to sync) so the host can stay silent rather than toast an error.
 */
export async function runPlanShoppingSync(input: {
  client: IngredientFetchClient & Parameters<typeof syncPlanEditToShoppingListClient>[0]["client"];
  scope: ShoppingScope;
  edit: PlanShoppingEditRef;
}): Promise<RunPlanShoppingSyncResult> {
  const { client, scope, edit } = input;
  const { map, error } = await fetchIngredientsByRecipeId(client, editRecipeIds(edit));
  if (error) return { ok: false, error };

  let resolved: PlanShoppingEdit | null = null;
  if (edit.kind === "swap") {
    const out = toSyncRecipe(edit.out, map);
    const inc = toSyncRecipe(edit.in, map);
    // A swap with no ingredient data on either side has nothing to reconcile.
    if (!out && !inc) return { ok: true, editKind: "swap", skipped: true };
    // Degrade a half-resolvable swap to the resolvable half so we still reconcile.
    if (out && inc) resolved = { kind: "swap", out, in: inc };
    else if (out) resolved = { kind: "remove", recipe: out };
    else if (inc) resolved = { kind: "add", recipe: inc };
  } else {
    const recipe = toSyncRecipe(edit.recipe, map);
    if (!recipe) return { ok: true, editKind: edit.kind, skipped: true };
    resolved = { kind: edit.kind, recipe };
  }

  if (!resolved) return { ok: true, editKind: edit.kind, skipped: true };

  const res = await syncPlanEditToShoppingListClient({ client, scope, edit: resolved });
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    editKind: edit.kind,
    items: res.items,
    addedCount: res.addedCount,
    mergedCount: res.mergedCount,
    decrementedCount: res.decrementedCount,
    removedCount: res.removedCount,
  };
}

/** A planned meal + its recipe's servings, for building a sync edit descriptor. */
type PlanMealForSync = {
  recipeId?: string | null;
  recipeTitle?: string | null;
  portionMultiplier?: number;
  servings?: number;
};

/** A recipe in the swap pool — id + title + optional servings (for scaling). */
type PlanSwapPoolRecipe = { id: string; title: string; servings?: number };

/**
 * Build a SWAP edit from the outgoing meal and the incoming recipe, resolving
 * each recipe's servings from `pool` and computing its shopping multiplier
 * (portion ÷ servings). The incoming meal always resets to portion 1 on a plan
 * swap (matching both hosts' plan write), so its multiplier is `1 ÷ servings`.
 * Returns `null` when the outgoing meal has no resolvable recipe (nothing to
 * reconcile) — keeps the host call a one-liner across web + mobile.
 */
export function buildPlanSwapEdit(
  outgoing: PlanMealForSync | undefined | null,
  incoming: PlanSwapPoolRecipe,
  pool?: readonly PlanSwapPoolRecipe[],
): PlanShoppingEditRef | null {
  if (!outgoing?.recipeId || !outgoing.recipeTitle) return null;
  const outServings =
    outgoing.servings ?? pool?.find((r) => r.id === outgoing.recipeId)?.servings;
  return {
    kind: "swap",
    out: {
      id: outgoing.recipeId,
      title: outgoing.recipeTitle,
      multiplier: shoppingListIngredientMultiplier(outgoing.portionMultiplier, outServings),
    },
    in: {
      id: incoming.id,
      title: incoming.title,
      multiplier: shoppingListIngredientMultiplier(1, incoming.servings),
    },
  };
}

/** Analytics payload for `plan_shopping_synced` — no PII, no ingredient names. */
export function planShoppingSyncedPayload(
  result: Extract<RunPlanShoppingSyncResult, { ok: true; skipped?: undefined }>,
  platform: "web" | "mobile",
): {
  editKind: PlanShoppingEdit["kind"];
  addedCount: number;
  mergedCount: number;
  decrementedCount: number;
  removedCount: number;
  platform: "web" | "mobile";
} {
  return {
    editKind: result.editKind,
    addedCount: result.addedCount,
    mergedCount: result.mergedCount,
    decrementedCount: result.decrementedCount,
    removedCount: result.removedCount,
    platform,
  };
}
