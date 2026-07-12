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

  it("F-145 — resolves maintenance via the canonical helper so the snapshot matches Today", async () => {
    // Pre-fix: snapshot stored raw `profile.adaptive_tdee`, which
    // could be null even when body stats are sufficient to compute a
    // formula maintenance. Past-day reads then fell back to live
    // `currentTargets`, producing the "1900 today vs 1600 past"
    // divergence Grace flagged in 2026-05-10. Now the snapshot
    // delegates to `resolveMaintenance` which prefers adaptive (when
    // confident + non-stale) and falls back to Mifflin-St Jeor with
    // the user's body stats. Same number Today shows, frozen for
    // history.
    const sb = makeSupabase({
      profiles: () => ({
        data: {
          target_calories: 2000,
          target_protein: 130,
          target_carbs: 230,
          target_fat: 65,
          target_fiber_g: 28,
          activity_level: "moderate",
          plan_pace: "steady",
          goal: "maintain",
          // No adaptive yet — canonical "early days" user. Pre-fix
          // would have stored null here. Post-fix uses the formula.
          adaptive_tdee: null,
          adaptive_tdee_confidence: null,
          adaptive_tdee_updated_at: null,
          sex: "female",
          weight_kg: 70,
          height_cm: 170,
          age: 30,
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
    // Mifflin-St Jeor for a 30 y/o 70 kg / 170 cm female × moderate
    // (1.55) is roughly 2,200 kcal — the snapshot now stores a real
    // number, not null.
    expect(insertCall!.payload.maintenance_tdee).toBeGreaterThan(1500);
    expect(insertCall!.payload.maintenance_tdee).toBeLessThan(3000);
    expect(typeof insertCall!.payload.maintenance_tdee).toBe("number");
  });

  it("F-149 — backfillDailyTargetsFromProfile upserts past-day snapshots from the OLD profile", async () => {
    const { backfillDailyTargetsFromProfile } = await import("@/lib/nutrition/dailyTargetSnapshot");
    const sb = makeSupabase({
      daily_targets: () => ({ data: null, error: null }),
    });
    const oldProfile = {
      target_calories: 1500,
      target_protein: 110,
      target_carbs: 180,
      target_fat: 50,
      target_fiber_g: 25,
      activity_level: "moderate",
      plan_pace: "0.5kg",
      goal: "lose",
      adaptive_tdee: 2000,
      adaptive_tdee_confidence: "medium",
      adaptive_tdee_updated_at: "2026-05-05T12:00:00Z",
      sex: "female",
      weight_kg: 70,
      height_cm: 170,
      age: 30,
    };
    const out = await backfillDailyTargetsFromProfile(sb as any, "u1", oldProfile, {
      now: new Date("2026-04-19T12:00:00Z"),
    });
    expect(out.attempted).toBe(30);
    expect(out.ok).toBe(true);
    const upsertCall = sb.calls.find((c) => c.table === "daily_targets" && c.op === "upsert");
    expect(upsertCall).toBeDefined();
    const rows = (upsertCall!.payload as any[]) ?? [];
    expect(rows.length).toBe(30);
    // Every row carries the OLD targets.
    for (const row of rows) {
      expect(row.target_calories).toBe(1500);
      expect(row.target_protein_g).toBe(110);
      expect(row.user_id).toBe("u1");
    }
    // First-write-wins protects existing snapshots.
    expect(upsertCall!.options).toMatchObject({ onConflict: "user_id,date_key", ignoreDuplicates: true });
    // Date keys are yesterday → 30 days ago, not today.
    const dateKeys = rows.map((r: any) => r.date_key);
    expect(dateKeys).not.toContain("2026-04-19");
    expect(dateKeys).toContain("2026-04-18");
    expect(dateKeys).toContain("2026-03-20");
  });

  it("F-149 — backfill no-ops when target_calories is missing (pre-onboarding)", async () => {
    const { backfillDailyTargetsFromProfile } = await import("@/lib/nutrition/dailyTargetSnapshot");
    const sb = makeSupabase({});
    const out = await backfillDailyTargetsFromProfile(sb as any, "u1", {
      target_calories: null,
    });
    expect(out.attempted).toBe(0);
    expect(out.ok).toBe(false);
    expect(sb.calls.some((c) => c.table === "daily_targets")).toBe(false);
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

describe("ENG-1506 (review round) — writer input policy is flag-gated via canonicalEnergyInputs", () => {
  // `daily_targets` is first-write-wins/frozen: while `energy_numbers_v1`
  // is OFF the writer must freeze the SAME maintenance every flag-OFF
  // display surface shows (the pre-ENG-1506 assembly — snapshot weight,
  // no weigh-in map). An unflagged early adoption of the canonical
  // latest-weigh-in policy would be un-fixable by the kill switch. Hosts
  // read the flag and pass `canonicalEnergyInputs` (shared module — the
  // netEnergyBalance host-owns-the-flag pattern).
  //
  // Fixture: snapshot weight 80 kg, latest weigh-in 60 kg, no adaptive —
  // the formula path, where the weight choice directly moves the kcal.
  const divergentProfile = {
    target_calories: 2000,
    target_protein: 130,
    target_carbs: 230,
    target_fat: 65,
    target_fiber_g: 28,
    activity_level: "moderate",
    plan_pace: "steady",
    goal: "maintain",
    adaptive_tdee: null,
    adaptive_tdee_confidence: null,
    adaptive_tdee_updated_at: null,
    sex: "male",
    weight_kg: 80,
    weight_kg_by_day: { "2026-04-01": 62, "2026-04-18": 60 },
    height_cm: 180,
    age: 30,
  };

  async function snapshotMaintenance(opts?: { canonicalEnergyInputs?: boolean }) {
    const sb = makeSupabase({
      profiles: () => ({ data: divergentProfile, error: null }),
      daily_targets: () => ({ data: null, error: null }),
    });
    const wrote = await snapshotDailyTargetIfMissing(sb as any, "u1", {
      now: new Date("2026-04-19T12:00:00Z"),
      ...opts,
    });
    expect(wrote).toBe(true);
    const call = sb.calls.find((c) => c.table === "daily_targets" && c.op === "upsert");
    return (call!.payload as { maintenance_tdee: number }).maintenance_tdee;
  }

  it("default (flag OFF): legacy assembly — snapshot weight wins, weigh-in map ignored", async () => {
    const legacy = await snapshotMaintenance();
    const legacyExplicit = await snapshotMaintenance({ canonicalEnergyInputs: false });
    expect(legacy).toBe(legacyExplicit);
    // 80 kg formula, byte-identical to main's assembly.
    const { resolveMaintenance } = await import("@/lib/nutrition/resolveMaintenance");
    const expected = resolveMaintenance(
      {
        sex: "male",
        weight_kg: 80,
        height_cm: 180,
        age: 30,
        activity_level: "moderate",
        adaptive_tdee: null,
        adaptive_tdee_confidence: null,
        adaptive_tdee_updated_at: null,
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(legacy).toBe(expected!.kcal);
  });

  it("canonicalEnergyInputs: true (flag ON): buildMaintenanceInputs — latest weigh-in wins", async () => {
    const canonical = await snapshotMaintenance({ canonicalEnergyInputs: true });
    const legacy = await snapshotMaintenance();
    const { resolveMaintenance } = await import("@/lib/nutrition/resolveMaintenance");
    const { buildMaintenanceInputs } = await import("@/lib/nutrition/energyNumbers");
    const expected = resolveMaintenance(buildMaintenanceInputs(divergentProfile), {
      now: new Date("2026-04-19T12:00:00Z"),
    });
    expect(canonical).toBe(expected!.kcal);
    // The 80 kg vs 60 kg skew MUST move the number — proving the two
    // paths are genuinely different for this fixture.
    expect(canonical).not.toBe(legacy);
    expect(canonical).toBeLessThan(legacy);
  });

  it("backfill honours the same gate", async () => {
    const { backfillDailyTargetsFromProfile } = await import("@/lib/nutrition/dailyTargetSnapshot");
    async function backfillMaintenance(canonicalEnergyInputs?: boolean) {
      const sb = makeSupabase({ daily_targets: () => ({ data: null, error: null }) });
      const out = await backfillDailyTargetsFromProfile(sb as any, "u1", divergentProfile, {
        now: new Date("2026-04-19T12:00:00Z"),
        lookbackDays: 3,
        canonicalEnergyInputs,
      });
      expect(out.ok).toBe(true);
      const call = sb.calls.find((c) => c.table === "daily_targets" && c.op === "upsert");
      const rows = call!.payload as Array<{ maintenance_tdee: number }>;
      return rows[0]!.maintenance_tdee;
    }
    const legacy = await backfillMaintenance(undefined);
    const canonical = await backfillMaintenance(true);
    expect(canonical).toBeLessThan(legacy);
  });
});
