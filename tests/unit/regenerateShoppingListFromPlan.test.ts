import { describe, it, expect } from "vitest";
import {
  reconcileShoppingListFromPlan,
  regenerateShoppingListFromPlan,
  type RegenShoppingClient,
} from "@/lib/planning/regenerateShoppingListFromPlan";
import { fingerprintMealPlanForShopping } from "@/lib/planning/mealPlanFingerprint";
import type { DayPlan } from "@/types/recipe";

describe("reconcileShoppingListFromPlan — non-destructive diff", () => {
  it("inserts new plan rows, preserves checked matches, keeps manual, deletes stale", () => {
    const plan = reconcileShoppingListFromPlan({
      existing: [
        // still in plan + checked → matched, stays untouched (no update, checked preserved)
        { id: "rice", name: "rice", amount: "200", unit: "g", checked: true, source: "Curry" },
        // manual addition (empty source) → preserved, never deleted
        { id: "batteries", name: "batteries", amount: "1", unit: "", checked: false, source: "" },
        // plan-sourced but gone from the plan → stale → delete
        { id: "old", name: "kale", amount: "1", unit: "bunch", checked: false, source: "OldSoup" },
      ],
      generated: [
        { name: "rice", amount: "200", unit: "g", category: "Grains", from: "Curry" },
        { name: "avocado", amount: "1", unit: "", category: "Produce", from: "Bowl" },
      ],
    });

    expect(plan.inserts.map((i) => i.name)).toEqual(["avocado"]);
    expect(plan.updates).toHaveLength(0); // rice unchanged
    expect(plan.deletes).toEqual(["old"]);
    expect(plan.keptManualCount).toBe(1);
    expect(plan.keptCheckedCount).toBe(1);
  });

  it("updates amount/source on a matched row but leaves checked alone", () => {
    const plan = reconcileShoppingListFromPlan({
      existing: [
        { id: "rice", name: "rice", amount: "200", unit: "g", checked: true, source: "Curry" },
      ],
      generated: [
        // plan now buys more rice (two recipes) → UPDATE amount + source, keep checked
        { name: "rice", amount: "350", unit: "g", category: "Grains", from: "Curry, Bowl" },
      ],
    });
    expect(plan.updates).toEqual([{ id: "rice", amount: "350", source: "Curry, Bowl" }]);
    expect(plan.deletes).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    // A matched row stays checked even when its quantity is updated.
    expect(plan.keptCheckedCount).toBe(1);
  });

  it("collapses duplicate generated keys (defensive)", () => {
    const plan = reconcileShoppingListFromPlan({
      existing: [],
      generated: [
        { name: "egg", amount: "2", unit: "", category: "Dairy", from: "A" },
        { name: "egg", amount: "3", unit: "", category: "Dairy", from: "B" },
      ],
    });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]!.amount).toBe("2");
  });
});

// ── Host orchestration ───────────────────────────────────────────────────────

type TableData = Record<string, Array<Record<string, unknown>>>;

/**
 * Table-aware fake Supabase client. Read chains (`.eq`/`.is`/`.in`/`.order`)
 * ignore the filter args and resolve the seeded rows for that table; write
 * calls record into spies. Enough to exercise the host's read → generate →
 * reconcile → persist path.
 */
function fakeClient(tables: TableData, opts?: { readError?: string }) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ patch: Record<string, unknown>; id: string }> = [];
  const deletes: string[] = [];

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    chain.eq = passthrough;
    chain.is = passthrough;
    chain.in = passthrough;
    chain.order = passthrough;
    chain.then = (onfulfilled: (res: unknown) => unknown) =>
      Promise.resolve(
        onfulfilled(
          opts?.readError
            ? { data: null, error: { message: opts.readError } }
            : { data: tables[table] ?? [], error: null },
        ),
      );
    return chain;
  }

  const client = {
    from(table: string) {
      return {
        select() {
          return makeChain(table);
        },
        insert(rows: Array<Record<string, unknown>>) {
          inserts.push(...rows);
          return Promise.resolve({ error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(_col: string, id: string) {
              updates.push({ patch, id });
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              deletes.push(...ids);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as RegenShoppingClient, inserts, updates, deletes };
}

describe("regenerateShoppingListFromPlan — host orchestration", () => {
  const basePlan: TableData = {
    meal_plan_days: [{ id: "d0", day: 0, start_date: "2026-07-12" }],
    meal_plan_meals: [
      {
        plan_day_id: "d0",
        slot_index: 0,
        recipe_title: "Curry",
        recipe_id: "r-curry",
        portion_multiplier: 1,
        is_placeholder: false,
      },
    ],
    recipes: [{ id: "r-curry", servings: 1 }],
    recipe_ingredients: [
      { recipe_id: "r-curry", name: "rice", amount: "200", unit: "g" },
      { recipe_id: "r-curry", name: "chicken", amount: "300", unit: "g" },
    ],
  };

  it("preserves a checked plan row + manual addition, inserts the new ingredient", async () => {
    const { client, inserts, updates, deletes } = fakeClient({
      ...basePlan,
      shopping_items: [
        // rice already checked off + still in the plan → not touched
        { id: "s-rice", name: "rice", amount: "200", unit: "g", category: "Grains", checked: true, source: "Curry" },
        // manual household addition → preserved
        { id: "s-manual", name: "sponges", amount: "1", unit: "", category: "Other", checked: false, source: "" },
      ],
    });

    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // chicken is new → insert; rice unchanged → no update; nothing stale → no delete.
    expect(inserts.map((r) => r.name)).toEqual(["chicken"]);
    expect((inserts[0] as { checked: boolean }).checked).toBe(false);
    expect(updates).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(res.addedCount).toBe(1);
    expect(res.keptCheckedCount).toBe(1);
    expect(res.keptManualCount).toBe(1);
    expect(res.planStartDate).toBe("2026-07-12");
    expect(res.planFingerprint).toContain("Curry");
  });

  it("deletes a plan row whose recipe left the plan, keeps checked survivors", async () => {
    const { client, deletes, inserts } = fakeClient({
      ...basePlan,
      shopping_items: [
        { id: "s-rice", name: "rice", amount: "200", unit: "g", category: "Grains", checked: true, source: "Curry" },
        { id: "s-chicken", name: "chicken", amount: "300", unit: "g", category: "Meat", checked: false, source: "Curry" },
        // tofu came from a recipe no longer in the plan → stale → delete
        { id: "s-tofu", name: "tofu", amount: "1", unit: "block", category: "Protein", checked: false, source: "OldStirFry" },
      ],
    });

    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: [],
    });

    expect(res.ok).toBe(true);
    expect(deletes).toEqual(["s-tofu"]);
    expect(inserts).toHaveLength(0); // rice + chicken already present
  });

  it("returned planFingerprint equals the live-plan fingerprint incl. scaled portions (ENG-1527)", async () => {
    // The live staleness check compares its stored fingerprint against
    // `fingerprintMealPlanForShopping(hydratePlanFromCloud(...))`. That hydrated
    // plan strips placeholder slots and PRESERVES the real portion multiplier.
    // The stored fingerprint this module returns MUST equal it byte-for-byte, or
    // the "· plan changed since" banner re-fires immediately after every sync.
    // Regression: an earlier build dropped portionMultiplier to `undefined`, so
    // any scaled meal (portion ≠ 1) made the two fingerprints diverge forever.
    const scaledPlan: TableData = {
      meal_plan_days: [
        { id: "d0", day: 0, start_date: "2026-07-12" },
        { id: "d1", day: 1, start_date: "2026-07-12" },
      ],
      meal_plan_meals: [
        { plan_day_id: "d0", slot_index: 0, recipe_title: "Curry", recipe_id: "r-curry", portion_multiplier: 2, is_placeholder: false },
        // placeholder slot — both the live loader and this module strip it
        { plan_day_id: "d0", slot_index: 1, recipe_title: "Save more recipes", recipe_id: null, portion_multiplier: 1, is_placeholder: true },
        { plan_day_id: "d1", slot_index: 0, recipe_title: "Bowl", recipe_id: "r-bowl", portion_multiplier: 0.5, is_placeholder: false },
      ],
      recipes: [
        { id: "r-curry", servings: 1 },
        { id: "r-bowl", servings: 1 },
      ],
      recipe_ingredients: [
        { recipe_id: "r-curry", name: "rice", amount: "200", unit: "g" },
        { recipe_id: "r-bowl", name: "tofu", amount: "1", unit: "block" },
      ],
      shopping_items: [],
    };
    const { client } = fakeClient(scaledPlan);
    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Mirror of what `hydratePlanFromCloud` produces for this plan: placeholders
    // gone, real portion multipliers kept.
    const livePlan: DayPlan[] = [
      { day: 0, meals: [{ recipeTitle: "Curry", portionMultiplier: 2 }], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
      { day: 1, meals: [{ recipeTitle: "Bowl", portionMultiplier: 0.5 }], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
    ] as unknown as DayPlan[];
    expect(res.planFingerprint).toBe(fingerprintMealPlanForShopping(livePlan));
    // Guard the exact regression: the scaling reaches the fingerprint string.
    expect(res.planFingerprint).toContain(":2.0");
    expect(res.planFingerprint).toContain(":0.5");
  });

  it("skips pantry staples when regenerating", async () => {
    const { client, inserts } = fakeClient({ ...basePlan, shopping_items: [] });
    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: ["rice"],
    });
    expect(res.ok).toBe(true);
    expect(inserts.map((r) => r.name)).toEqual(["chicken"]); // rice filtered as a staple
  });

  it("returns an error when there is no active plan", async () => {
    const { client } = fakeClient({ meal_plan_days: [], shopping_items: [] });
    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no active plan/i);
  });

  it("surfaces a read error without writing", async () => {
    const { client, inserts, deletes } = fakeClient(basePlan, { readError: "boom" });
    const res = await regenerateShoppingListFromPlan({
      client,
      scope: { kind: "solo", userId: "u1" },
      planSlotId: "slot",
      pantryStaples: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("boom");
    expect(inserts).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });
});
