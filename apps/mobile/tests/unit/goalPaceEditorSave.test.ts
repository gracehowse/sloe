import { describe, expect, it, vi } from "vitest";
import {
  recomputeTargetsFromProfile,
} from "@suppr/shared/nutrition/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "@suppr/shared/nutrition/persistRecomputedTargets";
import { mapPaceToPreset } from "@suppr/shared/onboarding/persist";
import {
  paceChanged,
  seatPaceForEditor,
  parseWeightInputToKg,
  parseHeightInputToCm,
  type EditorDbGoal,
} from "@suppr/shared/nutrition/goalEditorPace";
import { lbToKg, feetInchesToCm } from "@suppr/shared/units/imperial";

/**
 * Mobile GoalPaceEditorSheet save-logic contract (ENG goal-editor;
 * Stage 2 of the target-recompute unification, 2026-05-26).
 *
 * The mobile sheet's logic lives in `useGoalPaceEditor`, which shares the
 * recompute + persistence pipeline with the web dialog via `@suppr/shared`.
 * This test pins the decision logic the hook applies before calling
 * `persistRecomputedTargets`:
 *   - the recompute diff (goal / continuous-pace / weight / height) that
 *     decides whether to recompute;
 *   - dirty-tracking against the SEATED continuous pace (a no-op save
 *     must NOT move the target — the 901→846 preset-snap drift fix);
 *   - the maintain → clear-pace mapping;
 *   - the goal-weight-only path (recomputed = null → no calorie write);
 *   - the continuous `pace_kg_per_week` written alongside `plan_pace`.
 *
 * We exercise the same shared helpers the hook calls, then assert the
 * payload that flows into the shared persist helper — proving mobile
 * builds the same write the web dialog does.
 */

type DbGoal = EditorDbGoal;

/** Mirror of the hook's recompute-dirty diff. */
function recomputeChanged(input: {
  loadedGoal: DbGoal;
  goal: DbGoal;
  seatedPace: number;
  pace: number;
  loadedWeightKg: number | null;
  editedWeightKg: number | null;
  loadedHeightCm: number | null;
  editedHeightCm: number | null;
}): boolean {
  const goalChanged = input.goal !== input.loadedGoal;
  const paceMoved = input.goal !== "maintain" && paceChanged(input.pace, input.seatedPace);
  const weightChanged =
    input.editedWeightKg != null &&
    (input.loadedWeightKg == null ||
      Math.abs(input.editedWeightKg - input.loadedWeightKg) > 0.05);
  const heightChanged =
    input.editedHeightCm != null &&
    (input.loadedHeightCm == null ||
      Math.abs(input.editedHeightCm - input.loadedHeightCm) >= 1);
  return goalChanged || paceMoved || weightChanged || heightChanged;
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

const BODY = {
  sex: "female" as const,
  weightKg: 60,
  heightCm: 165,
  age: 30,
  activityLevel: "moderate" as const,
  nutritionStrategy: "balanced" as const,
};

const OLD_PROFILE = {
  target_calories: 2046,
  sex: "female",
  weight_kg: 60,
  height_cm: 165,
  age: 30,
  activity_level: "moderate",
  goal: "maintain",
};

describe("mobile GoalPaceEditorSheet — recompute diff", () => {
  it("a goal change maintain→cut triggers a recompute", () => {
    const seated = seatPaceForEditor({ goal: "cut", paceKgPerWeek: null, planPace: "steady" });
    expect(
      recomputeChanged({
        loadedGoal: "maintain",
        goal: "cut",
        seatedPace: seated,
        pace: seated,
        loadedWeightKg: 60,
        editedWeightKg: 60,
        loadedHeightCm: 165,
        editedHeightCm: 165,
      }),
    ).toBe(true);
  });

  it("a NO-OP open+save does NOT recompute (dirty diffs against seated pace)", () => {
    // The user opens the editor on a stored continuous pace (0.42), never
    // touches anything, and hits Save. Nothing must move — this is the
    // silent preset-snap drift this Stage fixes.
    const seated = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.42, planPace: "steady" });
    expect(seated).toBe(0.42);
    expect(
      recomputeChanged({
        loadedGoal: "cut",
        goal: "cut",
        seatedPace: seated,
        pace: seated,
        loadedWeightKg: 60,
        editedWeightKg: 60,
        loadedHeightCm: 165,
        editedHeightCm: 165,
      }),
    ).toBe(false);
    // And the snapped preset that WOULD have been persisted differs from
    // the seated continuous value — proving the old preset-diff would have
    // mis-fired here (0.42 snaps to "steady" = 0.5).
    expect(mapPaceToPreset(seated)).toBe("steady");
  });

  it("a real slider move recomputes", () => {
    const seated = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.42, planPace: "steady" });
    expect(
      recomputeChanged({
        loadedGoal: "cut",
        goal: "cut",
        seatedPace: seated,
        pace: 0.6, // dragged
        loadedWeightKg: 60,
        editedWeightKg: 60,
        loadedHeightCm: 165,
        editedHeightCm: 165,
      }),
    ).toBe(true);
  });

  it("a weight edit recomputes", () => {
    const seated = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.5, planPace: "steady" });
    const edited = parseWeightInputToKg("65", "metric", lbToKg);
    expect(
      recomputeChanged({
        loadedGoal: "cut",
        goal: "cut",
        seatedPace: seated,
        pace: seated,
        loadedWeightKg: 60,
        editedWeightKg: edited,
        loadedHeightCm: 165,
        editedHeightCm: 165,
      }),
    ).toBe(true);
  });

  it("a height edit recomputes", () => {
    const seated = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.5, planPace: "steady" });
    const edited = parseHeightInputToCm({ measurementSystem: "metric", cm: "170" }, feetInchesToCm);
    expect(
      recomputeChanged({
        loadedGoal: "cut",
        goal: "cut",
        seatedPace: seated,
        pace: seated,
        loadedWeightKg: 60,
        editedWeightKg: 60,
        loadedHeightCm: 165,
        editedHeightCm: edited,
      }),
    ).toBe(true);
  });
});

describe("mobile GoalPaceEditorSheet — persisted write", () => {
  it("writes goal + snapped pace + lossless continuous pace on a recompute", async () => {
    const pace = 0.42; // exact slider value
    const recomputed = recomputeTargetsFromProfile({ ...BODY, goal: "cut" })!;
    const supabase = makeMockSupabase(OLD_PROFILE);

    const res = await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate: { goal: "cut", plan_pace: mapPaceToPreset(pace) },
      recomputed,
      source: "recompute",
      paceKgPerWeek: pace,
    });
    expect(res.ok).toBe(true);
    const written = supabase.updates.at(-1)!;
    expect(written.target_calories_source).toBe("recompute");
    expect(written.target_calories).toBe(recomputed.target_calories);
    expect(written.goal).toBe("cut");
    expect(written.plan_pace).toBe("steady"); // 0.42 snaps to steady
    expect(written.pace_kg_per_week).toBe(0.42); // lossless value wins
  });

  it("writes an edited weight + height alongside the recompute", async () => {
    const recomputed = recomputeTargetsFromProfile({
      ...BODY,
      weightKg: 65,
      heightCm: 170,
      goal: "cut",
    })!;
    const supabase = makeMockSupabase(OLD_PROFILE);

    await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate: { plan_pace: "steady", weight_kg: 65, height_cm: 170 },
      recomputed,
      source: "recompute",
      paceKgPerWeek: 0.5,
    });
    const written = supabase.updates.at(-1)!;
    expect(written.weight_kg).toBe(65);
    expect(written.height_cm).toBe(170);
    expect(written.target_calories).toBe(recomputed.target_calories);
  });

  it("cut→maintain clears plan_pace and writes pace_kg_per_week = 0", async () => {
    const recomputed = recomputeTargetsFromProfile({ ...BODY, goal: "maintain", planPace: null })!;
    const supabase = makeMockSupabase({ ...OLD_PROFILE, goal: "cut", plan_pace: "steady" });

    await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate: { goal: "maintain", plan_pace: null },
      recomputed,
      source: "recompute",
      paceKgPerWeek: 0,
    });
    const written = supabase.updates.at(-1)!;
    expect(written.goal).toBe("maintain");
    expect(written.plan_pace).toBeNull();
    expect(written.pace_kg_per_week).toBe(0);
  });


  it("stamps edited fibre as user-owned and preserves it on later recomputes", async () => {
    const recomputed = recomputeTargetsFromProfile({ ...BODY, goal: "cut" })!;
    const first = makeMockSupabase(OLD_PROFILE);

    await persistRecomputedTargets(first as never, "u1", {
      profileUpdate: { goal: "cut", plan_pace: "steady" },
      recomputed,
      source: "recompute",
      fiberOverrideG: 41.4,
    });

    const firstWrite = first.updates.at(-1)!;
    expect(firstWrite.target_fiber_g).toBe(41);
    expect(firstWrite.target_fiber_source).toBe("user");
    expect(firstWrite.target_calories_source).toBe("recompute");

    const later = makeMockSupabase({
      ...OLD_PROFILE,
      target_fiber_g: 41,
      target_fiber_source: "user",
      target_calories_source: "recompute",
    });

    await persistRecomputedTargets(later as never, "u1", {
      profileUpdate: { goal: "bulk", plan_pace: "steady" },
      recomputed: recomputeTargetsFromProfile({ ...BODY, goal: "bulk" })!,
      source: "recompute",
    });

    const laterWrite = later.updates.at(-1)!;
    expect(laterWrite.target_fiber_g).toBe(41);
    expect(laterWrite.target_fiber_source).toBe("user");
    expect(laterWrite.target_calories_source).toBe("recompute");
  });

  it("goal-weight-only edit does not recompute (recomputed = null → no target write)", async () => {
    const supabase = makeMockSupabase(null);
    const res = await persistRecomputedTargets(supabase as never, "u1", {
      profileUpdate: { goal_weight_kg: 58 },
      recomputed: null,
      source: "recompute",
    });
    expect(res.ok).toBe(true);
    expect(res.wroteTargets).toBe(false);
    const written = supabase.updates.at(-1)!;
    expect(written).toEqual({ goal_weight_kg: 58 });
    expect(written).not.toHaveProperty("target_calories");
    expect(written).not.toHaveProperty("pace_kg_per_week");
  });

  it("preview uses adaptive maintenance when confident + fresh", () => {
    const now = new Date("2026-05-26T09:00:00.000Z");
    const adaptive = recomputeTargetsFromProfile({
      ...BODY,
      goal: "cut",
      adaptiveTdee: 1700,
      adaptiveTdeeConfidence: "medium",
      adaptiveTdeeUpdatedAt: "2026-05-22T09:00:00.000Z",
      now,
    })!;
    expect(adaptive.maintenanceTdee).toBe(1700);
    // 1700 - 550 (steady) = 1150 — below the floor, fires the soft-warn.
    expect(adaptive.target_calories).toBe(1150);
  });
});
