/**
 * F-2 · Daily target snapshot write-path tests.
 *
 * Exercises `snapshotDailyTargetIfMissing` against a Supabase-compatible
 * mock. The helper is the single shared write path for both web and
 * mobile; a bug here would mean past-day "% of goal" percentages start
 * moving again when a user edits `activity_level` / `plan_pace` /
 * `goal`, reintroducing TestFlight feedback `AEyOuUJrB4l` (2026-04-19).
 *
 * We do not touch a real Supabase here — we assert the shape of the
 * inserts that would be dispatched (which is exactly what the table's
 * RLS policies and PK guarantee lock into place). Integration tests
 * against a seeded Supabase project are deferred to qa-lead.
 */
import { describe, expect, it } from "vitest";
import { snapshotDailyTargetIfMissing } from "@/lib/nutrition/dailyTargetSnapshot";

type Call = {
  op: string;
  table: string;
  payload?: unknown;
  options?: unknown;
  filters: Record<string, unknown>;
};

function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (op: string, ctx: { filters: Record<string, unknown>; table: string }) => {
        data: unknown;
        error: unknown;
      }
    >
  >,
) {
  const calls: Call[] = [];
  function builder(table: string, op: string, payload?: unknown, options?: unknown) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select(_cols: string) {
        return self;
      },
      upsert(p: unknown, o?: unknown) {
        return builder(table, "upsert", p, o);
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      maybeSingle: async () => {
        const h = handlers[table];
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, options, filters });
        return h?.(k, { filters, table }) ?? { data: null, error: null };
      },
      then(resolve: any) {
        const h = handlers[table];
        calls.push({ op, table, payload, options, filters });
        const res = h?.(op, { filters, table }) ?? { data: null, error: null };
        resolve(res);
      },
    };
    return self;
  }
  return {
    from: (table: string) => builder(table, "select"),
    calls,
  };
}

const profileRow = {
  target_calories: 2100,
  target_protein: 140,
  target_carbs: 250,
  target_fat: 70,
  target_fiber_g: 30,
  activity_level: "sedentary",
  plan_pace: "steady",
  goal: "maintain",
  adaptive_tdee: 2100,
};

describe("snapshotDailyTargetIfMissing", () => {
  it("no-ops when userId is missing", async () => {
    const sb = makeSupabase({});
    const wrote = await snapshotDailyTargetIfMissing(sb as any, null);
    expect(wrote).toBe(false);
    expect(sb.calls).toHaveLength(0);
  });

  it("no-ops when the profile has no target_calories (pre-onboarding)", async () => {
    const sb = makeSupabase({
      profiles: () => ({
        data: { ...profileRow, target_calories: null },
        error: null,
      }),
    });
    const wrote = await snapshotDailyTargetIfMissing(sb as any, "u1");
    expect(wrote).toBe(false);
    // We read the profile but MUST NOT attempt an upsert — a null
    // calorie snapshot would leak into the read path as "N% of null".
    expect(sb.calls.some((c) => c.table === "daily_targets")).toBe(false);
  });

  it("writes a snapshot row keyed on (user_id, today) when the profile has targets", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: profileRow, error: null }),
      daily_targets: () => ({ data: null, error: null }),
    });
    const wrote = await snapshotDailyTargetIfMissing(sb as any, "u1", {
      now: new Date("2026-04-19T12:00:00Z"),
    });
    expect(wrote).toBe(true);
    const insertCall = sb.calls.find((c) => c.table === "daily_targets" && c.op === "upsert");
    expect(insertCall).toBeDefined();
    expect(insertCall!.payload).toEqual({
      user_id: "u1",
      date_key: "2026-04-19",
      target_calories: 2100,
      target_protein_g: 140,
      target_carbs_g: 250,
      target_fat_g: 70,
      target_fiber_g: 30,
      activity_level: "sedentary",
      plan_pace: "steady",
      goal: "maintain",
      maintenance_tdee: 2100,
    });
    // `ignoreDuplicates: true` is the load-bearing knob — without it,
    // the second log of the day would overwrite the snapshot with a
    // fresh target (reintroducing the original AEyOuUJrB4l bug).
    expect(insertCall!.options).toMatchObject({
      onConflict: "user_id,date_key",
      ignoreDuplicates: true,
    });
  });

  it("first-log-of-day writes — subsequent logs on the same day are no-ops at the DB level", async () => {
    // The helper itself always issues the upsert — it's the `on conflict
    // do nothing` clause (via `ignoreDuplicates: true`) that makes the
    // second call a harmless no-op. We assert both calls dispatch the
    // same upsert options so the guarantee is preserved.
    const sb = makeSupabase({
      profiles: () => ({ data: profileRow, error: null }),
      daily_targets: () => ({ data: null, error: null }),
    });
    await snapshotDailyTargetIfMissing(sb as any, "u1", { now: new Date("2026-04-19T08:00:00Z") });
    await snapshotDailyTargetIfMissing(sb as any, "u1", { now: new Date("2026-04-19T13:00:00Z") });
    const upserts = sb.calls.filter((c) => c.table === "daily_targets" && c.op === "upsert");
    expect(upserts).toHaveLength(2);
    for (const call of upserts) {
      expect(call.options).toMatchObject({
        onConflict: "user_id,date_key",
        ignoreDuplicates: true,
      });
      expect((call.payload as any).date_key).toBe("2026-04-19");
    }
  });

  it("swallows insert errors so a log is never rolled back by a snapshot failure", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: profileRow, error: null }),
      daily_targets: () => ({
        data: null,
        error: { message: "relation \"daily_targets\" does not exist" },
      }),
    });
    const wrote = await snapshotDailyTargetIfMissing(sb as any, "u1");
    // Reports not-written, but never throws.
    expect(wrote).toBe(false);
  });

  it("preserves null/unset optional columns without fabricating defaults", async () => {
    const sb = makeSupabase({
      profiles: () => ({
        data: {
          target_calories: 1800,
          target_protein: 120,
          target_carbs: null,
          target_fat: null,
          target_fiber_g: null,
          activity_level: null,
          plan_pace: null,
          goal: null,
          adaptive_tdee: null,
        },
        error: null,
      }),
      daily_targets: () => ({ data: null, error: null }),
    });
    const wrote = await snapshotDailyTargetIfMissing(sb as any, "u1", {
      now: new Date("2026-04-19T12:00:00Z"),
    });
    expect(wrote).toBe(true);
    const insertCall = sb.calls.find((c) => c.table === "daily_targets" && c.op === "upsert");
    expect(insertCall!.payload).toEqual({
      user_id: "u1",
      date_key: "2026-04-19",
      target_calories: 1800,
      target_protein_g: 120,
      target_carbs_g: null,
      target_fat_g: null,
      target_fiber_g: null,
      activity_level: null,
      plan_pace: null,
      goal: null,
      maintenance_tdee: null,
    });
  });
});
