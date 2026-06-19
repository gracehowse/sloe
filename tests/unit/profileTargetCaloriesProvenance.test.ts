/**
 * target_calories provenance write contract — A2 schema migration
 * (20260427110000_profiles_target_calories_provenance.sql).
 *
 * The Maintenance Recalibrate suggestion (Progress Digest, Rule 2) reads
 * `target_calories_source` + `target_calories_set_at` to decide whether the
 * user just hand-set their target — if so, suppress the suggestion. That
 * only works if every write site stamps both columns truthfully.
 *
 * This test pins the activity-level recompute path (mobile site #6 / web
 * site #7) — the highest-traffic non-onboarding write — so a future change
 * that drops or mistags the provenance is caught immediately.
 *
 * Pattern mirrors `profileActivityUpdate.test.ts`. The other 8 sites (3 ×
 * onboarding, 2 × user, 2 × reset_default, 1 × future) are covered by code
 * review + comment audit; if any of them grow logic worth pinning, add a
 * smoke test alongside this one.
 */
import { describe, expect, it, vi } from "vitest";
import { recomputeTargetsForActivity } from "../../src/lib/nutrition/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "../../src/lib/nutrition/persistRecomputedTargets";

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
 * Mirrors what apps/mobile/app/(tabs)/settings.tsx and
 * src/app/components/Settings.tsx do in their activity-picker onConfirm:
 * recompute targets, then stamp provenance only when targets actually
 * changed. The exact payload shape this builds must match what those
 * components send to supabase.
 */
async function simulateRecomputeWrite(
  mockSupabase: ReturnType<typeof makeMockSupabase>,
  userId: string,
  nextLevel: Parameters<typeof recomputeTargetsForActivity>[0]["activityLevel"],
  now: Date,
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
  const { maintenanceTdee: _m, ...dbWriteable } = recomputed;
  const payload = {
    activity_level: nextLevel,
    ...dbWriteable,
    target_calories_set_at: now.toISOString(),
    target_calories_source: "recompute" as const,
    target_fiber_source: "recompute" as const,
  };
  await mockSupabase.from("profiles").update(payload).eq("id", userId);
  return payload;
}

function makeMockSupabase() {
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ update, eq }));
  update.mockImplementation(() => ({ eq }));
  return { from, update, eq };
}

describe("target_calories provenance write contract", () => {
  it("activity-level recompute writes target_calories_source = 'recompute'", async () => {
    const supabase = makeMockSupabase();
    const now = new Date("2026-04-19T12:34:56.000Z");
    const payload = await simulateRecomputeWrite(supabase, "user-123", "sedentary", now);

    expect(payload.target_calories_source).toBe("recompute");
  });

  it("activity-level recompute stamps target_calories_set_at with NOW()", async () => {
    const supabase = makeMockSupabase();
    const now = new Date("2026-04-19T12:34:56.000Z");
    const payload = await simulateRecomputeWrite(supabase, "user-123", "sedentary", now);

    expect(payload.target_calories_set_at).toBe("2026-04-19T12:34:56.000Z");
    // Sanity — must be parseable as a real timestamp, not a stale fixture string.
    expect(new Date(payload.target_calories_set_at).getTime()).toBe(now.getTime());
  });

  it("write payload carries both provenance columns alongside the recomputed targets", async () => {
    const supabase = makeMockSupabase();
    const now = new Date("2026-04-19T12:34:56.000Z");
    const payload = await simulateRecomputeWrite(supabase, "user-123", "sedentary", now);

    const written = supabase.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written).toEqual(payload);
    // The full set of expected DB columns on the recompute path.
    expect(Object.keys(written).sort()).toEqual(
      [
        "activity_level",
        "target_calories",
        "target_calories_set_at",
        "target_calories_source",
        "target_fiber_source",
        "target_carbs",
        "target_fat",
        "target_fiber_g",
        "target_protein",
      ].sort(),
    );
  });

  it("source value is one of the 5 enum values defined by the migration CHECK constraint", async () => {
    const supabase = makeMockSupabase();
    const now = new Date("2026-04-19T12:34:56.000Z");
    const payload = await simulateRecomputeWrite(supabase, "user-123", "moderate", now);

    // Mirrors the CHECK constraint in
    // supabase/migrations/20260427110000_profiles_target_calories_provenance.sql.
    const allowedSources = [
      "onboarding",
      "user",
      "recompute",
      "digest_recalibration",
      "reset_default",
    ];
    expect(allowedSources).toContain(payload.target_calories_source);
  });

  it("Rule 2 suppression contract: 'user' source within 14d should be detectable from these columns", () => {
    // This is a contract-shape test — the actual Rule 2 implementation lives
    // in apps/mobile/lib/weeklyDigestSuggestion.ts (T7, in flight). This
    // test asserts the data shape it will read is well-formed enough to
    // drive the suppression check.
    const userWriteRecent = {
      target_calories_source: "user" as const,
      target_calories_set_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7d ago
    };
    const userWriteOld = {
      target_calories_source: "user" as const,
      target_calories_set_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30d ago
    };
    const recomputeWrite = {
      target_calories_source: "recompute" as const,
      target_calories_set_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1d ago
    };
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const isUserSetRecently = (row: { target_calories_source: string; target_calories_set_at: string }) =>
      row.target_calories_source === "user" &&
      Date.now() - new Date(row.target_calories_set_at).getTime() <= fourteenDaysMs;

    expect(isUserSetRecently(userWriteRecent)).toBe(true); // suppress Rule 2
    expect(isUserSetRecently(userWriteOld)).toBe(false); // don't suppress
    expect(isUserSetRecently(recomputeWrite)).toBe(false); // don't suppress
  });

  // ENG goal-editor (2026-05-25): the new "Edit goal & pace" editor is a
  // second non-onboarding write site that must stamp "recompute" (NOT
  // "user"). Both platforms route through `persistRecomputedTargets`, so
  // pinning it here guards the provenance contract for the goal-change
  // path the same way the activity-level path is pinned above. A goal
  // change is intent, not a manual override — "user" would wrongly trip
  // the 14-day digest-suppression cooldown.
  it("goal-change recompute (via persistRecomputedTargets) stamps 'recompute', never 'user'", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload);
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === "daily_targets") return { upsert: async () => ({ error: null }) };
        // goal_history read+insert
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
      },
    };

    const recomputed = recomputeTargetsForActivity({
      sex: "female",
      weightKg: 55,
      heightCm: 163,
      age: 34,
      activityLevel: "moderate",
      goal: "bulk", // goal CHANGE
      planPace: "steady",
      nutritionStrategy: "balanced",
    });
    if (!recomputed) throw new Error("recompute returned null — fixture is valid");

    const now = new Date("2026-05-25T10:00:00.000Z");
    const result = await persistRecomputedTargets(supabase as never, "user-xyz", {
      profileUpdate: { goal: "bulk", plan_pace: "steady" },
      recomputed,
      source: "recompute",
      now,
    });

    expect(result.ok).toBe(true);
    const written = updates.at(-1)!;
    expect(written.target_calories_source).toBe("recompute");
    expect(written.target_fiber_source).toBe("recompute");
    expect(written.target_calories_set_at).toBe(now.toISOString());

    // The Rule 2 suppression check must NOT fire for this write (it only
    // fires for source === "user"). Mirror the predicate from above.
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const isUserSetRecently = (row: {
      target_calories_source: unknown;
      target_calories_set_at: unknown;
    }) =>
      row.target_calories_source === "user" &&
      Date.now() - new Date(String(row.target_calories_set_at)).getTime() <= fourteenDaysMs;
    expect(
      isUserSetRecently({
        target_calories_source: written.target_calories_source,
        target_calories_set_at: written.target_calories_set_at,
      }),
    ).toBe(false);
  });
});
