/**
 * Profile activity-level update pipeline (build 10 fix E-2, 2026-04-19).
 *
 * Closes TestFlight `AIIm60n` + `AHCSYMATS` — tester needed a
 * self-service path to fix a bad stored `activity_level`. This test
 * locks the write contract:
 *   1. `activity_level` is persisted to `profiles`.
 *   2. `target_calories` is recomputed via the same Mifflin-St Jeor
 *      pipeline as onboarding saveAndFinish (BMR → TDEE → budget).
 *   3. Target macros are also rewritten — stale protein/carbs/fat
 *      from the old TDEE would mislead the tracker otherwise.
 *   4. The recompute matches `calculateTDEE` to the kcal. No drift,
 *      no invented multipliers.
 *
 * The test exercises the pure helper `recomputeTargetsForActivity`
 * and a thin simulated write path that mirrors what Settings.tsx
 * (web) and (tabs)/settings.tsx (mobile) do in `onConfirm`. That way
 * the real UI code and this test agree on field names + math without
 * a brittle DOM mount.
 *
 * TDEE gating 2026-06-10 — point (4) above no longer holds at the requested
 * activity multiplier: the maintenance baseline now SEEDS AT SEDENTARY (1.2)
 * for every activity level, because target_calories coexists with the per-day
 * activity bonus (the bonus pays for activity once). The sedentary-requesting
 * cases below still match `calculateTDEE(… "sedentary")` because the seed and
 * the request coincide; the moderate→sedentary delta test is superseded — see
 * its body + `docs/decisions/2026-06-10-adaptive-tdee-gating.md`.
 */
import { describe, expect, it, vi } from "vitest";
import { recomputeTargetsForActivity } from "../../src/lib/nutrition/recomputeTargetsForActivity";
import {
  calculateTDEE,
  calculateBudget,
  calculateMacros,
} from "../../src/lib/nutrition/tdee";

// The tester's profile basics (derived from the TestFlight ticket).
// Maintenance at `moderate` reads as ~1,900 in the app; the correct
// `sedentary` number is ~1,470 — the exact mismatch that triggered
// the complaint.
const TESTER = {
  sex: "female" as const,
  weightKg: 55,
  heightCm: 163,
  age: 34,
  goal: "cut" as const,
  planPace: "steady" as const,
  nutritionStrategy: "balanced" as const,
};

/**
 * Simulates what Settings → onConfirm does:
 *   - recomputes targets for the new activity_level
 *   - writes { activity_level, target_calories, target_protein,
 *     target_carbs, target_fat, target_fiber_g } to profiles.
 *
 * Returns the exact payload passed to `supabase.from("profiles").update`.
 */
async function simulateSaveActivityLevel(
  mockSupabase: ReturnType<typeof makeMockSupabase>,
  userId: string,
  nextLevel: Parameters<typeof recomputeTargetsForActivity>[0]["activityLevel"],
) {
  const recomputed = recomputeTargetsForActivity({
    sex: TESTER.sex,
    weightKg: TESTER.weightKg,
    heightCm: TESTER.heightCm,
    age: TESTER.age,
    activityLevel: nextLevel,
    goal: TESTER.goal,
    planPace: TESTER.planPace,
    nutritionStrategy: TESTER.nutritionStrategy,
  });
  if (!recomputed) throw new Error("recompute returned null — basics should be valid");
  // Strip the non-DB field before write.
  const { maintenanceTdee: _m, ...dbWriteable } = recomputed;
  const payload = { activity_level: nextLevel, ...dbWriteable };
  await mockSupabase.from("profiles").update(payload).eq("id", userId);
  return payload;
}

function makeMockSupabase() {
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ update, eq }));
  // Chain: .from("profiles").update(...).eq("id", uid)
  // Wire update → return { eq } so `.update(...).eq(...)` resolves.
  update.mockImplementation(() => ({ eq }));
  return { from, update, eq };
}

describe("profile activity-level update pipeline", () => {
  it("writes activity_level + recomputed target_calories + macros to profiles", async () => {
    const supabase = makeMockSupabase();
    const payload = await simulateSaveActivityLevel(supabase, "user-123", "sedentary");

    // `from("profiles").update(payload).eq("id", "user-123")`
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.update).toHaveBeenCalledTimes(1);
    expect(supabase.eq).toHaveBeenCalledWith("id", "user-123");

    const written = supabase.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written).toEqual(payload);
    // Exactly the six fields — no stray columns.
    expect(Object.keys(written).sort()).toEqual(
      [
        "activity_level",
        "target_calories",
        "target_carbs",
        "target_fat",
        "target_fiber_g",
        "target_protein",
      ].sort(),
    );
    expect(written.activity_level).toBe("sedentary");
  });

  it("recomputed target_calories matches calculateBudget(calculateTDEE, pace, goal) exactly", async () => {
    const supabase = makeMockSupabase();
    const payload = await simulateSaveActivityLevel(supabase, "user-123", "sedentary");

    const tdee = calculateTDEE(
      TESTER.sex,
      TESTER.weightKg,
      TESTER.heightCm,
      TESTER.age,
      "sedentary",
    );
    const expected = calculateBudget(tdee, TESTER.planPace, TESTER.goal);
    expect(payload.target_calories).toBe(expected);
  });

  it("recomputed macros match calculateMacros exactly (no duplicated math)", async () => {
    const supabase = makeMockSupabase();
    const payload = await simulateSaveActivityLevel(supabase, "user-123", "sedentary");

    const tdee = calculateTDEE(
      TESTER.sex,
      TESTER.weightKg,
      TESTER.heightCm,
      TESTER.age,
      "sedentary",
    );
    const budget = calculateBudget(tdee, TESTER.planPace, TESTER.goal);
    const macros = calculateMacros(budget, TESTER.nutritionStrategy, TESTER.weightKg);
    expect(payload.target_protein).toBe(macros.protein);
    expect(payload.target_carbs).toBe(macros.carbs);
    expect(payload.target_fat).toBe(macros.fat);
    expect(payload.target_fiber_g).toBe(macros.fiber);
  });

  it("seeds maintenance at sedentary regardless of the requested activity level (TDEE gating 2026-06-10)", () => {
    // SUPERSEDES the old "moderate → sedentary lowers maintenance by ~430"
    // assertion. The formula maintenance baseline now SEEDS AT SEDENTARY (1.2)
    // for ALL activity levels, because this recompute path's target_calories
    // coexists with the per-day activity bonus on Today — the bonus pays for
    // activity, so the activity *multiplier* must not also move maintenance
    // (that was the latent double-count, survey §4 +
    // `docs/decisions/2026-06-10-adaptive-tdee-gating.md`).
    //
    // PRODUCT CONSEQUENCE (flagged for product-lead, ENG follow-up): the
    // Settings activity-level self-edit (the AIIm60n / AHCSYMATS fix) no longer
    // moves the maintenance number — the control still persists `activity_level`
    // but the calorie target is the same lazy-day number whatever the user
    // picks. Honest under the add-back model; whether the Settings control
    // should still exist / be reframed is a separate UX call.
    const asModerate = recomputeTargetsForActivity({
      sex: TESTER.sex,
      weightKg: TESTER.weightKg,
      heightCm: TESTER.heightCm,
      age: TESTER.age,
      activityLevel: "moderate",
      goal: TESTER.goal,
      planPace: TESTER.planPace,
      nutritionStrategy: TESTER.nutritionStrategy,
    });
    const asSedentary = recomputeTargetsForActivity({
      sex: TESTER.sex,
      weightKg: TESTER.weightKg,
      heightCm: TESTER.heightCm,
      age: TESTER.age,
      activityLevel: "sedentary",
      goal: TESTER.goal,
      planPace: TESTER.planPace,
      nutritionStrategy: TESTER.nutritionStrategy,
    });
    expect(asModerate).not.toBeNull();
    expect(asSedentary).not.toBeNull();
    // Both seed at sedentary → identical maintenance, zero delta.
    expect(asModerate!.maintenanceTdee).toBe(asSedentary!.maintenanceTdee);
    expect(asModerate!.maintenanceTdee).toBe(
      calculateTDEE(TESTER.sex, TESTER.weightKg, TESTER.heightCm, TESTER.age, "sedentary"),
    );
  });

  it("returns null (no fabricated fallback) when basics are missing", () => {
    const result = recomputeTargetsForActivity({
      sex: "female",
      weightKg: 0,
      heightCm: 163,
      age: 34,
      activityLevel: "sedentary",
    });
    expect(result).toBeNull();
  });

  it("defaults plan_pace=steady and goal=maintain when omitted (onboarding-default parity)", () => {
    const explicit = recomputeTargetsForActivity({
      sex: TESTER.sex,
      weightKg: TESTER.weightKg,
      heightCm: TESTER.heightCm,
      age: TESTER.age,
      activityLevel: "sedentary",
      goal: "maintain",
      planPace: "steady",
      nutritionStrategy: "balanced",
    });
    const implicit = recomputeTargetsForActivity({
      sex: TESTER.sex,
      weightKg: TESTER.weightKg,
      heightCm: TESTER.heightCm,
      age: TESTER.age,
      activityLevel: "sedentary",
    });
    expect(implicit).not.toBeNull();
    expect(implicit!.target_calories).toBe(explicit!.target_calories);
    expect(implicit!.target_protein).toBe(explicit!.target_protein);
  });
});
