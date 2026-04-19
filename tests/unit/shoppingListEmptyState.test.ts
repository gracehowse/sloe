/**
 * Shopping-list lifecycle rules — F-9 (TestFlight
 * `AMXSjeaXJeCf6QtKgUTMkD0`, 2026-04-18).
 *
 * The tester reported the Plan tab showing "Shopping List · 37 items
 * from this week" before they had ever generated a plan. Cause: stale
 * `shopping_items` rows from a previous plan hung around after the
 * plan itself was cleared. Fix: the shopping list is ephemeral — when
 * there is no plan on the active slot, the list must be cleared too.
 *
 * `shoppingListShouldClear` is the pure decision function consumed by
 * both platforms:
 *   - web:    `src/context/AppDataContext.tsx` (effect watching
 *             `mealPlan`).
 *   - mobile: `apps/mobile/app/(tabs)/planner.tsx` (effect watching
 *             `plan`).
 *
 * This file pins the rules so a future refactor doesn't re-introduce
 * the stale-list regression.
 *
 * NOTE on file name: `tests/unit/shoppingListEmptyState.test.tsx`
 * already exists (pins the `<EmptyState />` migration in the
 * ShoppingList component). This `.ts` file covers the *lifecycle*
 * rules — different concern, different layer. The task spec called
 * for this file name; no collision because the extensions differ.
 */
import { describe, expect, it } from "vitest";
import { shoppingListShouldClear } from "../../src/lib/planning/shoppingListLifecycle";

// A non-empty plan for the "real plan" cases. The helper only reads
// `.length`, so a single opaque day is enough.
const PLAN = [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }];

describe("shoppingListShouldClear (F-9)", () => {
  it("no plan AND nothing to clear → no-op (no churn, no DB round-trip)", () => {
    // Fresh account cold-start: never had a plan, never had a list.
    // Must not fire a blind DELETE.
    const r = shoppingListShouldClear({
      previousPlan: null,
      currentPlan: null,
      hasLocalItems: false,
      hasSourceFingerprint: false,
    });
    expect(r).toEqual({ clearLocal: false, clearServer: false });
  });

  it("no plan but stale local items → clear local, skip server (no prior plan this session)", () => {
    // Cold start with stale items in DB that got loaded into local
    // state before we realised there's no plan. Local cleanup is
    // enough; we don't want to clobber the server if the user is
    // mid-session with another device.
    const r = shoppingListShouldClear({
      previousPlan: null,
      currentPlan: null,
      hasLocalItems: true,
      hasSourceFingerprint: false,
    });
    expect(r).toEqual({ clearLocal: true, clearServer: false });
  });

  it("plan transitioned from present to null → clear local AND server", () => {
    // User deleted their active meal-plan slot. Shopping list should
    // follow it into the void — both on screen and on the server, so
    // opening the Shopping tab directly doesn't show ghost items.
    const r = shoppingListShouldClear({
      previousPlan: PLAN,
      currentPlan: null,
      hasLocalItems: true,
      hasSourceFingerprint: true,
    });
    expect(r).toEqual({ clearLocal: true, clearServer: true });
  });

  it("plan present → never clear (regenerate is an explicit action, not automatic)", () => {
    // Regenerate / initial generation is handled by
    // `generateShoppingListFromPlan`; this lifecycle rule must not
    // touch the list while a plan is active, or generation races
    // with clear.
    const r = shoppingListShouldClear({
      previousPlan: null,
      currentPlan: PLAN,
      hasLocalItems: true,
      hasSourceFingerprint: true,
    });
    expect(r).toEqual({ clearLocal: false, clearServer: false });
  });

  it("plan present AND no list → still no clear (nothing to do)", () => {
    const r = shoppingListShouldClear({
      previousPlan: PLAN,
      currentPlan: PLAN,
      hasLocalItems: false,
      hasSourceFingerprint: false,
    });
    expect(r).toEqual({ clearLocal: false, clearServer: false });
  });

  it("plan transitioned from present to empty ([]) → clear, same as null", () => {
    // Empty array is semantically "no plan" — the UI gates on
    // `.length`. The rule must handle both transitions identically.
    const r = shoppingListShouldClear({
      previousPlan: PLAN,
      currentPlan: [],
      hasLocalItems: true,
      hasSourceFingerprint: true,
    });
    expect(r).toEqual({ clearLocal: true, clearServer: true });
  });

  it("no current plan but only a fingerprint (items already gone) → clear the fingerprint only", () => {
    // Defensive: after a partial clear elsewhere, the fingerprint
    // can outlive the items. Treat this as "needs clearing" so the
    // out-of-sync banner doesn't linger on an empty list.
    const r = shoppingListShouldClear({
      previousPlan: null,
      currentPlan: null,
      hasLocalItems: false,
      hasSourceFingerprint: true,
    });
    expect(r).toEqual({ clearLocal: true, clearServer: false });
  });

  it("regenerate flow end-to-end: generate (plan now truthy) keeps the freshly-built list intact", () => {
    // Scenario: user hits Regenerate. generateShoppingListFromPlan
    // writes a fresh list, then the planner effect fires with
    // currentPlan === new plan. The lifecycle helper must NOT clear
    // the new list on that render.
    const r = shoppingListShouldClear({
      previousPlan: PLAN, // previous plan
      currentPlan: PLAN, // replaced with fresh plan
      hasLocalItems: true,
      hasSourceFingerprint: true,
    });
    expect(r).toEqual({ clearLocal: false, clearServer: false });
  });
});
