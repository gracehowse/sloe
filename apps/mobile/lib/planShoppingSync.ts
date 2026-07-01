// ENG-957 — mobile-side glue for the plan→shopping-list edit-driven re-sync.
// The shared engine + client + host orchestrator live in `@suppr/shared/planning`
// (reused verbatim by web); this thin wrapper binds the mobile supabase client,
// the flag gate, and analytics so the pinned planner screen adds a single call.
import { supabase } from "@/lib/supabase";
import { isFeatureEnabled, track } from "@/lib/analytics";
import type { ShoppingScope } from "@suppr/shared/household/shoppingScope";
import { shoppingListIngredientMultiplier as planPortionMultiplier } from "@suppr/shared/planning/generateShoppingList";
import {
  runPlanShoppingSync,
  planShoppingSyncedPayload,
  buildPlanSwapEdit,
  type PlanShoppingEditRef,
} from "@suppr/shared/planning/planShoppingSyncHost";

export { buildPlanSwapEdit };
export type { PlanShoppingEditRef };

/**
 * Reconcile the shopping list to a single plan edit (add / remove / swap),
 * flag-gated behind `plan_shopping_sync_v1`. Fire-and-forget from the host —
 * no-op (silently) when the flag is off, the user is signed out, or there's
 * nothing to sync. Never a full delete-and-replace, so checked rows + a
 * household-mate's manual additions survive. Emits `plan_shopping_synced`.
 *
 * @returns the new shopping-item count when the caller wants to refresh its
 *   local badge, or `null` when the sync was skipped / gated off.
 */
export async function syncPlanEditToShoppingList(
  scope: ShoppingScope | null,
  edit: PlanShoppingEditRef,
): Promise<number | null> {
  if (!isFeatureEnabled("plan_shopping_sync_v1")) return null;
  if (!scope) return null;
  const res = await runPlanShoppingSync({
    client: supabase as unknown as Parameters<typeof runPlanShoppingSync>[0]["client"],
    scope,
    edit,
  });
  if (!res.ok) return null; // best-effort; the explicit "Generate list" path is the recovery
  if ("skipped" in res) return null;
  track("plan_shopping_synced", planShoppingSyncedPayload(res, "mobile"));
  return res.items.length;
}

type SwapMealLike = {
  recipeId?: string | null;
  recipeTitle?: string | null;
  portionMultiplier?: number;
};
type SwapRecipeLike = { id: string; title: string; servings?: number };

/**
 * Convenience wrapper for the SWAP case — builds the swap edit (resolving
 * servings from `pool`), syncs, and (when a fresh count comes back) hands it to
 * `onCount` so the host's shopping badge refreshes. Fire-and-forget; a no-op
 * when the flag is off / the swap has no resolvable outgoing recipe.
 */
export async function syncPlanSwapToShoppingList(
  input: {
    scope: ShoppingScope | null;
    outgoing: SwapMealLike | undefined;
    incoming: SwapRecipeLike;
    pool: readonly SwapRecipeLike[];
  },
  onCount?: (count: number) => void,
): Promise<void> {
  const edit = buildPlanSwapEdit(input.outgoing, input.incoming, input.pool);
  if (!edit) return;
  const count = await syncPlanEditToShoppingList(input.scope, edit);
  if (count != null) onCount?.(count);
}

/**
 * Convenience wrapper for the REMOVE case — a meal was cleared from the plan, so
 * decrement its recipe's contribution off the list (resolving servings from
 * `pool` for the scaled amount). Fire-and-forget; no-op when the flag is off or
 * the meal has no resolvable recipe.
 */
export async function syncPlanRemoveToShoppingList(
  input: {
    scope: ShoppingScope | null;
    meal: SwapMealLike | undefined;
    pool: readonly SwapRecipeLike[];
  },
  onCount?: (count: number) => void,
): Promise<void> {
  const m = input.meal;
  if (!m?.recipeId || !m.recipeTitle) return;
  const servings = input.pool.find((r) => r.id === m.recipeId)?.servings;
  const count = await syncPlanEditToShoppingList(input.scope, {
    kind: "remove",
    recipe: {
      id: m.recipeId,
      title: m.recipeTitle,
      multiplier: planPortionMultiplier(m.portionMultiplier, servings),
    },
  });
  if (count != null) onCount?.(count);
}
