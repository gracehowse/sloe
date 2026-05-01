/**
 * Shopping list household scoping (Honeydew parity, 2026-04-30).
 *
 * Pure helpers — no React, no JSX, no platform-specific imports — so
 * `apps/mobile/app/shopping.tsx` (React Native) and
 * `src/context/appData/useShoppingListState.ts` (web) can share the
 * exact same scoping rules.
 *
 * Rules:
 *  - When the user has an active household, generated/added items are
 *    written with `household_id = <active>` and reads filter by it.
 *  - When the user has no household, items are written with
 *    `household_id = null` and reads filter `user_id = me AND
 *    household_id IS NULL` so we don't leak per-user items into a
 *    later-joined household, or vice versa.
 *  - Existing pre-2026-05 rows have `household_id = null` and remain
 *    visible only to the original creator (per-user fallback).
 *
 * Database: see `supabase/migrations/20260504100000_household_shopping.sql`.
 */

export type ShoppingScope =
  | { kind: "solo"; userId: string }
  | { kind: "household"; userId: string; householdId: string };

/**
 * Build the scope for the current session. `householdId` is the row id
 * of the user's active household, or `null` if they're solo. Both web
 * and mobile call `getMyHousehold` (or its summary cousin) to resolve
 * this before reading or writing.
 */
export function shoppingScopeFor(input: {
  userId: string;
  householdId: string | null;
}): ShoppingScope {
  if (input.householdId) {
    return { kind: "household", userId: input.userId, householdId: input.householdId };
  }
  return { kind: "solo", userId: input.userId };
}

/**
 * Filter columns for the SELECT statement. Returns
 * `[column, operator, value]` triples that the caller can apply via
 * Supabase's chainable `.eq()` / `.is()` API.
 *
 * Solo: `user_id = me AND household_id IS NULL`.
 * Household: `household_id = <active>`. We deliberately do NOT also
 * filter by `user_id` for household rows — the whole point is that
 * household members see each other's items.
 */
export function shoppingScopeReadFilters(
  scope: ShoppingScope,
): Array<["user_id", "eq", string] | ["household_id", "eq", string] | ["household_id", "is", null]> {
  if (scope.kind === "household") {
    return [["household_id", "eq", scope.householdId]];
  }
  return [
    ["user_id", "eq", scope.userId],
    ["household_id", "is", null],
  ];
}

/**
 * INSERT row stamp. Always sets `user_id = me` (RLS requires it for
 * the INSERT WITH CHECK on per-user rows + audit trail on household
 * rows so we know who added what). `household_id` is set only when in
 * household mode.
 */
export function shoppingScopeInsertStamp(
  scope: ShoppingScope,
): { user_id: string; household_id: string | null } {
  if (scope.kind === "household") {
    return { user_id: scope.userId, household_id: scope.householdId };
  }
  return { user_id: scope.userId, household_id: null };
}

/**
 * Realtime subscription filter (Supabase `.on('postgres_changes', { filter })`).
 *
 * For household scope, filter by `household_id`. For solo scope,
 * filter by `user_id` — but be aware solo subscribers will also
 * receive change events for any household rows where they happen to
 * be the inserter, which is fine (they're a member).
 */
export function shoppingScopeRealtimeFilter(scope: ShoppingScope): string {
  if (scope.kind === "household") {
    return `household_id=eq.${scope.householdId}`;
  }
  return `user_id=eq.${scope.userId}`;
}

/**
 * DELETE-all "clear list" filter. Mirrors the read filter but is its
 * own helper because callers chain delete().eq()/.is() differently
 * (no SELECT projection).
 */
export function shoppingScopeClearFilters(scope: ShoppingScope): {
  user_id?: string;
  household_id?: string | null;
} {
  if (scope.kind === "household") {
    return { household_id: scope.householdId };
  }
  return { user_id: scope.userId, household_id: null };
}
