/**
 * Pure rules for the shopping-list lifecycle — F-9 (TestFlight
 * `AMXSjeaXJeCf6QtKgUTMkD0`, 2026-04-18) and G-2 follow-up
 * (TestFlight `ALU8hrB1I9Sn4ysqoR_ocEs`, 2026-04-19).
 *
 * Principle: the shopping list is ephemeral and tied to the active
 * meal plan. When there is no plan (fresh account, slot deleted,
 * user switched to an empty slot) the list must not show items from
 * a previous plan. When the plan is regenerated or replaced, the
 * list is rebuilt fresh from the new plan — which means server
 * `shopping_items` rows from the old plan must be purged *before*
 * the fresh list is written, otherwise rows tied to recipes that
 * are no longer in the plan survive forever.
 *
 * `shoppingListShouldClear` captures the null-transition rules
 * shared between web (`src/context/AppDataContext.tsx` clearing
 * effect) and mobile (`apps/mobile/app/(tabs)/planner.tsx` effect).
 * Pure so the rules can be pinned by a unit test without needing to
 * stand up a context or a Supabase mock.
 *
 * `shoppingItemsTiedToCurrentPlan` is the G-2 reconciliation rule
 * used on first-load of the shopping screen: given the live plan's
 * recipe titles, return only the `shopping_items` whose `source`
 * field still references at least one of them. Rows from deleted
 * recipes are dropped. Cheap, robust to historical drift.
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

/**
 * Given the current plan's recipe titles and a list of persisted
 * shopping rows, return only the rows whose `source` field (comma
 * separated recipe titles) still references at least one live
 * recipe. Rows with an empty `source` are kept (manually added
 * items) — we only drop rows that came from a recipe that's been
 * removed from the plan. G-2 reconciliation path.
 *
 * Matching is case-insensitive and ignores surrounding whitespace,
 * matching `ShoppingList.tsx`'s own title comparisons. The caller
 * is expected to pass `currentPlanRecipeTitles` derived from the
 * live `meal_plan_meals.recipe_title` or the in-memory plan's
 * `meals[].recipeTitle`.
 */
export function shoppingItemsTiedToCurrentPlan<
  T extends { source?: string | null; from?: string | null },
>(args: {
  items: readonly T[];
  currentPlanRecipeTitles: readonly string[];
}): T[] {
  const { items, currentPlanRecipeTitles } = args;
  const live = new Set(
    currentPlanRecipeTitles
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  return items.filter((item) => {
    const raw = (item.source ?? item.from ?? "").trim();
    if (!raw) return true; // manually added, no recipe ref
    const refs = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (refs.length === 0) return true;
    return refs.some((r) => live.has(r));
  });
}

/**
 * Render a shopping-list line without double-printing the
 * amount/unit prefix. G-2: importers occasionally store the full
 * ingredient string in `name` (e.g. `"60 g protein powder"`) while
 * ALSO populating `amount` ("60") and `unit` ("g") on the row —
 * naive concat then produces `"60 g 60 g protein powder"`. The
 * helper strips the leading `<amount><opt-space><unit>` from `name`
 * when present, with tolerant whitespace/casing matching. Pure so
 * it's shared by both the web (`ShoppingList.tsx`) and mobile
 * (`apps/mobile/app/shopping.tsx`) renderers.
 *
 * Leaves `name` untouched when:
 *   - `amount` or `unit` is empty / missing (nothing to dedupe
 *     against)
 *   - `name` does not start with the amount-then-unit sequence
 *   - the match would leave an empty name (safety; we'd rather
 *     render a duplicate than a blank line)
 */
export function dedupeShoppingLabel(args: {
  amount: string | null | undefined;
  unit: string | null | undefined;
  name: string | null | undefined;
}): { amount: string; unit: string; name: string } {
  const amount = (args.amount ?? "").trim();
  const unit = (args.unit ?? "").trim();
  const name = (args.name ?? "").trim();
  if (!name) return { amount, unit, name };
  if (!amount) return { amount, unit, name };

  // Attempt to match `<amount> <unit>` at the start of name,
  // optionally followed by whitespace or punctuation. Amount can be
  // an integer, decimal, or a slash fraction ("1/2"); we only
  // collapse when the amount substring matches exactly.
  const lowerName = name.toLowerCase();
  const lowerAmount = amount.toLowerCase();
  const lowerUnit = unit.toLowerCase();

  if (!lowerName.startsWith(lowerAmount)) {
    return { amount, unit, name };
  }
  let cursor = lowerAmount.length;
  // The amount must be followed by whitespace, end-of-string, or
  // the start of the unit. Without that word-break, "2" at the
  // start of "24 oz bag" would wrongly match.
  const wsAfterAmount = cursor < lowerName.length && lowerName[cursor] === " ";
  const endAfterAmount = cursor === lowerName.length;
  // Consume whitespace between amount and (optional) unit.
  while (cursor < lowerName.length && lowerName[cursor] === " ") cursor++;

  if (lowerUnit) {
    if (!lowerName.startsWith(lowerUnit, cursor)) {
      return { amount, unit, name };
    }
    cursor += lowerUnit.length;
    // The unit must be followed by end-of-string or a word-break
    // so "60 g 60g protein" matches but "60 gram jar" does not.
    if (
      cursor < lowerName.length &&
      lowerName[cursor] !== " " &&
      lowerName[cursor] !== "," &&
      lowerName[cursor] !== "."
    ) {
      return { amount, unit, name };
    }
  } else {
    // No declared unit. Only strip when the amount ended on a
    // word-break we actually observed.
    if (!wsAfterAmount && !endAfterAmount) {
      return { amount, unit, name };
    }
  }

  const trimmedName = name.slice(cursor).replace(/^[\s,.-]+/, "").trim();
  if (!trimmedName) return { amount, unit, name };
  return { amount, unit, name: trimmedName };
}
