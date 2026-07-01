# Decision — Keep the shopping list in sync as the plan is edited (ENG-957)

**Date:** 2026-07-01
**Area:** Product / Meal planning (Plan tab) / Shopping list / cross-platform parity
**Status:** Shipped (default-ON behind `plan_shopping_sync_v1`)
**Builds on:** ENG-943 (recipe→shopping-list append/merge aggregator)

## Decision

Adding, removing, or **swapping** a meal in the Plan now keeps the shopping list
in sync automatically — not just on the explicit "Generate Shopping List" tap.
This closes the loop from the *other* direction to ENG-943: ENG-943 fed the list
from a single recipe; ENG-957 keeps the list *tracking the plan* as the plan
changes.

Crucially this is an **edit-driven re-sync**, **not** the plan generator's full
delete-and-replace. An edit only ever touches the rows the changed recipe
contributed — a checked-off row the user is mid-shop on, and a household-mate's
manually-added row, are never clobbered.

## Why not reuse the plan generator's delete-and-replace

The Step-4 "Generate Shopping List" path owns the whole list for a plan and does
a full `DELETE` + re-`INSERT`. Firing that on every meal edit would:

- wipe `checked` state every time the user swaps a single dinner, and
- delete a household-mate's manual additions (they carry no recipe source).

So ENG-957 reads the live list, applies the edit in memory, and persists **only
the delta**: `UPDATE` changed rows (preserves `checked`), `INSERT` new rows,
`DELETE` rows the edit emptied. Same posture ENG-943 chose for the single-recipe
append, extended with a `DELETE` path for the removal case.

## Reuse, not reinvention

- **Add side** = ENG-943's `appendRecipeToShoppingList` verbatim (silent
  duplicate merge, servings scaling, high-confidence count↔weight fold).
- **Remove side** = the new `removeRecipeFromShoppingList` — the exact inverse.
  To avoid a second, drifting implementation, the low-level primitives ENG-943
  kept private (merge-key, amount parse/format, the count↔weight HIGH-confidence
  gate, source-token helpers) were extracted into
  `src/lib/planning/shoppingMergePrimitives.ts`; **both** the appender and the
  remover import them, so `remove(add(list))` restores the rows the recipe
  touched (pinned by a round-trip test).
- **Engine** = `syncPlanEditToShoppingList.ts` (`applyPlanEditToShoppingList`)
  dispatches add / remove / swap. A **swap removes the outgoing recipe first,
  then appends the incoming** around one list, so a shared ingredient (both
  recipes use onions) nets correctly instead of double-counting.
- **Persistence** = `syncPlanEditToShoppingListClient.ts` (delta writer).
- **Host glue** (ingredient fetch by recipe id + analytics payload) =
  `planShoppingSyncHost.ts`. All shared; mobile imports via `@suppr/shared`.

## Provenance for safe removal — NO schema change

To decrement on removal we must know which rows a recipe contributed. We reuse
the **existing `shopping_items.source` field** (comma-separated recipe titles) —
the same provenance the G-2 `shoppingItemsTiedToCurrentPlan` reconciliation
already reads. Rules:

- A removal only ever considers a row whose `source` references the removed
  recipe (whole-token, case-insensitive) — a manual row (`source = ""`) or
  another recipe's row is never touched.
- After decrementing: if the row still lists another recipe, drop only this
  recipe's token from `source` and keep the row; if this recipe was the **sole**
  source **and** the amount reaches ~zero (or is unparseable), `DELETE` it.

**No new column or table was required.** This was the explicitly-preferred
non-schema path in the ticket; the `source` field is sufficient because the plan
already stamps each generated/appended row with its contributing recipe title(s).

## Nutrition / quantity correctness

The count↔weight fold reuses ENG-943's `measureToGramsConfidence` gate: a line
only combines into a grams row at **HIGH** confidence, so a bare count of an
unknown food (which would hit the generic-guess path) stays its **own row** on
the way in and is therefore never wrongly subtracted from a grams row on the way
out. We never fabricate a gram number. Servings scale every amount, symmetric
add ↔ remove.

## Flag / rollback

`plan_shopping_sync_v1` — **default-ON** (Grace's "always flag on" beta-window
policy, ENG-1279), registered in `REDESIGN_DEFAULT_ON` on **both**
`src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts` (parity guard:
`tests/unit/planShoppingSyncFlagParity.test.ts`). Off → the legacy one-off list
(explicit "Generate Shopping List" only) is the kill switch. Ramp/kill via
PostHog.

## Parity & surfaces

- **Web:** swap only — `MealPlanner.pickSwap` → `AppDataContext`
  `syncShoppingListForPlanEdit`.
- **Mobile:** swap **and** "Remove from plan" (row menu) via
  `apps/mobile/lib/planShoppingSync.ts`.

Web currently has **no per-meal "remove" affordance** (its meal-edit surface is
swap-only), so only the swap path is wired there. When a web remove affordance
lands it calls the same shared engine — the context method already accepts
`{ kind: "remove" }`. This is a pre-existing UI divergence, not new drift.

The screen-budget-pinned hosts (`MealPlanner.tsx`, `planner.tsx`) stayed
net-neutral: all logic lives in the shared modules + the small mobile
`planShoppingSync.ts` wrapper, and both hosts re-pinned at or below their prior
line count.

## Analytics

`plan_shopping_synced` (same name web + mobile) —
`{ editKind: "add" | "remove" | "swap", addedCount, mergedCount,
decrementedCount, removedCount, platform }`. No PII; ingredient names are not
sent. Distinct from `shopping_list_generated` (the full-plan generate) and
`recipe_shopping_list_added` (ENG-943 single-recipe add).

## Follow-ups

- A web per-meal "Remove from plan" affordance would let the remove path light up
  on web too — tracked separately if/when the Plan-tab row menu ships on web.
- Move-meal (reorder within the plan) does not change *which* recipes are in the
  plan, so it needs no list sync — intentionally out of scope, not a gap.
