import { describe, expect, it, vi } from "vitest";
import {
  buildProfileUpsertRow,
  mapPaceToPreset,
  mapV2GoalToLegacy,
  persistOnboarding,
} from "../../src/lib/onboarding/persist";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from "../../src/lib/onboarding/state";
import { computeV2Targets } from "../../src/lib/onboarding/targets";

/**
 * OB2-1 — persistence layer tests.
 *
 * Locks the schema mapping data-integrity signed off:
 *   - target_calories_source = "onboarding" (NOT "onboarding_v2" —
 *     would throw 23514 against the CHECK constraint)
 *   - goal: lose→cut, gain→bulk, maintain→maintain, recomp→cut
 *   - target_water_ml column NOT written (column doesn't exist)
 *   - weightSkipped → null weight + null targets, partial profile
 *   - daily_targets snapshot NOT called from this path (F-2 invariant)
 */

const baseState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

const COMPLETE_PROFILE: Partial<OnboardingState> = {
  name: "Grace",
  goal: "lose",
  paceKgPerWeek: 0.4,
  sex: "female",
  age: 28,
  heightCm: 168,
  weightKg: 62,
  activity: "moderate",
  unitSystem: "metric",
  diet: ["vegetarian"],
};

describe("mapV2GoalToLegacy", () => {
  it("maps lose → cut", () => {
    expect(mapV2GoalToLegacy("lose")).toBe("cut");
  });
  it("maps gain → bulk", () => {
    expect(mapV2GoalToLegacy("gain")).toBe("bulk");
  });
  it("maps maintain → maintain", () => {
    expect(mapV2GoalToLegacy("maintain")).toBe("maintain");
  });
  it("maps recomp → cut (deficit semantics; nutrition_strategy is the differentiator)", () => {
    expect(mapV2GoalToLegacy("recomp")).toBe("cut");
  });
});

describe("mapPaceToPreset", () => {
  it("snaps to nearest preset by absolute distance", () => {
    expect(mapPaceToPreset(0.2)).toBe("relaxed"); // 0.25
    expect(mapPaceToPreset(0.3)).toBe("relaxed"); // halfway between 0.25 and 0.5 → 0.25 wins (≤)
    expect(mapPaceToPreset(0.4)).toBe("steady"); // 0.5
    expect(mapPaceToPreset(0.7)).toBe("accelerated"); // 0.75
    expect(mapPaceToPreset(0.95)).toBe("vigorous"); // 1.0
  });
  it("defaults to 0.4 (= steady) when paceKgPerWeek is null", () => {
    expect(mapPaceToPreset(null)).toBe("steady");
  });
});

describe("buildProfileUpsertRow — happy path", () => {
  it("builds the full upsert row for a complete profile", () => {
    const state = baseState(COMPLETE_PROFILE);
    const targets = computeV2Targets(state);
    expect(targets).not.toBeNull();
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets,
      now: new Date("2026-04-20T03:00:00Z"),
    });
    expect(row).toEqual({
      id: "u1",
      display_name: "Grace",
      user_tier: "free",
      sex: "female",
      age: 28,
      height_cm: 168,
      weight_kg: 62,
      activity_level: "moderate",
      goal: "cut",
      goal_weight_kg: null,
      plan_pace: "steady",
      nutrition_strategy: "high_satisfaction",
      dietary: ["vegetarian"],
      measurement_system: "metric",
      target_calories: targets!.target,
      target_calories_set_at: "2026-04-20T03:00:00.000Z",
      target_calories_source: "onboarding",
      target_protein: targets!.proteinG,
      target_carbs: targets!.carbsG,
      target_fat: targets!.fatG,
      target_fiber_g: targets!.fiberG,
      prefer_activity_adjusted_calories: false,
      onboarding_completed: true,
    });
    // Defensive: target_water_ml MUST NOT appear — column doesn't
    // exist (data-integrity flag).
    expect(row).not.toHaveProperty("target_water_ml");
    // target_calories_source must NEVER be "onboarding_v2" — the
    // CHECK constraint rejects it.
    expect(row.target_calories_source).not.toBe("onboarding_v2");
  });
});

describe("buildProfileUpsertRow — weightSkipped", () => {
  it("writes a partial profile with null weight + null targets", () => {
    const state = baseState({ ...COMPLETE_PROFILE, weightSkipped: true });
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets: null,
    });
    expect(row.weight_kg).toBeNull();
    expect(row.target_calories).toBeNull();
    expect(row.target_protein).toBeNull();
    expect(row.target_carbs).toBeNull();
    expect(row.target_fat).toBeNull();
    expect(row.target_fiber_g).toBeNull();
    expect(row.target_calories_source).toBeNull();
    expect(row.target_calories_set_at).toBeNull();
    expect(row.plan_pace).toBeNull();
    // The captured fields still write — display_name, sex, age, etc.
    expect(row.display_name).toBe("Grace");
    expect(row.sex).toBe("female");
    expect(row.age).toBe(28);
    expect(row.height_cm).toBe(168);
    expect(row.activity_level).toBe("moderate");
    expect(row.goal).toBe("cut");
    // onboarding_completed is still true — the user finished the
    // flow, they just opted out of weight entry.
    expect(row.onboarding_completed).toBe(true);
  });
});

describe("buildProfileUpsertRow — maintain goal", () => {
  it("writes plan_pace=null because maintain has no pace", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      goal: "maintain",
      paceKgPerWeek: null,
    });
    const targets = computeV2Targets(state);
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets,
    });
    expect(row.goal).toBe("maintain");
    expect(row.plan_pace).toBeNull();
    // Targets still written — maintain has a TDEE-equal target.
    expect(row.target_calories).toBe(targets!.target);
  });
});

describe("buildProfileUpsertRow — recomp", () => {
  it("writes goal=cut + nutrition_strategy=high_protein for recomp", () => {
    const state = baseState({
      ...COMPLETE_PROFILE,
      goal: "recomp",
      paceKgPerWeek: 0.15,
    });
    const targets = computeV2Targets(state);
    const row = buildProfileUpsertRow({
      userId: "u1",
      state,
      targets,
    });
    // recomp → cut (no recomp value in legacy enum); the
    // nutrition_strategy field carries the differentiating signal.
    expect(row.goal).toBe("cut");
    expect(row.nutrition_strategy).toBe("high_protein");
  });
});

describe("persistOnboarding", () => {
  function makeMockSupabase(behavior: "ok" | "error" = "ok") {
    const upsert = vi.fn(() =>
      Promise.resolve({
        error: behavior === "error" ? { message: "boom" } : null,
      }),
    );
    return {
      from: vi.fn(() => ({ upsert })),
      // Stub for snapshotDailyTargetIfMissing's profile read, in case
      // it ever gets called (it shouldn't from this path).
      __upsert: upsert,
    };
  }

  it("calls profiles.upsert with the mapped row + onConflict id", async () => {
    const supabase = makeMockSupabase();
    const state = baseState(COMPLETE_PROFILE);
    const targets = computeV2Targets(state);
    const result = await persistOnboarding(supabase, {
      userId: "u1",
      state,
      targets,
      now: new Date("2026-04-20T03:00:00Z"),
    });
    expect(result.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.__upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = supabase.__upsert.mock.calls[0];
    expect(row.id).toBe("u1");
    expect(row.target_calories_source).toBe("onboarding");
    expect(opts).toEqual({ onConflict: "id" });
  });

  it("returns ok=false + the error message when upsert fails", async () => {
    const supabase = makeMockSupabase("error");
    const state = baseState(COMPLETE_PROFILE);
    const result = await persistOnboarding(supabase, {
      userId: "u1",
      state,
      targets: computeV2Targets(state),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("boom");
  });

  it("does NOT call daily_targets.upsert (snapshot is first-food-log's job — F-2)", async () => {
    const supabase = makeMockSupabase();
    const state = baseState(COMPLETE_PROFILE);
    await persistOnboarding(supabase, {
      userId: "u1",
      state,
      targets: computeV2Targets(state),
    });
    // Only the profiles upsert should have been issued.
    const tablesTouched = supabase.from.mock.calls.map((c) => c[0]);
    expect(tablesTouched).toEqual(["profiles"]);
  });
});
