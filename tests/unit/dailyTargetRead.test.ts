/**
 * F-2 · Daily target snapshot read-path tests.
 *
 * Covers `getDailyTargets` and `resolveDisplayTarget`. The read helper
 * is the shared contract that every "past-day % of goal" surface uses
 * (mobile `(tabs)/progress.tsx`, mobile `progress-metric.tsx`, web
 * `ProgressDashboard.tsx`, web `ProgressMetricDetail.tsx`). The key
 * guarantees are:
 *
 *   1. Every requested date_key appears in the result map — callers
 *      don't have to gracefully handle missing keys.
 *   2. Days without a snapshot map to `null`, NOT to a fabricated
 *      "probably was" target. That's exactly the bug we're fixing:
 *      reconstruction-from-current-profile is what makes old days move
 *      when the user edits their plan.
 *   3. `resolveDisplayTarget` only flags `isSnapshot: true` when a real
 *      snapshot row is present, so the UI can surface an "approx" chip
 *      for pre-migration days.
 */
import { describe, expect, it } from "vitest";
import {
  getDailyTargets,
  resolveDisplayTarget,
} from "@/lib/nutrition/dailyTargetRead";

type Call = {
  op: string;
  table: string;
  filters: Record<string, unknown>;
};

function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (op: string, ctx: { filters: Record<string, unknown> }) => {
        data: unknown;
        error: unknown;
      }
    >
  >,
) {
  const calls: Call[] = [];
  function builder(table: string, op: string) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select(_cols: string) {
        return self;
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      in(col: string, vals: unknown[]) {
        filters[`in:${col}`] = vals;
        return self;
      },
      // F-149: goal_history fallback uses .lte() + .order(). Stubs
      // return self so the chain resolves; handlers can introspect
      // `filters['lte:effective_from']` if a test wants to.
      lte(col: string, val: unknown) {
        filters[`lte:${col}`] = val;
        return self;
      },
      order(_col: string, _opts: unknown) {
        return self;
      },
      limit(_n: number) {
        return self;
      },
      then(resolve: any) {
        const h = handlers[table];
        calls.push({ op, table, filters });
        const res = h?.(op, { filters }) ?? { data: [], error: null };
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

describe("getDailyTargets", () => {
  it("returns an empty map when no userId is supplied", async () => {
    const sb = makeSupabase({});
    const res = await getDailyTargets(sb as any, null, ["2026-04-18", "2026-04-19"]);
    expect(res).toEqual({ "2026-04-18": null, "2026-04-19": null });
    expect(sb.calls).toHaveLength(0);
  });

  it("returns an empty map when no dateKeys are supplied", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({ data: [], error: null }),
    });
    const res = await getDailyTargets(sb as any, "u1", []);
    expect(res).toEqual({});
    expect(sb.calls).toHaveLength(0);
  });

  it("populates each requested date_key, leaving unmatched days as null", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({
        data: [
          {
            date_key: "2026-04-18",
            target_calories: 1800,
            target_protein_g: 120,
            target_carbs_g: 200,
            target_fat_g: 60,
            target_fiber_g: 25,
            activity_level: "sedentary",
            plan_pace: "steady",
            goal: "maintain",
            maintenance_tdee: 1850,
          },
        ],
        error: null,
      }),
    });
    const res = await getDailyTargets(sb as any, "u1", [
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
    ]);
    // Days without a snapshot MUST stay null — we never fabricate a
    // "probable" target, because that's exactly the retroactive-move
    // bug the feature is closing.
    expect(res["2026-04-17"]).toBeNull();
    expect(res["2026-04-19"]).toBeNull();
    expect(res["2026-04-18"]).toEqual({
      dateKey: "2026-04-18",
      targetCalories: 1800,
      targetProteinG: 120,
      targetCarbsG: 200,
      targetFatG: 60,
      targetFiberG: 25,
      activityLevel: "sedentary",
      planPace: "steady",
      goal: "maintain",
      maintenanceTdee: 1850,
    });
  });

  it("returns null-for-every-day when the table is missing (pre-migration)", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({
        data: null,
        error: { message: "relation \"daily_targets\" does not exist" },
      }),
    });
    const res = await getDailyTargets(sb as any, "u1", ["2026-04-18", "2026-04-19"]);
    expect(res).toEqual({ "2026-04-18": null, "2026-04-19": null });
  });

  it("F-149 — falls back to goal_history when no daily_targets snapshot exists", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({ data: [], error: null }),
      goal_history: () => ({
        data: [
          {
            goal: "cut",
            plan_pace: "steady",
            activity_level: "moderate",
            target_calories: 1900,
            target_protein_g: 140,
            target_carbs_g: 210,
            target_fat_g: 65,
            target_fiber_g: 28,
            maintenance_tdee: 2200,
            effective_from: "2026-04-15",
            recorded_at: "2026-04-15T08:00:00Z",
          },
        ],
        error: null,
      }),
    });
    const res = await getDailyTargets(sb as any, "u1", [
      "2026-04-20",
      "2026-04-21",
    ]);
    expect(res["2026-04-20"]).toMatchObject({
      targetCalories: 1900,
      targetProteinG: 140,
      goal: "cut",
      planPace: "steady",
    });
    expect(res["2026-04-21"]).toMatchObject({
      targetCalories: 1900,
      goal: "cut",
    });
  });

  it("F-149 — daily_targets snapshot wins over goal_history on the same date", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({
        data: [
          {
            date_key: "2026-04-18",
            target_calories: 2000, // ← authoritative
            target_protein_g: 150,
            target_carbs_g: 220,
            target_fat_g: 70,
            target_fiber_g: 30,
            activity_level: "moderate",
            plan_pace: "steady",
            goal: "cut",
            maintenance_tdee: 2300,
          },
        ],
        error: null,
      }),
      goal_history: () => ({
        data: [
          {
            goal: "cut",
            plan_pace: "accelerated",
            activity_level: "very_active",
            target_calories: 1700, // ← should be ignored, snapshot wins
            target_protein_g: null,
            target_carbs_g: null,
            target_fat_g: null,
            target_fiber_g: null,
            maintenance_tdee: null,
            effective_from: "2026-04-10",
            recorded_at: "2026-04-10T08:00:00Z",
          },
        ],
        error: null,
      }),
    });
    const res = await getDailyTargets(sb as any, "u1", ["2026-04-18"]);
    expect(res["2026-04-18"]?.targetCalories).toBe(2000);
    expect(res["2026-04-18"]?.planPace).toBe("steady");
  });

  it("filters the query by user_id and the requested date list", async () => {
    const sb = makeSupabase({
      daily_targets: () => ({ data: [], error: null }),
    });
    await getDailyTargets(sb as any, "u1", ["2026-04-18", "2026-04-19"]);
    const call = sb.calls.find((c) => c.table === "daily_targets");
    expect(call).toBeDefined();
    expect(call!.filters["eq:user_id"]).toBe("u1");
    expect(call!.filters["in:date_key"]).toEqual(["2026-04-18", "2026-04-19"]);
  });
});

describe("resolveDisplayTarget", () => {
  const currentTargets = { calories: 2500, protein: 160, carbs: 300, fat: 85, fiberG: 35 };

  it("falls back to current targets when no snapshot exists, flagged as approximate", () => {
    const resolved = resolveDisplayTarget(null, currentTargets);
    expect(resolved).toEqual({
      calories: 2500,
      protein: 160,
      carbs: 300,
      fat: 85,
      fiberG: 35,
      isSnapshot: false,
    });
  });

  it("uses the snapshot values when one exists, flagged as snapshot", () => {
    const snapshot = {
      dateKey: "2026-04-18",
      targetCalories: 1800,
      targetProteinG: 120,
      targetCarbsG: 200,
      targetFatG: 60,
      targetFiberG: 25,
      activityLevel: "sedentary",
      planPace: "steady",
      goal: "maintain",
      maintenanceTdee: 1850,
    };
    const resolved = resolveDisplayTarget(snapshot, currentTargets);
    expect(resolved).toEqual({
      calories: 1800,
      protein: 120,
      carbs: 200,
      fat: 60,
      fiberG: 25,
      isSnapshot: true,
    });
  });

  it("falls back to the current target for individual columns that were null in the snapshot", () => {
    const snapshot = {
      dateKey: "2026-04-18",
      targetCalories: 1800,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
      targetFiberG: null,
      activityLevel: null,
      planPace: null,
      goal: null,
      maintenanceTdee: null,
    };
    const resolved = resolveDisplayTarget(snapshot, currentTargets);
    expect(resolved.calories).toBe(1800);
    // Column fallback is per-field — the snapshot "exists" (isSnapshot:
    // true) but each null column picks up the current target.
    expect(resolved.protein).toBe(160);
    expect(resolved.carbs).toBe(300);
    expect(resolved.fat).toBe(85);
    expect(resolved.fiberG).toBe(35);
    expect(resolved.isSnapshot).toBe(true);
  });
});
