/**
 * Pure rules for the shopping-list lifecycle — F-9 (TestFlight
 * `AMXSjeaXJeCf6QtKgUTMkD0`, 2026-04-18).
 *
 * Principle: the shopping list is ephemeral and tied to the active
 * meal plan. When there is no plan (fresh account, slot deleted,
 * user switched to an empty slot) the list must not show items from
 * a previous plan. When the plan is regenerated or replaced, the
 * list is rebuilt fresh from the new plan (existing behaviour,
 * handled by `generateShoppingListFromPlan`).
 *
 * `shoppingListShouldClear` captures the transition rules shared
 * between web (`src/context/AppDataContext.tsx` clearing effect) and
 * mobile (`apps/mobile/app/(tabs)/planner.tsx` effect). Pure so the
 * rules can be pinned by a unit test without needing to stand up a
 * context or a Supabase mock.
 *
 * Plan states:
 *   - `null`        — no plan on the active slot
 *   - `[]`          — plan slot exists but the plan is empty (stays
 *                      null in practice, but we accept either)
 *   - `[DayPlan…]`  — real plan
 */

export type ShoppingListClearDecision = {
  /** Should local state / UI be emptied this render? */
  clearLocal: boolean;
  /** Should the server-side `shopping_items` rows be deleted too? */
  clearServer: boolean;
};

export function shoppingListShouldClear(args: {
  /** Meal plan before this render. `null` or `undefined` for first render. */
  previousPlan: readonly unknown[] | null | undefined;
  /** Meal plan for this render. */
  currentPlan: readonly unknown[] | null | undefined;
  /** Does the client currently hold shopping items in local state? */
  hasLocalItems: boolean;
  /** Is there a recorded fingerprint from a prior generate? */
  hasSourceFingerprint: boolean;
}): ShoppingListClearDecision {
  const { previousPlan, currentPlan, hasLocalItems, hasSourceFingerprint } = args;

  // If the current plan is truthy & non-empty, leave the list alone —
  // regenerate is the explicit action; we don't clobber a valid list.
  if (currentPlan && currentPlan.length > 0) {
    return { clearLocal: false, clearServer: false };
  }

  // No current plan. If we have nothing local and no fingerprint, the
  // list is already clean — skip the state churn and the DB round-trip.
  if (!hasLocalItems && !hasSourceFingerprint) {
    return { clearLocal: false, clearServer: false };
  }

  // Always clear local when there's anything to clear.
  const clearLocal = true;

  // Only hit the server when the plan actually transitioned from
  // "something" to "nothing" this render. A cold start with a null
  // plan should not fire a blind DELETE against every user's row —
  // if there was never a plan in memory this session, whatever
  // cleared the plan previously already owns the cleanup.
  const clearServer = Boolean(previousPlan && previousPlan.length > 0);

  return { clearLocal, clearServer };
}
