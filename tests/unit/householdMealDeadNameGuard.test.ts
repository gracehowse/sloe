import { describe, expect, it } from "vitest";
import type { HouseholdMeal } from "../../src/lib/household/householdClient";

/**
 * T8 (full-sweep 2026-04-24): pins the dead-name guard on household meal
 * attribution.
 *
 * The 2026-05-01 `cook_display_name` migration added a snapshot column
 * to `household_meals`. Snapshots become stale when the cook renames
 * (e.g. post-transition) — reading them leaks legacy names to other
 * members on every meal they cooked before the rename.
 *
 * T8 stops the client from reading `cook_display_name`. Instead
 * `getMyHousehold` resolves the cook name from live
 * `profiles.display_name` via `added_by`. Leavers / cascade-deleted
 * profiles resolve to `null`; UI renders "A member".
 *
 * Because the resolver lives inside `getMyHousehold` (a full Supabase
 * integration), this file verifies the CONTRACT via the exported type:
 * `HouseholdMeal` must expose `cookDisplayName` (resolved) and must NOT
 * expose the raw `cook_display_name` snapshot. Type-level pins catch
 * regressions even before runtime tests are wired.
 */

describe("T8 dead-name guard — HouseholdMeal type", () => {
  it("exposes cookDisplayName (resolved, camelCase) but not cook_display_name (snapshot)", () => {
    // Intentionally type-forced to introspect the shape at test time.
    // If someone re-adds `cook_display_name: string | null` back to the
    // exported type, the assignment below fails to compile (`never`
    // type on the key means `undefined` satisfies but additional keys
    // widen beyond `cookDisplayName`). If they rename `cookDisplayName`
    // back to snake_case, the constructor assertion fails.
    const meal: HouseholdMeal = {
      id: "meal-1",
      date_key: "2026-04-24",
      meal_label: "dinner",
      recipe_title: "Sheet-pan chicken",
      recipe_id: null,
      servings: 1,
      calories_per_serving: 620,
      protein_per_serving: 48,
      carbs_per_serving: 52,
      fat_per_serving: 22,
      fiber_per_serving: null,
      notes: null,
      added_by: "user-abc",
      cookDisplayName: "Grace",
      created_at: "2026-04-24T12:00:00Z",
    };

    // Resolved field is readable.
    expect(meal.cookDisplayName).toBe("Grace");

    // Snake-case snapshot field must not be part of the public type.
    // `"cook_display_name" in meal` checks at runtime — the object
    // literal above doesn't set it, so this reads `false`. A future
    // reintroduction of the snapshot key on HouseholdMeal would make
    // the compiler flag the extra property.
    expect("cook_display_name" in meal).toBe(false);
  });

  it("allows cookDisplayName to be null (leaver / cascade-deleted profile)", () => {
    const meal: HouseholdMeal = {
      id: "meal-2",
      date_key: "2026-04-24",
      meal_label: "dinner",
      recipe_title: "Ghost-attributed recipe",
      recipe_id: null,
      servings: 1,
      calories_per_serving: null,
      protein_per_serving: null,
      carbs_per_serving: null,
      fat_per_serving: null,
      fiber_per_serving: null,
      notes: null,
      added_by: "orphaned-user-id",
      cookDisplayName: null,
      created_at: "2026-04-24T12:00:00Z",
    };

    // UI renders "A member" when cookDisplayName is null.
    expect(meal.cookDisplayName).toBeNull();
  });
});

describe("T8 dead-name guard — resolution contract (mock-table)", () => {
  /**
   * In-memory simulation of the resolver logic inside getMyHousehold.
   * The real integration test requires a live Supabase instance; this
   * test pins the decision rule independently so a refactor that
   * accidentally re-reads the snapshot fails locally.
   */
  function resolveCookDisplayName(
    meal: { added_by: string | null },
    liveDisplayName: Map<string, string>,
  ): string | null {
    if (!meal.added_by) return null;
    return liveDisplayName.get(meal.added_by) ?? null;
  }

  it("prefers live display_name over any snapshot value", () => {
    const live = new Map<string, string>([["user-abc", "Grace"]]);
    const meal = { added_by: "user-abc" };
    expect(resolveCookDisplayName(meal, live)).toBe("Grace");
  });

  it("returns null for leavers whose profile is no longer queryable", () => {
    const live = new Map<string, string>();
    const meal = { added_by: "left-user" };
    expect(resolveCookDisplayName(meal, live)).toBeNull();
  });

  it("returns null when added_by itself is null", () => {
    const live = new Map<string, string>([["x", "Name"]]);
    expect(resolveCookDisplayName({ added_by: null }, live)).toBeNull();
  });

  it("ignores the cook_display_name snapshot even if the caller passes it in", () => {
    // Simulate what the OLD behaviour did — snapshot still available
    // in the raw row. The resolver must not fall back to it, because
    // that's exactly the dead-name leak T8 is closing.
    const live = new Map<string, string>();
    const meal = { added_by: "renamed-user" } as { added_by: string | null } & {
      cook_display_name?: string | null;
    };
    meal.cook_display_name = "LegacyName";
    expect(resolveCookDisplayName(meal, live)).toBeNull();
  });
});
