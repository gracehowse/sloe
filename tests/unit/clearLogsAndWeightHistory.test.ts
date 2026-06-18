/**
 * Reset-plan simpler flow (2026-05-11) — pins the scoped wipe used when
 * the user picks "Clear" on the post-onboarding "Keep my logs and weight
 * history?" prompt. The contract:
 *
 *   CLEARS:
 *     - nutrition_entries
 *     - daily_targets
 *     - goal_history
 *     - profiles.weight_kg_by_day / steps_by_day / activity_burn_by_day
 *       / basal_burn_by_day / workouts_by_day / extra_water_by_day
 *     - profiles.fasting_sessions
 *     - profiles.adaptive_tdee* (forced re-learn from fresh logs)
 *
 *   PRESERVES (vs `nukeAllUserAppData`):
 *     - saves (saved recipes)
 *     - private authored recipes
 *     - meal_plans + meal_plan_days/meals
 *     - shopping_items
 *     - the freshly-set onboarding targets / body stats
 */
import { describe, expect, it, vi } from "vitest";
import { clearLogsAndWeightHistory, clearStructuredMealPlans } from "../../src/lib/account/nukeAccountData";

type DeleteCall = { table: string; eqArgs: [string, unknown] };
type UpdateCall = { table: string; payload: Record<string, unknown>; eqArgs: [string, unknown] };

function makeStub() {
  const deletes: DeleteCall[] = [];
  const updates: UpdateCall[] = [];
  const client = {
    from(table: string) {
      return {
        delete() {
          return {
            eq(col: string, val: unknown) {
              deletes.push({ table, eqArgs: [col, val] });
              return Promise.resolve({ error: null });
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              updates.push({ table, payload, eqArgs: [col, val] });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, deletes, updates };
}

describe("clearLogsAndWeightHistory", () => {
  it("clears logs + history tables for the user", async () => {
    const { client, deletes } = makeStub();
    const r = await clearLogsAndWeightHistory(client as never, "u-1");
    expect(r.ok).toBe(true);
    const tables = deletes.map((d) => d.table).sort();
    expect(tables).toEqual(["daily_targets", "goal_history", "nutrition_entries"]);
    for (const d of deletes) {
      expect(d.eqArgs).toEqual(["user_id", "u-1"]);
    }
  });

  it("clears profile JSONB log columns but preserves target_calories / body stats", async () => {
    const { client, updates } = makeStub();
    const r = await clearLogsAndWeightHistory(client as never, "u-1");
    expect(r.ok).toBe(true);
    expect(updates).toHaveLength(1);
    const upd = updates[0];
    expect(upd.table).toBe("profiles");
    expect(upd.eqArgs).toEqual(["id", "u-1"]);
    // Cleared
    expect(upd.payload.weight_kg_by_day).toEqual({});
    expect(upd.payload.steps_by_day).toEqual({});
    expect(upd.payload.activity_burn_by_day).toEqual({});
    expect(upd.payload.basal_burn_by_day).toEqual({});
    expect(upd.payload.workouts_by_day).toEqual({});
    expect(upd.payload.extra_water_by_day).toEqual({});
    expect(upd.payload.fasting_sessions).toEqual([]);
    expect(upd.payload.adaptive_tdee).toBeNull();
    expect(upd.payload.adaptive_tdee_confidence).toBeNull();
    expect(upd.payload.adaptive_tdee_updated_at).toBeNull();
    // Preserved (no key in payload means update doesn't touch it)
    expect("target_calories" in upd.payload).toBe(false);
    expect("target_protein" in upd.payload).toBe(false);
    expect("weight_kg" in upd.payload).toBe(false);
    expect("height_cm" in upd.payload).toBe(false);
    expect("sex" in upd.payload).toBe(false);
    expect("dob" in upd.payload).toBe(false);
    expect("goal" in upd.payload).toBe(false);
    expect("dietary" in upd.payload).toBe(false);
    expect("onboarding_completed" in upd.payload).toBe(false);
  });

  it("does NOT touch saves, recipes, meal_plans, or shopping_items", async () => {
    const { client, deletes, updates } = makeStub();
    await clearLogsAndWeightHistory(client as never, "u-1");
    const touchedTables = new Set([
      ...deletes.map((d) => d.table),
      ...updates.map((u) => u.table),
    ]);
    expect(touchedTables.has("saves")).toBe(false);
    expect(touchedTables.has("recipes")).toBe(false);
    expect(touchedTables.has("meal_plans")).toBe(false);
    expect(touchedTables.has("meal_plans_legacy")).toBe(false);
    expect(touchedTables.has("meal_plan_days")).toBe(false);
    expect(touchedTables.has("meal_plan_meals")).toBe(false);
    expect(touchedTables.has("shopping_items")).toBe(false);
  });

  it("tolerates missing tables (PGRST205 / 42P01) without aborting", async () => {
    const client = {
      from(_table: string) {
        return {
          delete() {
            return {
              eq() {
                return Promise.resolve({
                  error: { message: "Could not find the table", code: "PGRST205" },
                });
              },
            };
          },
          update() {
            return {
              eq() {
                return Promise.resolve({
                  error: { message: "relation does not exist", code: "42P01" },
                });
              },
            };
          },
        };
      },
    };
    const r = await clearLogsAndWeightHistory(client as never, "u-1");
    expect(r.ok).toBe(true);
  });

  it("returns ok:false with the underlying message on real errors", async () => {
    const client = {
      from() {
        return {
          delete() {
            return {
              eq() {
                return Promise.resolve({
                  error: { message: "permission denied for table" },
                });
              },
            };
          },
          update() {
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
    const r = await clearLogsAndWeightHistory(client as never, "u-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("permission denied");
    }
  });
});

describe("clearStructuredMealPlans", () => {
  it("clears normalized meal plan rows without touching dropped legacy tables", async () => {
    const touchedTables: string[] = [];
    const client = {
      from(table: string) {
        return {
          select() {
            touchedTables.push(table);
            return {
              eq() {
                return Promise.resolve({
                  data: [{ id: "day-1" }, { id: "day-2" }],
                  error: null,
                });
              },
            };
          },
          delete() {
            touchedTables.push(table);
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
              in() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const r = await clearStructuredMealPlans(client as never, "u-1");
    expect(r.ok).toBe(true);
    expect(touchedTables).toEqual([
      "meal_plan_days",
      "meal_plan_meals",
      "meal_plan_days",
    ]);
    expect(touchedTables).not.toContain("meal_plans");
    expect(touchedTables).not.toContain("meal_plans_legacy");
  });
});

// Silence the unused-import-detector — vi is imported for parity with
// sibling tests that mock fetch / timers; this suite is dependency-free.
void vi;
