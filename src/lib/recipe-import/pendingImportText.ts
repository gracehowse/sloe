/**
 * Pending-import text hand-off (ENG-1225 #3) — shared web + mobile.
 *
 * The unified Import sheet classifies a paste, then routes a pasted RECIPE to
 * the create flow (`/create?autoPaste=1` web / `/create-recipe?autoPaste=1`
 * mobile). Recipe text can be long, so it is NOT carried in URL/route params —
 * instead the sheet stashes it here and the destination consumes it ONCE on
 * arrival to prefill the paste field, so the user never re-pastes.
 *
 * A plain module variable: the route push stays in-process on both platforms
 * (Next App Router client nav / Expo Router), so the single ES-module instance
 * is shared across the route boundary. `consume` clears it, so a stale paste
 * can never leak into a later, unrelated import. No React/hooks here, so this
 * shared module carries no cross-runtime dedupe risk.
 *
 * INVARIANT: only kinds whose destination actually consumes this may set it —
 * today `recipe-text` (create paste dialog/modal) and `plan-text` (plan-import
 * paste step). CSV routes to a hint, so it must NOT set this, or its text would
 * leak into the next recipe/plan import.
 */
let pendingImportText: string | null = null;

/** Stash pasted text for the destination to pick up. Empty/whitespace clears. */
export function setPendingImportText(text: string): void {
  pendingImportText = text.trim() ? text : null;
}

/** Read-and-clear the stashed text (returns null if none). */
export function consumePendingImportText(): string | null {
  const value = pendingImportText;
  pendingImportText = null;
  return value;
}
