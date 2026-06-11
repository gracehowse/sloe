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
    // not assumptions: female 60kg/165cm/30y, balanced, steady.
    const lose = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;
    const maintain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "maintain" })!;
    const gain = recomputeTargetsFromProfile({ ...FIXTURE, goal: "bulk" })!;

    // TDEE gating 2026-06-10 — the formula seed is now SEDENTARY (1.2), not
    // the fixture's `moderate` (1.55), because this recompute path's
    // target_calories coexists with the per-day activity bonus (bonus adds
    // activity once; the seed must not bake it in again). 1320.25 BMR × 1.2
    // → 1,584 (was 2,046 at moderate). Survey §4 + decision
    // `docs/decisions/2026-06-10-adaptive-tdee-gating.md`.
    expect(maintain.maintenanceTdee).toBe(1584);
    // steady = 0.5 kg/week. Continuous pace: deficit = round(0.5×7700/7) = 550.
    //   lose:     1584 - 550 = 1034.
    //   maintain: 1584.
    //   gain:     1584 + 550 = 2134 (full-magnitude surplus, unified with
    //             onboarding + the weekly check-in).
    expect(lose.target_calories).toBe(1034);
    expect(maintain.target_calories).toBe(1584);
    expect(gain.target_calories).toBe(2134);
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

  it("writes pace_kg_per_week (continuous) alongside the plan_pace preset on a recompute", async () => {
    // target-recompute unification (2026-05-26): the lossless continuous
    // pace is persisted next to the snapped preset. The editor passes a
    // `plan_pace` preset today, so persist reconstructs the continuous
    // value from PACE_WEEKLY_KG[preset].
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
      profileUpdate: { goal: "cut", plan_pace: "accelerated" },
      recomputed,
      source: "recompute",
    });

    const written = supabase.updates.at(-1)!;
    expect(written.plan_pace).toBe("accelerated");
    // accelerated = 0.75 kg/week.
    expect(written.pace_kg_per_week).toBe(0.75);
  });

  it("prefers an explicit continuous paceKgPerWeek over the snapped preset", async () => {
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
      paceKgPerWeek: 0.42, // exact slider value, between steady + relaxed
    });

    const written = supabase.updates.at(-1)!;
    expect(written.plan_pace).toBe("steady"); // snapped mirror preserved
    expect(written.pace_kg_per_week).toBe(0.42); // lossless value wins
  });

  it("writes pace_kg_per_week = 0 when the goal becomes maintain", async () => {
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
    expect(written.plan_pace).toBeNull();
    expect(written.pace_kg_per_week).toBe(0);
  });

  it("does NOT write pace_kg_per_week on a goal-weight-only edit", async () => {
    const supabase = makeMockSupabase();
    await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal_weight_kg: 58 },
      recomputed: null,
      source: "recompute",
    });
    const written = supabase.updates.at(-1)!;
    expect(written).not.toHaveProperty("pace_kg_per_week");
  });

  it("degrades gracefully when pace_kg_per_week column is missing (retries without it)", async () => {
    // Simulate an env where migration 20260526100000 hasn't been pushed:
    // the first update fails with a schema-cache error naming the column;
    // persist must strip it and retry so the goal edit still lands.
    const updates: Array<Record<string, unknown>> = [];
    let call = 0;
    const supabase = {
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { target_calories: 2046, sex: "female", weight_kg: 60, height_cm: 165, age: 30, activity_level: "moderate", goal: "maintain" }, error: null }) }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload);
              call += 1;
              const hasPace = "pace_kg_per_week" in payload;
              return {
                eq: async () => ({
                  error:
                    call === 1 && hasPace
                      ? { message: "Could not find the 'pace_kg_per_week' column of 'profiles' in the schema cache" }
                      : null,
                }),
              };
            },
          };
        }
        if (table === "goal_history") {
          return {
            select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
            insert: async () => ({ error: null }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;

    const result = await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "cut", plan_pace: "steady" },
      recomputed,
      source: "recompute",
    });

    // First attempt included the column + failed; retry stripped it + succeeded.
    expect(result.ok).toBe(true);
    expect(updates).toHaveLength(2);
    expect("pace_kg_per_week" in updates[0]).toBe(true);
    expect("pace_kg_per_week" in updates[1]).toBe(false);
    // The rest of the goal edit still wrote.
    expect(updates[1].target_calories).toBe(recomputed.target_calories);
    expect(updates[1].goal).toBe("cut");
  });

  it("computes the preview off ADAPTIVE maintenance when confident + fresh", async () => {
    // Stage 2 (target-recompute unification, 2026-05-26): the editor now
    // passes the adaptive columns. With a LOWER adaptive maintenance than
    // the sedentary-seeded formula (1,584 for this fixture, TDEE gating
    // 2026-06-10), the cut target must drop — the core fix.
    const now = new Date("2026-05-26T09:00:00.000Z");
    const fresh = "2026-05-20T09:00:00.000Z"; // 6 days old → fresh (<14d)

    const staticCut = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut", now })!;
    const adaptiveCut = recomputeTargetsFromProfile({
      ...FIXTURE,
      goal: "cut",
      adaptiveTdee: 1400, // lower than the sedentary seed (1,584)
      adaptiveTdeeConfidence: "high",
      adaptiveTdeeUpdatedAt: fresh,
      now,
    })!;

    // Adaptive maintenance is the deficit baseline → lower target + lower
    // reported maintenance.
    expect(adaptiveCut.maintenanceTdee).toBe(1400);
    expect(staticCut.maintenanceTdee).toBe(1584); // sedentary seed
    expect(adaptiveCut.target_calories).toBeLessThan(staticCut.target_calories);
    // steady = 0.5 kg/week → -550 deficit. 1400 - 550 = 850, far below the
    // female safety floor (1200) — so the floor flag fires more often off
    // the adaptive number. That's correct, per the spec.
    expect(adaptiveCut.target_calories).toBe(850);
  });

  it("falls back to the SEDENTARY-seeded formula maintenance when the adaptive value is stale", () => {
    const now = new Date("2026-05-26T09:00:00.000Z");
    const stale = "2026-05-01T09:00:00.000Z"; // 25 days old → stale (>14d)
    const result = recomputeTargetsFromProfile({
      ...FIXTURE,
      goal: "cut",
      adaptiveTdee: 1400,
      adaptiveTdeeConfidence: "high",
      adaptiveTdeeUpdatedAt: stale,
      now,
    })!;
    // Stale adaptive is rejected → sedentary-seeded formula 1,584 baseline.
    expect(result.maintenanceTdee).toBe(1584);
    expect(result.target_calories).toBe(1034); // 1,584 − 550
  });

  it("falls back to the SEDENTARY-seeded formula maintenance when adaptive confidence is low", () => {
    const now = new Date("2026-05-26T09:00:00.000Z");
    const result = recomputeTargetsFromProfile({
      ...FIXTURE,
      goal: "cut",
      adaptiveTdee: 1400,
      adaptiveTdeeConfidence: "low",
      adaptiveTdeeUpdatedAt: "2026-05-25T09:00:00.000Z",
      now,
    })!;
    expect(result.maintenanceTdee).toBe(1584);
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

describe("ENG-779 — fibre is a sticky user preference, not clobbered by recompute", () => {
  // Fixture cut-goal formula fibre = round(1496 / 55) = 27g. The tests use
  // distinct values (42 user-set, 50 override) so a preserved value can't be
  // confused with the formula one.
  it("preserves a user-set fibre (source='user') through a goal recompute", async () => {
    const supabase = makeMockSupabase({
      target_calories: 1700,
      target_calories_source: "user",
      target_fiber_g: 42,
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
    const written = supabase.updates.at(-1)!;
    // Calories still recompute — the goal IS the newer intent for calories…
    expect(written.target_calories).toBe(recomputed.target_calories);
    // …but the user's chosen fibre is carried forward, not the formula value.
    expect(written.target_fiber_g).toBe(42);
    expect(written.target_fiber_g).not.toBe(recomputed.target_fiber_g);
    // Calorie provenance stays "recompute" (protects the digest cooldown).
    expect(written.target_calories_source).toBe("recompute");
  });

  it("uses the formula fibre when the profile is NOT user-set", async () => {
    const supabase = makeMockSupabase({
      target_calories: 2046,
      target_fiber_g: 42, // a stale fibre, but source isn't "user"
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "maintain",
      // no target_calories_source → treated as formula-derived
    });
    const recomputed = recomputeTargetsFromProfile({ ...FIXTURE, goal: "cut" })!;
    await persistRecomputedTargets(supabase, "user-1", {
      profileUpdate: { goal: "cut", plan_pace: "steady" },
      recomputed,
      source: "recompute",
    });
    const written = supabase.updates.at(-1)!;
    expect(written.target_fiber_g).toBe(recomputed.target_fiber_g);
  });

  it("an explicit fiberOverrideG wins over both formula and sticky-user fibre", async () => {
    const supabase = makeMockSupabase({
      target_calories: 1700,
      target_calories_source: "user",
      target_fiber_g: 42,
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
      fiberOverrideG: 50,
    });
    expect(supabase.updates.at(-1)!.target_fiber_g).toBe(50);
  });

  it("records the preserved (not formula) fibre in goal_history", async () => {
    const supabase = makeMockSupabase({
      target_calories: 1700,
      target_calories_source: "user",
      target_fiber_g: 42,
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
    await new Promise((r) => setTimeout(r, 0));
    expect(supabase.inserts[0].target_fiber_g).toBe(42);
  });
});
