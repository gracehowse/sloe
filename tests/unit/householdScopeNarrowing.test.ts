/**
 * F-16 — Household sharing scope narrowing (build 11, 2026-04-25).
 *
 * These tests pin the read-path guarantees from legal-reviewer's
 * approval of `AJ1AeYJ--fF`:
 *
 *   1. `household_meals` flowing to the client is limited to
 *      dinners by default, and dinners + lunches when the household
 *      has opted into `share_lunch = true`. Breakfasts and snacks
 *      never leave `getMyHousehold`, regardless of the toggle.
 *   2. `getMyHousehold` never returns `targets`, `consumed`, or
 *      `remaining` for any member other than the caller. The
 *      caller's own row still carries all three — we want "my
 *      remaining today" on the household surface; we don't want
 *      my husband's macros rendering on my screen (or vice versa).
 *   3. `setHouseholdShareLunch` writes only the `share_lunch`
 *      column on the `households` row, scoped by id. The RLS layer
 *      enforces owner_id = auth.uid(); this test covers the
 *      client-side contract.
 *
 * The supabase fake is copied in spirit from
 * `tests/unit/householdClient.test.ts`, trimmed to the surfaces
 * these tests exercise.
 */
import { describe, expect, it } from "vitest";
import {
  getMyHousehold,
  setHouseholdShareLunch,
} from "@/lib/household/householdClient";

type Handler = (op: string, ctx: { payload?: unknown; filters: Record<string, unknown> }) => { data: unknown; error: unknown };

function makeSupabase(handlers: Partial<Record<string, Handler>>) {
  const calls: Array<{ op: string; table: string; payload?: unknown; filters: Record<string, unknown> }> = [];

  function builder(table: string, op: string, payload?: unknown) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select() { return self; },
      insert(p: unknown) { return builder(table, "insert", p); },
      update(p: unknown) { return builder(table, "update", p); },
      delete() { return builder(table, "delete"); },
      eq(col: string, val: unknown) { filters[`eq:${col}`] = val; return self; },
      in(col: string, vals: unknown[]) { filters[`in:${col}`] = vals; return self; },
      gte(col: string, val: unknown) { filters[`gte:${col}`] = val; return self; },
      order(col: string, opts?: unknown) { filters[`order:${col}`] = opts ?? true; return self; },
      limit(n: number) { filters.limit = n; return self; },
      single: async () => {
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters }) : { data: null, error: new Error(`no handler for ${table} ${k}`) };
      },
      maybeSingle: async () => {
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters }) : { data: null, error: null };
      },
      then(resolve: any) {
        calls.push({ op, table, payload, filters });
        const h = handlers[table];
        const res = h ? h(op, { payload, filters }) : { data: null, error: null };
        resolve(res);
      },
    };
    return self;
  }

  return {
    from: (table: string) => builder(table, "select"),
    rpc: async () => ({ data: null, error: new Error("no rpc handler") }),
    calls,
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

// Canonical fake meal set: one row per meal type on today's date so
// the filter outcome is unambiguous. Mixed capitalisation is on
// purpose — historical rows were written both ways.
const ALL_MEAL_TYPES_TODAY = [
  { id: "m-b", date_key: TODAY, meal_label: "Breakfast", recipe_title: "Oats", recipe_id: null, servings: 1, calories_per_serving: 300, protein_per_serving: 10, carbs_per_serving: 50, fat_per_serving: 5, fiber_per_serving: 6, notes: null, added_by: "u1", created_at: "2026-04-25" },
  { id: "m-l", date_key: TODAY, meal_label: "lunch", recipe_title: "Salad", recipe_id: null, servings: 1, calories_per_serving: 500, protein_per_serving: 30, carbs_per_serving: 40, fat_per_serving: 20, fiber_per_serving: 8, notes: null, added_by: "u1", created_at: "2026-04-25" },
  { id: "m-d", date_key: TODAY, meal_label: "Dinner", recipe_title: "Chili", recipe_id: null, servings: 4, calories_per_serving: 600, protein_per_serving: 40, carbs_per_serving: 55, fat_per_serving: 22, fiber_per_serving: 10, notes: null, added_by: "u1", created_at: "2026-04-25" },
  { id: "m-s", date_key: TODAY, meal_label: "Snack", recipe_title: "Apple", recipe_id: null, servings: 1, calories_per_serving: 95, protein_per_serving: 0.5, carbs_per_serving: 25, fat_per_serving: 0.3, fiber_per_serving: 4, notes: null, added_by: "u1", created_at: "2026-04-25" },
];

function makeScopedSupabase(shareLunch: boolean) {
  return makeSupabase({
    household_members: (op, ctx) => {
      if (op === "select:maybeSingle") {
        return { data: { household_id: "h1", role: "owner", joined_at: "2026-01-01" }, error: null };
      }
      if (op === "select") {
        // Membership list — two members, caller u1 + other u2.
        expect(ctx.filters["eq:household_id"]).toBe("h1");
        return {
          data: [
            { id: "mem-1", user_id: "u1", role: "owner", display_name: "Ada", joined_at: "2026-01-01" },
            { id: "mem-2", user_id: "u2", role: "member", display_name: "Bea", joined_at: "2026-02-01" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    },
    households: (op) =>
      op === "select:single"
        ? {
            data: {
              id: "h1",
              name: "Fam",
              owner_id: "u1",
              invite_code: "inv",
              created_at: "2026-01-01",
              share_lunch: shareLunch,
            },
            error: null,
          }
        : { data: null, error: null },
    household_meals: () => ({ data: ALL_MEAL_TYPES_TODAY, error: null }),
    profiles: () => ({
      data: [
        { id: "u1", target_calories: 2200, target_protein: 150, target_carbs: 250, target_fat: 70, display_name: "Ada" },
        { id: "u2", target_calories: 1800, target_protein: 120, target_carbs: 200, target_fat: 60, display_name: "Bea" },
      ],
      error: null,
    }),
    nutrition_entries: () => ({
      data: [
        { user_id: "u1", calories: 500, protein: 30, carbs: 40, fat: 10 },
        { user_id: "u2", calories: 1000, protein: 80, carbs: 120, fat: 40 },
      ],
      error: null,
    }),
  });
}

describe("F-16 meal-label scope filter", () => {
  it("share_lunch=false: only dinner rows reach the client (breakfast/lunch/snack stripped)", async () => {
    const sb = makeScopedSupabase(false);
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    const labels = (res.data?.meals ?? []).map((m) => m.meal_label);
    expect(labels).toEqual(["Dinner"]);
  });

  it("share_lunch=true: dinner AND lunch rows reach the client; breakfast/snack still stripped", async () => {
    const sb = makeScopedSupabase(true);
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    const labels = (res.data?.meals ?? []).map((m) => m.meal_label.toLowerCase());
    // Order is preserved from the fetch; capitalisation varies by
    // historical write, so compare normalised.
    expect(labels.sort()).toEqual(["dinner", "lunch"]);
  });

  it("breakfast and snack NEVER leave the server, regardless of toggle", async () => {
    for (const flag of [false, true]) {
      const sb = makeScopedSupabase(flag);
      const res = await getMyHousehold(sb as any, "u1");
      const labels = (res.data?.meals ?? []).map((m) => m.meal_label.toLowerCase());
      expect(labels, `share_lunch=${flag}`).not.toContain("breakfast");
      expect(labels, `share_lunch=${flag}`).not.toContain("snack");
    }
  });

  it("surfaces shareLunch on the household summary so the UI can render the toggle state", async () => {
    const sbOff = makeScopedSupabase(false);
    const resOff = await getMyHousehold(sbOff as any, "u1");
    expect(resOff.data?.household?.shareLunch).toBe(false);

    const sbOn = makeScopedSupabase(true);
    const resOn = await getMyHousehold(sbOn as any, "u1");
    expect(resOn.data?.household?.shareLunch).toBe(true);
  });
});

describe("F-16 member-macro strip", () => {
  it("caller's own row keeps targets, consumed, and remaining", async () => {
    const sb = makeScopedSupabase(false);
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    const self = res.data!.members.find((m) => m.userId === "u1")!;
    expect(self.targets).toBeDefined();
    expect(self.targets?.calories).toBe(2200);
    expect(self.consumed?.calories).toBe(500);
    expect(self.remaining?.calories).toBe(1700);
  });

  it("other members' rows are stripped of targets, consumed, and remaining", async () => {
    const sb = makeScopedSupabase(false);
    const res = await getMyHousehold(sb as any, "u1");
    const other = res.data!.members.find((m) => m.userId === "u2")!;
    expect(other.displayName).toBe("Bea"); // keeps identity
    expect(other.role).toBe("member"); // keeps role
    // Every macro-flavoured field must be absent — not zero, not
    // null — so the UI's `if (m.remaining)` guard hides the whole
    // block rather than rendering a row of zeros that reads as a
    // maxed-out budget.
    expect(other.targets).toBeUndefined();
    expect(other.consumed).toBeUndefined();
    expect(other.remaining).toBeUndefined();
    // Defensive: no legacy field shapes either.
    expect((other as any).calorie_target).toBeUndefined();
    expect((other as any).calories_remaining).toBeUndefined();
  });

  it("stripping holds equally for a non-owner caller (u2 looking at u1)", async () => {
    const sb = makeScopedSupabase(false);
    const res = await getMyHousehold(sb as any, "u2");
    // u2's own row keeps data; u1 (other) is stripped.
    const self = res.data!.members.find((m) => m.userId === "u2")!;
    const other = res.data!.members.find((m) => m.userId === "u1")!;
    expect(self.remaining).toBeDefined();
    expect(other.remaining).toBeUndefined();
    expect(other.targets).toBeUndefined();
  });
});

describe("setHouseholdShareLunch", () => {
  it("writes only `share_lunch` to the households row scoped by id", async () => {
    let capturedPayload: any = null;
    let capturedFilters: Record<string, unknown> = {};
    const sb = makeSupabase({
      households: (op, ctx) => {
        if (op === "update") {
          capturedPayload = ctx.payload;
          capturedFilters = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await setHouseholdShareLunch(sb as any, "h1", true);
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ shareLunch: true });
    expect(capturedPayload).toEqual({ share_lunch: true });
    expect(capturedFilters["eq:id"]).toBe("h1");
  });

  it("surfaces RLS / update failures as a string error (not a throw)", async () => {
    const sb = makeSupabase({
      households: (op) => (op === "update"
        ? { data: null, error: { message: "permission denied" } }
        : { data: null, error: null }),
    });
    const res = await setHouseholdShareLunch(sb as any, "h1", true);
    expect(res.data).toBeNull();
    expect(res.error).toBe("permission denied");
  });

  it("rejects missing household id before hitting the network", async () => {
    const sb = makeSupabase({
      households: () => ({ data: null, error: new Error("should not be called") }),
    });
    const res = await setHouseholdShareLunch(sb as any, "", true);
    expect(res.error).toBe("missing_household_id");
    expect((sb as any).calls).toHaveLength(0);
  });
});
