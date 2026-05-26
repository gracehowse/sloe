import { describe, expect, it, vi } from "vitest";
import {
  recomputeTargetsFromProfile,
} from "@suppr/shared/nutrition/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "@suppr/shared/nutrition/persistRecomputedTargets";

/**
 * Mobile GoalPaceEditorSheet save-logic contract (ENG goal-editor,
 * 2026-05-25).
 *
 * The mobile sheet (`apps/mobile/components/recap/GoalPaceEditorSheet.tsx`)
 * shares the recompute + persistence pipeline with web via `@suppr/shared`.
 * This test pins the mobile-distinct decision logic the component applies
 * before calling `persistRecomputedTargets`:
 *   - the goal/pace diff (`goalOrPaceChanged`) that decides whether to
 *     recompute;
 *   - the maintain → clear-pace mapping;
 *   - the goal-weight-only path (recomputed = null → no calorie write).
 *
 * We replicate the component's decision functions here (they're the exact
 * same expressions used inline in the sheet) and assert the payload that
 * flows into the shared helper — proving mobile builds the same write the
 * web dialog does.
 */

type DbGoal = "cut" | "maintain" | "bulk";

/** Mirror of the sheet's `goalOrPaceChanged` memo. */
function goalOrPaceChanged(
  loaded: { goal: DbGoal; planPace: string },
  goal: DbGoal,
  planPace: string,
): boolean {
  if (goal !== loaded.goal) return true;
  if (goal === "maintain") return false;
  return planPace !== loaded.planPace;
}

/** Mirror of the sheet's profileUpdate builder. */
function buildProfileUpdate(
  loaded: { goal: DbGoal; planPace: string; goalWeightKg: number | null },
  goal: DbGoal,
  planPace: string,
  goalWeightKg: number | null,
): Record<string, unknown> {
  const changed = goalOrPaceChanged(loaded, goal, planPace);
  const goalWeightChanged =
    (loaded.goalWeightKg == null) !== (goalWeightKg == null) ||
    (loaded.goalWeightKg != null &&
      goalWeightKg != null &&
      Math.abs(loaded.goalWeightKg - goalWeightKg) > 0.05);

  const profileUpdate: Record<string, unknown> = {};
  if (goal !== loaded.goal) profileUpdate.goal = goal;
  if (goal === "maintain") {
    if (loaded.goal !== "maintain") profileUpdate.plan_pace = null;
  } else if (changed) {
    profileUpdate.plan_pace = planPace;
  }
  if (goalWeightChanged) profileUpdate.goal_weight_kg = goalWeightKg;
  return profileUpdate;
}

function makeMockSupabase(oldProfile: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: oldProfile, error: null }) }),
        }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
    }
    if (table === "daily_targets") return { upsert: async () => ({ error: null }) };
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }),
      }),
      insert: async () => ({ error: null }),
    };
  });
  return { from, updates };
}

const LOADED = {
  goal: "maintain" as DbGoal,
  planPace: "steady",
  goalWeightKg: null as number | null,
};
const BODY = {
  sex: "female" as const,
  weightKg: 60,
  heightCm: 165,
  age: 30,
  activityLevel: "moderate" as const,
  planPace: "steady" as const,
  nutritionStrategy: "balanced" as const,
};

describe("mobile GoalPaceEditorSheet — decision logic", () => {
  it("goal change maintain→cut triggers a recompute + writes goal + pace", async () => {
    const profileUpdate = buildProfileUpdate(LOADED, "cut", "steady", null);
    expect(profileUpdate).toEqual({ goal: "cut", plan_pace: "steady" });

    const recomputed = recomputeTargetsFromProfile({ ...BODY, goal: "cut" })!;
    const supabase = makeMockSupabase({
      target_calories: 2046,
      sex: "female",
      weight_kg: 60,
      height_cm: 165,
      age: 30,
      activity_level: "moderate",
      goal: "maintain",
    });
    const res = await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate,
      recomputed,
      source: "recompute",
    });
    expect(res.ok).toBe(true);
    const written = supabase.updates.at(-1)!;
    expect(written.target_calories_source).toBe("recompute");
    expect(written.target_calories).toBe(recomputed.target_calories);
  });

  it("cut→maintain clears plan_pace", () => {
    const loaded = { goal: "cut" as DbGoal, planPace: "steady", goalWeightKg: null };
    const profileUpdate = buildProfileUpdate(loaded, "maintain", "steady", null);
    expect(profileUpdate.goal).toBe("maintain");
    expect(profileUpdate.plan_pace).toBeNull();
  });

  it("goal-weight-only edit does not recompute (recomputed = null → no target write)", async () => {
    const profileUpdate = buildProfileUpdate(LOADED, "maintain", "steady", 58);
    expect(profileUpdate).toEqual({ goal_weight_kg: 58 });
    expect(goalOrPaceChanged(LOADED, "maintain", "steady")).toBe(false);

    const supabase = makeMockSupabase(null);
    const res = await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate,
      recomputed: null,
      source: "recompute",
    });
    expect(res.ok).toBe(true);
    expect(res.wroteTargets).toBe(false);
    const written = supabase.updates.at(-1)!;
    expect(written).toEqual({ goal_weight_kg: 58 });
    expect(written).not.toHaveProperty("target_calories");
    expect(written).not.toHaveProperty("target_calories_source");
  });

  it("pace-only change within a directional goal recomputes", () => {
    const loaded = { goal: "cut" as DbGoal, planPace: "steady", goalWeightKg: null };
    expect(goalOrPaceChanged(loaded, "cut", "vigorous")).toBe(true);
    const profileUpdate = buildProfileUpdate(loaded, "cut", "vigorous", null);
    expect(profileUpdate).toEqual({ plan_pace: "vigorous" });
  });

  it("no change at all builds an empty update", () => {
    const loaded = { goal: "cut" as DbGoal, planPace: "steady", goalWeightKg: 58 };
    expect(goalOrPaceChanged(loaded, "cut", "steady")).toBe(false);
    expect(buildProfileUpdate(loaded, "cut", "steady", 58)).toEqual({});
  });
});
