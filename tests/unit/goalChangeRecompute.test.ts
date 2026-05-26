/**
 * Goal-change recompute contract (ENG goal-editor, 2026-05-25).
 *
 * The post-onboarding "Edit goal & pace" editor (web
 * `src/app/components/suppr/goal-pace-editor-dialog.tsx`, mobile
 * `apps/mobile/components/recap/GoalPaceEditorSheet.tsx`) lets a user
 * change goal type / pace / goal weight after onboarding. Both platforms
 * route the write through the shared `persistRecomputedTargets` helper.
 *
 * This test pins the locked correctness decisions from the
 * nutrition-engine spec:
 *   1. A goal-type change recomputes target_calories + ALL FOUR macros
 *      via the real static formula (no hand-rolled math here — we call
 *      `recomputeTargetsFromProfile` and assert against ITS output).
 *   2. Provenance is stamped `target_calories_source = "recompute"`
 *      (never "user" — that would trip the 14-day digest cooldown).
 *   3. A prior manual "user" target is overwritten + re-stamped
 *      "recompute" on a goal change.
 *   4. A goal_weight_kg-ONLY change writes NO target_calories / macros /
 *      source — goal weight does not feed TDEE.
 */
import { describe, expect, it, vi } from "vitest";
import {
  recomputeTargetsFromProfile,
  recomputeTargetsForActivity,
} from "../../src/lib/nutrition/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "../../src/lib/nutrition/persistRecomputedTargets";

const FIXTURE = {
  sex: "female" as const,
  weightKg: 60,
  heightCm: 165,
  age: 30,
  activityLevel: "moderate" as const,
  planPace: "steady" as const,
  nutritionStrategy: "balanced" as const,
};

/** A Supabase mock that records every `.update(payload)` it receives and
 *  satisfies the read chain `persistRecomputedTargets` uses for backfill,
 *  plus the goal_history read+insert. */
function makeMockSupabase(oldProfile: Record<string, unknown> | null = null) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  function from(table: string) {
    if (table === "profiles") {
      return {
        // backfill read path: select(...).eq(...).maybeSingle()
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: oldProfile, error: null }),
          }),
        }),
        // write path: update(payload).eq(...)
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
    }
    if (table === "daily_targets") {
      return {
        upsert: async () => ({ error: null }),
      };
    }
    if (table === "goal_history") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  }

  return { from: vi.fn(from), updates, inserts };
}

describe("goal-change recompute — pure compute", () => {
  it("lose / maintain / gain produce distinct, ordered calorie targets", () => {
    const lose = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" });
    const maintain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "maintain" });
    const gain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "bulk" });

    expect(lose).not.toBeNull();
    expect(maintain).not.toBeNull();
    expect(gain).not.toBeNull();

    // The real formula must place a deficit below maintenance and a
    // surplus above it. We don't assume the magnitudes — we read them
    // from the helper's own output.
    expect(lose!.target_calories).toBeLessThan(maintain!.target_calories);
    expect(gain!.target_calories).toBeGreaterThan(maintain!.target_calories);
    // maintain lands exactly on the maintenance TDEE.
    expect(maintain!.target_calories).toBe(maintain!.maintenanceTdee);
  });

  it("pins the concrete numbers the real formula returns for the fixture", () => {
    // Regression guard — if `tdee.ts` constants drift, this fails and
    // the editor's displayed numbers (and the safety-floor warning
    // threshold) move with it. Values are the output of the REAL helper,
    // not assumptions: female 60kg/165cm/30y, moderate, balanced, steady.
    const lose = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;
    const maintain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "maintain" })!;
    const gain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "bulk" })!;

    expect(maintain.maintenanceTdee).toBe(2046);
    expect(lose.target_calories).toBe(1496);
    expect(maintain.target_calories).toBe(2046);
    expect(gain.target_calories).toBe(2321);
  });

  it("recomputes ALL FOUR macros (not calories alone) on a goal change", () => {
    const lose = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;
    const gain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "bulk" })!;

    for (const k of [
      "target_protein",
      "target_carbs",
      "target_fat",
      "target_fiber_g",
    ] as const) {
      expect(typeof lose[k]).toBe("number");
      expect(lose[k]).toBeGreaterThan(0);
    }
    // At least one macro must differ between goals (carbs scale with the
    // budget) — proves macros are recomputed, not copied.
    expect(gain.target_carbs).not.toBe(lose.target_carbs);
  });

  it("recomputeTargetsForActivity alias is the same function", () => {
    expect(recomputeTargetsForActivity).toBe(recomputeTargetsFromProfile);
  });
});

describe("goal-change recompute — persistence contract", () => {
  it("stamps target_calories_source = 'recompute' (never 'user') on a goal change", async () => {
    const supabase = makeMockSupabase({
      target_calories: 2046,
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "maintain",
    });
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;
    const now = new Date("2026-05-25T09:00:00.000Z");

    const result = await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "cut", plan_pace: "steady" },
      recomputed,
      source: "recompute",
      now,
    });

    expect(result.ok).toBe(true);
    expect(result.wroteTargets).toBe(true);
    const written = supabase.updates.at(-1)!;
    expect(written.target_calories_source).toBe("recompute");
    expect(written.target_calories_source).not.toBe("user");
    expect(written.target_calories_set_at).toBe(now.toISOString());
    // All four macros + calories are in the write payload.
    expect(written.target_calories).toBe(recomputed.target_calories);
    expect(written.target_protein).toBe(recomputed.target_protein);
    expect(written.target_carbs).toBe(recomputed.target_carbs);
    expect(written.target_fat).toBe(recomputed.target_fat);
    expect(written.target_fiber_g).toBe(recomputed.target_fiber_g);
    // The non-DB convenience field must NOT leak into the write.
    expect(written).not.toHaveProperty("maintenanceTdee");
    // goal + plan_pace are written.
    expect(written.goal).toBe("cut");
    expect(written.plan_pace).toBe("steady");
  });

  it("overwrites a prior manual 'user' target and re-stamps it 'recompute'", async () => {
    // The OLD profile carries a hand-set ("user") target. A goal change is
    // a newer, more specific intent — it must win.
    const supabase = makeMockSupabase({
      target_calories: 1700,
      target_calories_source: "user",
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "maintain",
    });
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "bulk" })!;
    const now = new Date("2026-05-25T09:00:00.000Z");

    await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "bulk", plan_pace: "steady" },
      recomputed,
      source: "recompute",
      now,
    });

    const written = supabase.updates.at(-1)!;
    expect(written.target_calories_source).toBe("recompute");
    expect(written.target_calories).toBe(recomputed.target_calories);
    expect(written.target_calories).not.toBe(1700);
  });

  it("clears plan_pace when goal becomes maintain", async () => {
    const supabase = makeMockSupabase({
      target_calories: 1496,
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "cut",
      plan_pace: "steady",
    });
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "maintain", planPace: null })!;

    await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "maintain", plan_pace: null },
      recomputed,
      source: "recompute",
    });

    const written = supabase.updates.at(-1)!;
    expect(written.goal).toBe("maintain");
    expect(written.plan_pace).toBeNull();
  });

  it("goal_weight_kg-ONLY change writes NO target_calories / macros / source", async () => {
    const supabase = makeMockSupabase();

    const result = await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal_weight_kg: 58 },
      recomputed: null, // goal weight does not feed TDEE
      source: "recompute",
    });

    expect(result.ok).toBe(true);
    expect(result.wroteTargets).toBe(false);
    const written = supabase.updates.at(-1)!;
    expect(written).toEqual({ goal_weight_kg: 58 });
    expect(written).not.toHaveProperty("target_calories");
    expect(written).not.toHaveProperty("target_protein");
    expect(written).not.toHaveProperty("target_calories_source");
    expect(written).not.toHaveProperty("target_calories_set_at");
    // No backfill / no goal_history insert for a weight-only change.
    expect(supabase.inserts).toHaveLength(0);
  });

  it("records a goal_history row on a recompute (today-and-forward seal)", async () => {
    const supabase = makeMockSupabase({
      target_calories: 2046,
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "maintain",
    });
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;

    await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "cut", plan_pace: "steady" },
      recomputed,
      source: "recompute",
    });

    // recordGoalHistory is fire-and-forget; give the microtask queue a
    // tick to flush before asserting.
    await new Promise((r) => setTimeout(r, 0));
    expect(supabase.inserts).toHaveLength(1);
    const row = supabase.inserts[0];
    expect(row.goal).toBe("cut");
    expect(row.source).toBe("goal_retune");
    expect(row.target_calories).toBe(recomputed.target_calories);
  });
});
