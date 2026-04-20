/**
 * Onboarding v2 — completion persistence.
 *
 * Mirrors the legacy `app/onboarding/page.tsx` upsert (lines ~247-310)
 * so a v2 completer ends up with the same `profiles` row a legacy
 * completer would have. Required by OB2-1 (decision doc 2026-04-19)
 * before the `onboarding_v2` PostHog flag can flip beyond the internal
 * preview cohort.
 *
 * Three model gaps between v2 and the production schema, all handled
 * here so the rest of the v2 codebase doesn't have to know.
 * `data-integrity` reviewed + signed off the mapping — see notes
 * inline below where it diverges from the obvious thing.
 *
 *  - **Goal vocabulary.** v2 uses lose / maintain / gain / recomp;
 *    the app contract type `Goal = "cut" | "maintain" | "bulk"`
 *    (no DB CHECK, but every read site switches on this enum, so
 *    writing "recomp" silently breaks weight projection / digest
 *    cascade / weight-trend tile). Mapping:
 *      lose    → cut
 *      gain    → bulk
 *      maintain → maintain
 *      recomp  → cut  (deficit semantics; nutrition_strategy =
 *                      "high_protein" is the differentiating signal)
 *  - **Pace.** v2 uses a continuous `paceKgPerWeek` slider; the
 *    `plan_pace` column is the legacy preset enum
 *    `relaxed | steady | accelerated | vigorous`. Mapping snaps to
 *    nearest preset using the same kg/week values `tdee.ts:PACE_WEEKLY_KG`
 *    defines (0.25 / 0.5 / 0.75 / 1.0).
 *  - **weightSkipped.** v2 lets users opt out of entering a weight
 *    (diversity-inclusion Stage F path). When set, we write a partial
 *    profile (no weight, no targets). The Today screen renders its
 *    existing pre-target empty state — `dailyTargetSnapshot` already
 *    short-circuits when target_calories is null, so the snapshot
 *    table doesn't get polluted. data-integrity verified the read
 *    path handles null targets gracefully.
 *
 * Defaults for fields the legacy form captured but v2 doesn't:
 *  - `user_tier`: "free"
 *  - `goal_weight_kg`: null (v2 doesn't ask; legacy only writes
 *    non-null for cut goals anyway)
 *  - `prefer_activity_adjusted_calories`: false (legacy default)
 *  - `target_calories_source`: "onboarding" — same value the legacy
 *    form writes. data-integrity rejected `"onboarding_v2"` because
 *    the column has a 5-value CHECK constraint that would throw
 *    23514 on insert. v2 attribution belongs in analytics, not
 *    provenance overload.
 *
 * Things we deliberately do NOT do here:
 *  - **No `target_water_ml` write.** Column doesn't exist in any
 *    migration. Legacy was silently dead-writing it (PostgREST drops
 *    unknown columns when schema cache permits). Water is tracked
 *    via `extra_water_by_day jsonb` separately.
 *  - **No `daily_targets` snapshot call from this path.** That helper
 *    is "first food log of the day wins" by design (see F-2 invariant
 *    in `dailyTargetSnapshot.ts`). Snapshotting on onboarding
 *    completion would freeze a brand-new target before any logging
 *    happened, and re-onboarding mid-day would corrupt today's `% of
 *    goal` reads. The first food log will trigger the snapshot
 *    naturally.
 *
 * Failure handling: any Supabase error is swallowed + console.warned.
 * The caller is responsible for the local profile save (browser
 * localStorage) so the UX works when Supabase is down — same pattern
 * as legacy onboarding's defence-in-depth.
 */

import type {
  ActivityLevel,
  Goal as ProductionGoal,
  Sex,
} from "@/lib/nutrition/tdee";
import type { Goal as V2Goal, OnboardingState } from "./state";
import type { V2Targets } from "./targets";

/** Map v2 continuous pace to nearest legacy `plan_pace` preset.
 *  Mirrors the kg/week values `PACE_WEEKLY_KG` defines in tdee.ts.
 *  Maintain returns `relaxed` defensively — the field is non-null in
 *  the DB but ignored when goal=maintain. */
export function mapPaceToPreset(
  paceKgPerWeek: number | null,
): "relaxed" | "steady" | "accelerated" | "vigorous" {
  const pace = paceKgPerWeek ?? 0.4;
  // Snap to the nearest preset by absolute distance.
  const presets: Array<{
    name: "relaxed" | "steady" | "accelerated" | "vigorous";
    kg: number;
  }> = [
    { name: "relaxed", kg: 0.25 },
    { name: "steady", kg: 0.5 },
    { name: "accelerated", kg: 0.75 },
    { name: "vigorous", kg: 1.0 },
  ];
  let best = presets[0];
  let bestDist = Math.abs(pace - best.kg);
  for (const p of presets) {
    const d = Math.abs(pace - p.kg);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best.name;
}

/** Map v2 goal to the legacy `profiles.goal` enum. */
export function mapV2GoalToLegacy(goal: V2Goal): ProductionGoal {
  switch (goal) {
    case "lose":
    case "recomp":
      return "cut";
    case "maintain":
      return "maintain";
    case "gain":
      return "bulk";
  }
}

/** Minimal Supabase client shape — same loose typing as
 *  `dailyTargetSnapshot.ts` so this helper works for both web
 *  (`browserClient`) and mobile (`@/lib/supabase`) without `as any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PersistSupabaseClient = any;

export interface PersistResult {
  ok: boolean;
  /** Error message when ok=false. Caller decides whether to surface. */
  error?: string;
}

/** The shape we hand to the Supabase upsert. Exported for tests so
 *  the mapping can be asserted without round-tripping through the DB.
 *
 *  NOTE: no `target_water_ml`. The column doesn't exist; data-integrity
 *  flagged that legacy was silently dead-writing it. */
export interface ProfileUpsertRow {
  id: string;
  display_name: string | null;
  user_tier: "free";
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: ProductionGoal | null;
  goal_weight_kg: number | null;
  plan_pace: "relaxed" | "steady" | "accelerated" | "vigorous" | null;
  nutrition_strategy: string | null;
  dietary: string[];
  measurement_system: "metric" | "imperial";
  target_calories: number | null;
  target_calories_set_at: string | null;
  /** One of the legacy 5-value enum: 'onboarding' | 'user' | 'recompute'
   *  | 'digest_recalibration' | 'reset_default'. v2 writes "onboarding"
   *  to satisfy the CHECK; v2 vs legacy attribution is captured via
   *  the `onboarding_completed` analytics event payload, not here. */
  target_calories_source: "onboarding" | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  target_fiber_g: number | null;
  prefer_activity_adjusted_calories: boolean;
  onboarding_completed: true;
}

/** Build the `profiles` upsert row from v2 state + computed targets.
 *  Pure function — extracted so tests can assert the schema mapping
 *  without mocking Supabase. */
export function buildProfileUpsertRow(args: {
  userId: string;
  state: OnboardingState;
  targets: V2Targets | null;
  now?: Date;
}): ProfileUpsertRow {
  const { userId, state, targets } = args;
  const now = args.now ?? new Date();

  // weightSkipped path — keep the partial profile honest. weight_kg
  // and all target_* columns nulled out. The Today screen renders
  // calibrate-from-logs copy when target_calories is null (existing
  // empty-state branch).
  const hasTargets = !state.weightSkipped && targets != null;

  return {
    id: userId,
    display_name: state.name.trim() ? state.name.trim() : null,
    user_tier: "free",
    sex: state.sex,
    age: Number.isFinite(state.age) ? state.age : null,
    height_cm: Number.isFinite(state.heightCm) ? state.heightCm : null,
    weight_kg: state.weightSkipped
      ? null
      : Number.isFinite(state.weightKg)
        ? state.weightKg
        : null,
    activity_level: state.activity,
    goal: state.goal ? mapV2GoalToLegacy(state.goal) : null,
    goal_weight_kg: null,
    plan_pace:
      state.goal === "maintain" || state.weightSkipped
        ? null
        : mapPaceToPreset(state.paceKgPerWeek),
    nutrition_strategy: targets?.strategy ?? null,
    dietary: state.diet,
    measurement_system: state.unitSystem,
    target_calories: hasTargets ? targets!.target : null,
    target_calories_set_at: hasTargets ? now.toISOString() : null,
    // Reuses the legacy enum value to satisfy the CHECK on
    // `target_calories_source` (5-value enum, no "onboarding_v2"
    // option). v2-specific attribution is fired via the
    // `onboarding_completed` analytics event payload.
    target_calories_source: hasTargets ? "onboarding" : null,
    target_protein: hasTargets ? targets!.proteinG : null,
    target_carbs: hasTargets ? targets!.carbsG : null,
    target_fat: hasTargets ? targets!.fatG : null,
    target_fiber_g: hasTargets ? targets!.fiberG : null,
    prefer_activity_adjusted_calories: false,
    onboarding_completed: true,
  };
}

/** Persist v2 onboarding completion to Supabase. Returns a struct so
 *  the caller can decide whether to toast on partial failure. Local
 *  profile save (browser only) is the responsibility of the caller —
 *  this function is platform-agnostic. */
export async function persistOnboardingV2(
  supabase: PersistSupabaseClient,
  args: {
    userId: string;
    state: OnboardingState;
    targets: V2Targets | null;
    now?: Date;
  },
): Promise<PersistResult> {
  const row = buildProfileUpsertRow(args);

  let upsertError: string | undefined;
  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" });
    if (error) {
      upsertError = error.message ?? "profiles upsert failed";
      // eslint-disable-next-line no-console
      console.warn("[onboarding-v2] profiles upsert failed:", upsertError);
    }
  } catch (e) {
    upsertError = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn("[onboarding-v2] profiles upsert threw:", upsertError);
  }

  // Note: we deliberately do NOT call snapshotDailyTargetIfMissing
  // here. The snapshot is "first food log of the day wins" by design
  // (F-2 invariant). The user's first log will trigger it naturally
  // and freeze the new target into today's row. Calling it from this
  // path would corrupt today's `% of goal` reads if the user
  // re-runs onboarding mid-day. data-integrity Stage F sign-off.

  return {
    ok: upsertError == null,
    error: upsertError,
  };
}
