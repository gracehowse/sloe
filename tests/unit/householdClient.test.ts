/**
 * Household shared-client tests (2026-04-18 mobile port).
 *
 * Exercises each public function in `src/lib/household/householdClient.ts`
 * against a fake chainable supabase-js-compatible client. The intent is
 * to pin:
 *   - every read / write uses the right `eq(...)` / `.in(...)` filters
 *   - the output shape matches the legacy `/api/household` REST payload
 *     (so the mobile + web UIs don't need to change)
 *   - the RPC-backed `joinHouseholdByInviteCode` correctly surfaces
 *     domain errors (`invalid_code`, `household_full`, etc.) as an
 *     `error` string rather than throwing
 *   - leave-as-owner cascades the household while leave-as-member only
 *     deletes the single membership row
 *
 * Live RLS tests against Supabase are deferred to qa-lead — same
 * pattern as `recipeNotesClient.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  createHousehold,
  getMyHousehold,
  joinHouseholdByInviteCode,
  leaveHousehold,
} from "@/lib/household/householdClient";

type HandlerCtx = { payload?: unknown; filters: Record<string, unknown>; table: string };
type Handler = (
  op: string,
  ctx: HandlerCtx,
) => { data: unknown; error: unknown };

type RpcHandler = (params: Record<string, unknown>) => { data: unknown; error: unknown };

function makeSupabase(
  handlers: Partial<Record<string, Handler>>,
  // Historically this only ever backed `household_join_by_invite_code`
  // (a single rpc surface), so a single catch-all handler was enough.
  // ENG-1602 (2026-07-21) added a second rpc surface
  // (`get_household_shared_targets`, called unconditionally from every
  // `getMyHousehold` with a household). Callers may still pass one
  // function to handle every `.rpc(...)` call (existing join tests), OR
  // a map keyed by function name for tests that need to distinguish.
  // Either way, `get_household_shared_targets` defaults to an empty
  // co-member set when nothing is wired, so tests that don't care about
  // cross-member sharing don't need to know this surface exists.
  rpcHandler?: RpcHandler | Partial<Record<string, RpcHandler>>,
) {
  const calls: Array<{ op: string; table: string; payload?: unknown; filters: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];

  function builder(table: string, op: string, payload?: unknown) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select(_cols?: string) {
        return self;
      },
      insert(p: unknown) {
        return builder(table, "insert", p);
      },
      update(p: unknown) {
        return builder(table, "update", p);
      },
      delete() {
        return builder(table, "delete");
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      in(col: string, vals: unknown[]) {
        filters[`in:${col}`] = vals;
        return self;
      },
      gte(col: string, val: unknown) {
        filters[`gte:${col}`] = val;
        return self;
      },
      order(col: string, opts?: unknown) {
        filters[`order:${col}`] = opts ?? true;
        return self;
      },
      limit(n: number) {
        filters.limit = n;
        return self;
      },
      single: async () => {
        const k = `${op}:single`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters, table }) : { data: null, error: new Error(`no handler for ${table} ${k}`) };
      },
      maybeSingle: async () => {
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h ? h(k, { payload, filters, table }) : { data: null, error: null };
      },
      then(resolve: any) {
        calls.push({ op, table, payload, filters });
        const h = handlers[table];
        const res = h ? h(op, { payload, filters, table }) : { data: null, error: null };
        resolve(res);
      },
    };
    return self;
  }

  return {
    from: (table: string) => builder(table, "select"),
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      if (typeof rpcHandler === "function") return rpcHandler(params);
      const scoped = rpcHandler?.[fn];
      if (scoped) return scoped(params);
      if (fn === "get_household_shared_targets") return { data: [], error: null };
      return { data: null, error: new Error(`no rpc handler for ${fn}`) };
    },
    calls,
    rpcCalls,
  };
}

// ── createHousehold ──────────────────────────────────────────────────

describe("createHousehold", () => {
  it("rejects when userId is empty (caller not authed)", async () => {
    const sb = makeSupabase({});
    const res = await createHousehold(sb as any, "");
    // F-142 (2026-05-10): error envelope `{ code, message, raw }`.
    expect(res.error?.code).toBe("not_authenticated");
    expect(res.data).toBeNull();
    expect(sb.calls).toHaveLength(0);
  });

  it("blocks when the user is already a member of a household", async () => {
    const sb = makeSupabase({
      household_members: (op) => {
        if (op === "select:maybeSingle") return { data: { household_id: "h-existing" }, error: null };
        return { data: null, error: new Error(`unexpected ${op}`) };
      },
    });
    const res = await createHousehold(sb as any, "u1");
    expect(res.error?.code).toBe("already_in_household");
    expect(res.error?.message).toContain("already belong to a household");
    // Should not reach the insert path.
    expect(sb.calls.some((c) => c.op === "insert:single")).toBe(false);
  });

  it("inserts household + owner member + profile link on success", async () => {
    const inserts: Array<{ table: string; payload: unknown }> = [];
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert") {
          inserts.push({ table: "household_members", payload: ctx.payload });
          return { data: null, error: null };
        }
        return { data: null, error: new Error(`unexpected ${op}`) };
      },
      households: (op, ctx) => {
        if (op === "insert:single") {
          inserts.push({ table: "households", payload: ctx.payload });
          return { data: { id: "h1", name: "Team T", invite_code: "abc123" }, error: null };
        }
        return { data: null, error: new Error(`unexpected ${op}`) };
      },
      profiles: (op, ctx) => {
        if (op === "update") {
          inserts.push({ table: "profiles", payload: ctx.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });

    const res = await createHousehold(sb as any, "u1", "  Team T  ");
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      id: "h1",
      name: "Team T",
      invite_code: "abc123",
      isOwner: true,
      myRole: "owner",
    });
    // Name is trimmed before insertion.
    expect(inserts[0]).toEqual({
      table: "households",
      payload: { name: "Team T", owner_id: "u1" },
    });
    // Owner membership row with the right role.
    expect(inserts[1]).toEqual({
      table: "household_members",
      payload: { household_id: "h1", user_id: "u1", role: "owner" },
    });
    // Profile linked.
    expect(inserts[2]).toEqual({
      table: "profiles",
      payload: { household_id: "h1" },
    });
  });

  it("does not insert an orphan household_members row when the households insert fails", async () => {
    // Regression: part of the AB75VswC story is that repeated
    // failed creates shouldn't stockpile membership rows. If the
    // `households.insert` fails the function must return early —
    // never reach the `household_members.insert` step — so a future
    // retry doesn't accumulate orphans that would trip the new
    // unique constraint (or the defensive multi-row read).
    const memberInserts: unknown[] = [];
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert") {
          memberInserts.push(ctx.payload);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      households: (op) => {
        if (op === "insert:single") {
          return { data: null, error: new Error("insert blew up") };
        }
        return { data: null, error: null };
      },
      profiles: () => ({ data: null, error: null }),
    });
    const res = await createHousehold(sb as any, "u1", "Team");
    expect(res.data).toBeNull();
    // F-142 (2026-05-10): error envelope `{ code, message, raw }`.
    // The friendly message replaces the raw PG error string the user
    // used to see; the raw error is preserved on `error.raw` for
    // telemetry / Sentry breadcrumb only (never surfaced to user).
    expect(res.error?.code).toBe("create_household_failed");
    expect(res.error?.message).toContain("Couldn't create your household");
    expect((res.error?.raw as Error)?.message).toBe("insert blew up");
    // The critical invariant: no membership row was inserted.
    expect(memberInserts).toHaveLength(0);
  });

  it("rolls back the just-created household when the members insert fails (F-142)", async () => {
    // F-142 (2026-05-10): "Nothing happens when I try to create a
    // household". The previous code left a zombie `households` row
    // when the `household_members.insert` failed (no transaction).
    // The fix: best-effort DELETE on the household id before
    // returning the error envelope.
    const householdsDeleted: string[] = [];
    const sb = makeSupabase({
      household_members: (op) => {
        if (op === "select:maybeSingle") return { data: null, error: null };
        if (op === "insert") {
          // Force the second-write failure that triggers rollback.
          return { data: null, error: new Error("members RLS denied") };
        }
        return { data: null, error: null };
      },
      households: (op, ctx) => {
        if (op === "insert:single") {
          return { data: { id: "h-orphan", name: "Team", invite_code: "abc" }, error: null };
        }
        if (op === "delete") {
          // makeSupabase records `.eq("col", val)` in `filters['eq:col']`.
          householdsDeleted.push((ctx.filters?.["eq:id"] as string) ?? "(no-id)");
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      profiles: () => ({ data: null, error: null }),
    });
    const res = await createHousehold(sb as any, "u1", "Team");
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("create_member_failed");
    expect(res.error?.message).toContain("Couldn't add you as an owner");
    // The rollback hit `households.delete` with the orphan id.
    expect(householdsDeleted).toContain("h-orphan");
  });

  it("defaults to 'My Household' when no name is supplied", async () => {
    let captured: any = null;
    const sb = makeSupabase({
      household_members: (op) => (op === "select:maybeSingle" ? { data: null, error: null } : { data: null, error: null }),
      households: (op, ctx) => {
        if (op === "insert:single") {
          captured = ctx.payload;
          return { data: { id: "h2", name: (ctx.payload as any).name, invite_code: "xxx" }, error: null };
        }
        return { data: null, error: null };
      },
      profiles: () => ({ data: null, error: null }),
    });
    await createHousehold(sb as any, "u1");
    expect(captured).toEqual({ name: "My Household", owner_id: "u1" });
  });
});

// ── getMyHousehold ──────────────────────────────────────────────────

describe("getMyHousehold", () => {
  it("returns empty shape (not null) when user has no household", async () => {
    const sb = makeSupabase({
      household_members: (op) => (op === "select:maybeSingle" ? { data: null, error: null } : { data: null, error: null }),
    });
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ household: null, members: [], meals: [] });
  });

  it("fetches household, members with remaining macros, and today's meals", async () => {
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") {
          // First call: membership lookup
          return { data: { household_id: "h1", role: "owner" }, error: null };
        }
        if (op === "select") {
          // Second call: member list for the household
          expect(ctx.filters["eq:household_id"]).toBe("h1");
          return {
            data: [
              { id: "m1", user_id: "u1", role: "owner", display_name: "Ada", joined_at: "2026-01-01" },
              { id: "m2", user_id: "u2", role: "member", display_name: null, joined_at: "2026-02-01" },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      households: (op, ctx) => {
        if (op === "select:single") {
          expect(ctx.filters["eq:id"]).toBe("h1");
          return {
            data: {
              id: "h1",
              name: "Fam",
              owner_id: "u1",
              invite_code: "inv1",
              created_at: "2026-01-01",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      household_meals: (op, ctx) => {
        if (op === "select") {
          expect(ctx.filters["gte:date_key"]).toBe(today);
          return {
            data: [
              {
                id: "meal-1",
                date_key: today,
                meal_label: "Dinner",
                recipe_title: "Chili",
                recipe_id: null,
                servings: 4,
                calories_per_serving: 500,
                protein_per_serving: 40,
                carbs_per_serving: 50,
                fat_per_serving: 12,
                fiber_per_serving: 6,
                notes: null,
                added_by: "u1",
                created_at: "2026-04-18",
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      profiles: (op) => {
        if (op === "select") {
          return {
            data: [
              { id: "u1", target_calories: 2200, target_protein: 150, target_carbs: 250, target_fat: 70, display_name: "Ada" },
              { id: "u2", target_calories: 1800, target_protein: 120, target_carbs: 200, target_fat: 60, display_name: "Bea" },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      nutrition_entries: (op, ctx) => {
        if (op === "select") {
          expect(ctx.filters["eq:date_key"]).toBe(today);
          return {
            data: [
              { user_id: "u1", calories: 500, protein: 30, carbs: 40, fat: 10 },
              { user_id: "u2", calories: 1000, protein: 80, carbs: 120, fat: 40 },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    expect(res.data?.household).toMatchObject({
      id: "h1",
      name: "Fam",
      invite_code: "inv1",
      isOwner: true,
      myRole: "owner",
    });
    expect(res.data?.members).toHaveLength(2);
    const ada = res.data!.members.find((m) => m.userId === "u1")!;
    expect(ada.displayName).toBe("Ada");
    // Caller's own row keeps targets + remaining-today numbers.
    expect(ada.remaining?.calories).toBe(1700); // 2200 - 500
    expect(ada.remaining?.protein).toBe(120); // 150 - 30
    const bea = res.data!.members.find((m) => m.userId === "u2")!;
    // Fallback to profile display_name when membership row has none.
    expect(bea.displayName).toBe("Bea");
    // F-16 (2026-04-25): other members' macro targets + remaining-today
    // are stripped server-side per legal-approved scope narrowing
    // (`AJ1AeYJ--fF`). H4 (2026-04-21) extends this with a per-member
    // opt-in via `share_targets` — absent/false flips the block to
    // `null` (not undefined) so the UI's nullish-guard hides it.
    expect(bea.remaining).toBeNull();
    expect(bea.targets).toBeNull();
    expect(bea.shareTargets).toBe(false);
    // Meals passed through verbatim (Dinner survives the F-16 filter).
    expect(res.data?.meals).toHaveLength(1);
    expect(res.data?.meals[0]?.recipe_title).toBe("Chili");
  });

  it("resolves to the most recent membership when legacy duplicates exist (AB75VswC)", async () => {
    // Regression: the 2026-04-19 TestFlight crash on build 9. A
    // user's `household_members` table carried >1 row for the same
    // user_id (orphan from pre-unique-constraint join/leave cycles),
    // so the old `.maybeSingle()` read threw PGRST "multiple rows
    // returned". The defensive read (`order joined_at desc + limit 1
    // + maybeSingle`) must pick the most recent membership and
    // return it without throwing.
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") {
          // Pin that the client is using the defensive ordering.
          expect(ctx.filters["order:joined_at"]).toEqual({ ascending: false });
          expect(ctx.filters.limit).toBe(1);
          // Even though the real DB might return multiple rows, the
          // `.limit(1)` clause collapses to one — emulate that by
          // returning just the newer of the two here. The important
          // assertion is that the call shape would produce a single
          // row against a real Postgres planner.
          return {
            data: { household_id: "h-new", role: "owner", joined_at: "2026-04-01" },
            error: null,
          };
        }
        if (op === "select") {
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
      households: (op) =>
        op === "select:single"
          ? {
              data: {
                id: "h-new",
                name: "Current",
                owner_id: "u1",
                invite_code: "inv-new",
                created_at: "2026-04-01",
              },
              error: null,
            }
          : { data: null, error: null },
      household_meals: () => ({ data: [], error: null }),
      profiles: () => ({ data: [], error: null }),
      nutrition_entries: () => ({ data: [], error: null }),
    });
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    expect(res.data?.household?.id).toBe("h-new");
    expect(res.data?.household?.name).toBe("Current");
  });

  it("returns empty shape when zero membership rows exist (preserves pre-fix behaviour)", async () => {
    const sb = makeSupabase({
      household_members: (op) =>
        op === "select:maybeSingle" ? { data: null, error: null } : { data: null, error: null },
    });
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ household: null, members: [], meals: [] });
  });

  it("prefers live profile.display_name over the membership snapshot (dead-name guard)", async () => {
    // Regression (2026-04-19, diversity-inclusion P0): the
    // `household_members.display_name` column is a snapshot captured at
    // join time. If a user updates their profile display name (e.g. a
    // trans user post-transition), other members of the household must
    // see the current name, NEVER the legacy snapshot. The client must
    // prefer `profiles.display_name` over the membership snapshot.
    const sb = makeSupabase({
      household_members: (op, _ctx) => {
        if (op === "select:maybeSingle") {
          return { data: { household_id: "h1", role: "member" }, error: null };
        }
        if (op === "select") {
          return {
            data: [
              // Caller (u1) sees u2's row. u2's membership row has a
              // stale snapshot "Legacy" left over from before the name
              // change; the live profile now says "Current".
              { id: "m1", user_id: "u1", role: "member", display_name: "Caller", joined_at: "2026-01-01" },
              { id: "m2", user_id: "u2", role: "member", display_name: "Legacy", joined_at: "2026-02-01" },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      households: (op) =>
        op === "select:single"
          ? { data: { id: "h1", name: "Fam", owner_id: "u1", invite_code: "c", created_at: "t" }, error: null }
          : { data: null, error: null },
      household_meals: () => ({ data: [], error: null }),
      profiles: () => ({
        data: [
          { id: "u1", target_calories: null, target_protein: null, target_carbs: null, target_fat: null, display_name: "Caller" },
          { id: "u2", target_calories: null, target_protein: null, target_carbs: null, target_fat: null, display_name: "Current" },
        ],
        error: null,
      }),
      nutrition_entries: () => ({ data: [], error: null }),
    });
    const res = await getMyHousehold(sb as any, "u1");
    const u2 = res.data!.members.find((m) => m.userId === "u2")!;
    expect(u2.displayName).toBe("Current");
    expect(u2.displayName).not.toBe("Legacy");
  });

  it("marks isOwner false when the household owner_id does not match", async () => {
    const sb = makeSupabase({
      household_members: (op) => {
        if (op === "select:maybeSingle") return { data: { household_id: "h1", role: "member" }, error: null };
        if (op === "select") return { data: [], error: null };
        return { data: null, error: null };
      },
      households: (op) => (op === "select:single"
        ? { data: { id: "h1", name: "X", owner_id: "someone-else", invite_code: "c", created_at: "t" }, error: null }
        : { data: null, error: null }),
      household_meals: () => ({ data: [], error: null }),
      profiles: () => ({ data: [], error: null }),
      nutrition_entries: () => ({ data: [], error: null }),
    });
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.data?.household?.isOwner).toBe(false);
    expect(res.data?.household?.myRole).toBe("member");
  });
});

/**
 * ENG-1602 (2026-07-21) — household share_targets opt-in never delivered
 * real cross-member numbers.
 *
 * CONFIRMED ROOT CAUSE (verified live against prod): `profiles` and
 * `nutrition_entries` SELECT RLS is strictly self-only with no household
 * carve-out, so the OLD cross-member `.in(...)` read in `getMyHousehold`
 * silently returned zero rows in production (RLS just filters, no error).
 * The client masked that with hardcoded 2000/130/250/65 fallback numbers
 * — every opted-in member rendered identical fabricated data regardless
 * of their real goals or intake.
 *
 * THE FIX: co-member targets/consumed now come exclusively from the
 * `get_household_shared_targets` SECURITY DEFINER RPC (see
 * `supabase/migrations/20260721100000_eng1602_household_shared_targets_rpc.sql`),
 * which re-verifies co-membership + `share_targets = true` server-side.
 * These tests pin:
 *   1. An opted-in member's REAL numbers (from the RPC) render — not the
 *      old 2000/130/250/65 fallback.
 *   2. A non-opted-in member still renders the distinct "not sharing"
 *      state (null targets/remaining) — never fabricated numbers.
 *   3. No cross-member direct table query remains: the nutrition_entries
 *      read is scoped to the caller only (`eq:user_id`, never
 *      `in:user_id` with the full member list), and the RPC is the only
 *      path that ever supplies another member's data.
 */
describe("getMyHousehold — ENG-1602 shared-targets RPC", () => {
  function makeSharedTargetsFixture(rpcData: unknown) {
    return makeSupabase(
      {
        household_members: (op, ctx) => {
          if (op === "select:maybeSingle") {
            return { data: { household_id: "h1", role: "owner", joined_at: "2026-01-01" }, error: null };
          }
          if (op === "select") {
            expect(ctx.filters["eq:household_id"]).toBe("h1");
            return {
              data: [
                { id: "m1", user_id: "u1", role: "owner", display_name: "Ada", joined_at: "2026-01-01", share_targets: false },
                { id: "m2", user_id: "u2", role: "member", display_name: "Bea", joined_at: "2026-02-01", share_targets: true },
                { id: "m3", user_id: "u3", role: "member", display_name: "Cy", joined_at: "2026-03-01", share_targets: false },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        },
        households: (op) =>
          op === "select:single"
            ? { data: { id: "h1", name: "Fam", owner_id: "u1", invite_code: "inv", created_at: "2026-01-01" }, error: null }
            : { data: null, error: null },
        household_meals: () => ({ data: [], error: null }),
        // Self (u1) only — RLS never actually returns u2/u3 here in
        // production, so the fixture doesn't pretend otherwise.
        profiles: () => ({
          data: [{ id: "u1", target_calories: 2400, target_protein: 160, target_carbs: 260, target_fat: 75, display_name: "Ada" }],
          error: null,
        }),
        nutrition_entries: (op, ctx) => {
          if (op === "select") {
            // The critical assertion: self-scoped ONLY. No `.in(...)`
            // with the full member list survives — that was the
            // RLS-inert cross-member query this ticket removes.
            expect(ctx.filters["eq:user_id"]).toBe("u1");
            expect(ctx.filters["in:user_id"]).toBeUndefined();
            return { data: [{ user_id: "u1", calories: 600, protein: 40, carbs: 60, fat: 20 }], error: null };
          }
          return { data: null, error: null };
        },
      },
      { get_household_shared_targets: () => ({ data: rpcData, error: null }) },
    );
  }

  it("renders an opted-in member's REAL numbers from the RPC, not the 2000/130/250/65 fallback", async () => {
    const sb = makeSharedTargetsFixture([
      {
        user_id: "u2",
        target_calories: 1900,
        target_protein: 140,
        target_carbs: 180,
        target_fat: 55,
        consumed_calories: 700,
        consumed_protein: 50,
        consumed_carbs: 60,
        consumed_fat: 25,
      },
    ]);
    const res = await getMyHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    const bea = res.data!.members.find((m) => m.userId === "u2")!;
    expect(bea.shareTargets).toBe(true);
    // Real RPC numbers, not the fallback.
    expect(bea.targets).toEqual({ calories: 1900, protein: 140, carbs: 180, fat: 55 });
    expect(bea.targets?.calories).not.toBe(2000);
    expect(bea.targets?.protein).not.toBe(130);
    expect(bea.consumed).toEqual({ calories: 700, protein: 50, carbs: 60, fat: 25 });
    expect(bea.remaining).toEqual({ calories: 1200, protein: 90, carbs: 120, fat: 30 });

    // The RPC was actually invoked, with the caller's own local date key.
    expect(sb.rpcCalls).toHaveLength(1);
    expect(sb.rpcCalls[0]?.fn).toBe("get_household_shared_targets");
    expect(sb.rpcCalls[0]?.params).toHaveProperty("p_date_key");
  });

  it("a non-opted-in member renders the distinct 'not sharing' state — never fabricated numbers", async () => {
    // Cy (u3) has share_targets=false; even if the RPC somehow returned
    // a row for u3 (it shouldn't — server-side re-check), the client
    // must never reach for it once share_targets is false client-side.
    const sb = makeSharedTargetsFixture([
      { user_id: "u2", target_calories: 1900, target_protein: 140, target_carbs: 180, target_fat: 55, consumed_calories: 0, consumed_protein: 0, consumed_carbs: 0, consumed_fat: 0 },
    ]);
    const res = await getMyHousehold(sb as any, "u1");
    const cy = res.data!.members.find((m) => m.userId === "u3")!;
    expect(cy.shareTargets).toBe(false);
    // Explicitly null (the distinct "not sharing" state), not a
    // fabricated-but-plausible-looking number.
    expect(cy.targets).toBeNull();
    expect(cy.remaining).toBeNull();
    expect(cy.consumed).toBeUndefined();
  });

  it("an opted-in member with no matching RPC row renders null, never the old fallback numbers", async () => {
    const sb = makeSharedTargetsFixture([]); // RPC returns nothing for u2.
    const res = await getMyHousehold(sb as any, "u1");
    const bea = res.data!.members.find((m) => m.userId === "u2")!;
    expect(bea.shareTargets).toBe(true);
    expect(bea.targets).toBeNull();
    expect(bea.remaining).toBeNull();
  });

  it("the caller's own row is unaffected by the RPC path (self reads stay direct-RLS)", async () => {
    const sb = makeSharedTargetsFixture([]);
    const res = await getMyHousehold(sb as any, "u1");
    const self = res.data!.members.find((m) => m.userId === "u1")!;
    expect(self.targets).toEqual({ calories: 2400, protein: 160, carbs: 260, fat: 75 });
    expect(self.consumed).toEqual({ calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(self.remaining).toEqual({ calories: 1800, protein: 120, carbs: 200, fat: 55 });
  });
});

// ── joinHouseholdByInviteCode ───────────────────────────────────────

describe("joinHouseholdByInviteCode", () => {
  it("rejects missing / whitespace-only code before hitting the RPC", async () => {
    const sb = makeSupabase({});
    const res = await joinHouseholdByInviteCode(sb as any, "   ");
    expect(res.error).toBe("missing_code");
    expect(sb.rpcCalls).toHaveLength(0);
  });

  it("calls the security-definer RPC with trimmed code + display name", async () => {
    const sb = makeSupabase({}, (_params) => ({
      data: { ok: true, household_id: "h1", household_name: "Fam", already_member: false },
      error: null,
    }));
    const res = await joinHouseholdByInviteCode(sb as any, "  INV1  ", "  Ada  ");
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ household_id: "h1", household_name: "Fam", already_member: false });
    expect(sb.rpcCalls).toEqual([
      {
        fn: "household_join_by_invite_code",
        params: { p_invite_code: "INV1", p_display_name: "Ada" },
      },
    ]);
  });

  it("surfaces RPC domain errors as `error` code, not throws", async () => {
    const cases: Array<{ rpc: any; expected: string }> = [
      { rpc: { ok: false, error: "invalid_code", message: "nope" }, expected: "invalid_code" },
      { rpc: { ok: false, error: "household_full", message: "cap" }, expected: "household_full" },
      { rpc: { ok: false, error: "already_in_household" }, expected: "already_in_household" },
      { rpc: { ok: false }, expected: "join_failed" },
    ];
    for (const c of cases) {
      const sb = makeSupabase({}, () => ({ data: c.rpc, error: null }));
      const res = await joinHouseholdByInviteCode(sb as any, "inv1");
      expect(res.data).toBeNull();
      expect(res.error).toBe(c.expected);
    }
  });

  it("passes through idempotent already_member flag on success", async () => {
    const sb = makeSupabase({}, () => ({
      data: { ok: true, household_id: "h1", household_name: "Fam", already_member: true },
      error: null,
    }));
    const res = await joinHouseholdByInviteCode(sb as any, "inv1");
    expect(res.data?.already_member).toBe(true);
  });

  it("throws on unexpected infrastructure error (RLS / network)", async () => {
    const sb = makeSupabase({}, () => ({ data: null, error: new Error("permission denied") }));
    await expect(joinHouseholdByInviteCode(sb as any, "inv1")).rejects.toThrow(/permission denied/);
  });
});

// ── leaveHousehold ──────────────────────────────────────────────────

describe("leaveHousehold", () => {
  it("rejects when userId is missing", async () => {
    const sb = makeSupabase({});
    const res = await leaveHousehold(sb as any, "");
    expect(res.error).toBe("not_authenticated");
  });

  it("returns not_in_household when the user has no membership row", async () => {
    const sb = makeSupabase({
      household_members: (op) => (op === "select:maybeSingle" ? { data: null, error: null } : { data: null, error: null }),
    });
    const res = await leaveHousehold(sb as any, "u1");
    expect(res.error).toBe("not_in_household");
  });

  it("owner leaves → deletes the whole household (FK cascade) + nulls own profile", async () => {
    const ops: string[] = [];
    const sb = makeSupabase({
      household_members: (op) => {
        if (op === "select:maybeSingle") return { data: { household_id: "h1", role: "owner" }, error: null };
        return { data: null, error: null };
      },
      households: (op, ctx) => {
        if (op === "delete") {
          ops.push(`households:delete:${ctx.filters["eq:id"]}`);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      profiles: (op, ctx) => {
        if (op === "update") {
          ops.push(`profiles:update:${ctx.filters["eq:id"]}:${JSON.stringify(ctx.payload)}`);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await leaveHousehold(sb as any, "u1");
    expect(res.error).toBeNull();
    expect(res.data?.wasOwner).toBe(true);
    expect(ops).toContain("households:delete:h1");
    expect(ops).toContain(`profiles:update:u1:{"household_id":null}`);
  });

  it("member leave resets BOTH household_members row AND profiles.household_id (invariant)", async () => {
    // Structural pin of the both-sources-of-truth invariant called
    // out in `leaveHousehold`'s leading comment: dropping either
    // side is how duplicate memberships accumulated historically
    // (AB75VswC). This test fails loudly if someone removes one of
    // the two writes.
    const ops: string[] = [];
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") {
          return { data: { household_id: "h1", role: "member" }, error: null };
        }
        if (op === "delete") {
          ops.push(
            `household_members:delete:${ctx.filters["eq:household_id"]}:${ctx.filters["eq:user_id"]}`,
          );
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      profiles: (op, ctx) => {
        if (op === "update") {
          ops.push(
            `profiles:update:${ctx.filters["eq:id"]}:${JSON.stringify(ctx.payload)}`,
          );
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await leaveHousehold(sb as any, "u7");
    expect(res.error).toBeNull();
    expect(ops).toContain("household_members:delete:h1:u7");
    expect(ops).toContain('profiles:update:u7:{"household_id":null}');
  });

  it("member leaves → deletes only their membership row", async () => {
    const ops: string[] = [];
    const sb = makeSupabase({
      household_members: (op, ctx) => {
        if (op === "select:maybeSingle") return { data: { household_id: "h1", role: "member" }, error: null };
        if (op === "delete") {
          ops.push(`household_members:delete:${ctx.filters["eq:household_id"]}:${ctx.filters["eq:user_id"]}`);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      households: (op) => {
        // Members must NEVER trigger a households delete.
        if (op === "delete") ops.push("households:delete:LEAKED");
        return { data: null, error: null };
      },
      profiles: (op, ctx) => {
        if (op === "update") {
          ops.push(`profiles:update:${ctx.filters["eq:id"]}`);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await leaveHousehold(sb as any, "u2");
    expect(res.error).toBeNull();
    expect(res.data?.wasOwner).toBe(false);
    expect(ops).toContain("household_members:delete:h1:u2");
    expect(ops).toContain("profiles:update:u2");
    expect(ops).not.toContain("households:delete:LEAKED");
  });
});

/**
 * Build 41 (2026-05-01) — household calorie-aggregation date-key bug.
 *
 * Background: `nutrition_entries.date_key` and `household_meals.date_key`
 * are written from the user's LOCAL calendar date everywhere else in
 * the app. Until this build, `getMyHousehold` queried with the UTC
 * date (`new Date().toISOString().slice(0,10)`). When local-date and
 * UTC-date diverged (late evening / early morning, or any non-zero
 * UTC-offset), the query missed today's entries and sometimes pulled
 * yesterday's — producing the "calories wildly high vs target"
 * feedback (TestFlight `AJ_dfDvM2j6rnkOAgHTpwig`).
 *
 * The fix is in `todayKey()`: now uses local-calendar derivation
 * (matches `dateKeyFromDate` in src/lib/nutrition/journalNavigation).
 */
describe("getMyHousehold — Build 41 local-calendar date_key", () => {
  it("queries with the LOCAL date_key, not the UTC date_key", async () => {
    let observedEntriesKey: unknown = "<<unset>>";
    let observedMealsKey: unknown = "<<unset>>";
    const sb = makeSupabase({
      household_members: (op, _ctx) => {
        if (op === "select:maybeSingle") return { data: { household_id: "h1", role: "owner" }, error: null };
        if (op === "select") {
          return {
            data: [{ id: "m1", user_id: "u1", role: "owner", display_name: "G", joined_at: "2026-01-01" }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      households: (op) => {
        if (op === "select:single") {
          return {
            data: { id: "h1", name: "F", owner_id: "u1", invite_code: "i", created_at: "2026-01-01" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      household_meals: (op, ctx) => {
        if (op === "select") {
          observedMealsKey = ctx.filters["gte:date_key"];
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
      profiles: (op) => {
        if (op === "select") {
          return {
            data: [{ id: "u1", target_calories: 2200, target_protein: 150, target_carbs: 250, target_fat: 70, display_name: "G" }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
      nutrition_entries: (op, ctx) => {
        if (op === "select") {
          observedEntriesKey = ctx.filters["eq:date_key"];
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });

    await getMyHousehold(sb as any, "u1");

    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now.getTime() - 86_400_000);
    const localYesterday = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    // Either today or yesterday-by-1ms is acceptable around midnight.
    expect([localToday, localYesterday]).toContain(observedEntriesKey as string);
    expect([localToday, localYesterday]).toContain(observedMealsKey as string);

    // When UTC and local dates differ today, the new code MUST emit the local one.
    const utcToday = now.toISOString().slice(0, 10);
    if (utcToday !== localToday) {
      expect(observedEntriesKey).toBe(localToday);
      expect(observedMealsKey).toBe(localToday);
    }
  });
});

