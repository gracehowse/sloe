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

// MV-01 fix (2026-04-28): switched from web-only `@/...` aliases to
// relative paths so mobile tsc can resolve this module when imported
// via `apps/mobile/components/onboarding-v2/mobile-flow.tsx` for the
// terminal-step completion handler.
import type { ActivityLevel, Sex } from "../nutrition/tdee";
// `Goal` lives at `src/types/profile.ts` (the legacy DB-aligned enum
// `"cut" | "maintain" | "bulk"`). tdee.ts uses `goalType: string`
// because legacy onboarding mixes UI labels in.
import type { Goal as ProductionGoal } from "../../types/profile";
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

/**
 * Build-40 (2026-05-01) — resolve the targets to persist, honouring
 * a manual override from the data-bridges step.
 *
 * Three-way decision:
 *   1. All four manual fields set + finite + > 0 → synthesise a
 *      `V2Targets` from them (kcal + P/C/F). Macro fiber is computed
 *      via the same 14g/1000kcal heuristic the production calc uses
 *      (`calculateMacros` in tdee.ts). Other fields (`bmr`, `tdee`,
 *      `pace`, `kcalAdj`, `strategy`, `belowSafetyFloor`, `safety`)
 *      are best-effort — copied from `computed` when present, set to
 *      sane defaults otherwise.
 *   2. computed != null → return computed (the normal flow).
 *   3. neither → return null (caller writes a partial profile, same
 *      as the `weightSkipped` path).
 *
 * The manual override path is the MFP / MacroFactor refugee scenario:
 * the user already knows their targets and pasting them in skips the
 * BMR estimate that's going to be wrong for them anyway. We capture
 * `strategy: "balanced"` as a defensive default so the macro-style
 * field on `profiles` isn't null (a few read sites switch on it).
 *
 * Pure function — exported separately so tests assert the precedence
 * rule without round-tripping through `buildProfileUpsertRow`.
 */
export function effectiveTargetsForPersist(
  state: OnboardingState,
  computed: V2Targets | null,
): V2Targets | null {
  const m = {
    kcal: state.manualTargetsKcal,
    protein: state.manualTargetsProteinG,
    carbs: state.manualTargetsCarbsG,
    fat: state.manualTargetsFatG,
  };
  const allFiniteAndPositive =
    m.kcal != null && Number.isFinite(m.kcal) && m.kcal > 0 &&
    m.protein != null && Number.isFinite(m.protein) && m.protein > 0 &&
    m.carbs != null && Number.isFinite(m.carbs) && m.carbs > 0 &&
    m.fat != null && Number.isFinite(m.fat) && m.fat > 0;

  if (!allFiniteAndPositive) return computed;

  // Synthesise a V2Targets shape from manual inputs. Fiber: 14g per
  // 1000kcal (NHS / DRI guideline; same heuristic `calculateMacros`
  // applies). Round to whole-gram for display parity.
  const fiberG = Math.round((m.kcal! / 1000) * 14);
  return {
    bmr: computed?.bmr ?? 0,
    tdee: computed?.tdee ?? m.kcal!,
    target: Math.round(m.kcal!),
    proteinG: Math.round(m.protein!),
    carbsG: Math.round(m.carbs!),
    fatG: Math.round(m.fat!),
    fiberG,
    pace: computed?.pace ?? 0,
    kcalAdj: computed?.kcalAdj ?? 0,
    // Default strategy when the user never reached the strategy step
    // in a manual-target flow. Read sites that switch on this field
    // (Today screen macro tile copy) treat "balanced" as the no-op.
    strategy: computed?.strategy ?? "balanced",
    belowSafetyFloor: computed?.belowSafetyFloor ?? false,
    safety: computed?.safety ?? "safe",
  };
}

/** Build the `profiles` upsert row from v2 state + computed targets.
 *  Pure function — extracted so tests can assert the schema mapping
 *  without mocking Supabase.
 *
 *  Build-40 (2026-05-01) — `effectiveTargetsForPersist` is consulted
 *  first so a manual override from the data-bridges step wins over
 *  the computed targets. The `weightSkipped` honest-partial-profile
 *  branch still applies, BUT a user who skipped the weight step AND
 *  set all four manual targets has both a partial profile (no weight)
 *  AND concrete targets — `hasTargets` falls through to the manual
 *  override below for that case so the Today screen has numbers to
 *  show against. */
export function buildProfileUpsertRow(args: {
  userId: string;
  state: OnboardingState;
  targets: V2Targets | null;
  now?: Date;
}): ProfileUpsertRow {
  const { userId, state } = args;
  const now = args.now ?? new Date();

  // Build-40: manual override wins. effectiveTargetsForPersist returns
  // a synthetic V2Targets when the user pasted in their own kcal /
  // P / C / F on the data-bridges step; otherwise it returns
  // `args.targets` unchanged.
  const targets = effectiveTargetsForPersist(state, args.targets);

  // weightSkipped path — keep the partial profile honest. weight_kg
  // is nulled out always. Targets are nulled UNLESS the user
  // overrode them manually (Build-40): the manual-target path
  // implies they know their numbers, regardless of whether they put
  // a weight on the scale.
  const manualOverride =
    state.manualTargetsKcal != null &&
    state.manualTargetsProteinG != null &&
    state.manualTargetsCarbsG != null &&
    state.manualTargetsFatG != null;
  const hasTargets = (manualOverride || !state.weightSkipped) && targets != null;

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
    prefer_activity_adjusted_calories: true,
    onboarding_completed: true,
  };
}

/** Persist v2 onboarding completion to Supabase. Returns a struct so
 *  the caller can decide whether to toast on partial failure. Local
 *  profile save (browser only) is the responsibility of the caller —
 *  this function is platform-agnostic. */
export async function persistOnboarding(
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
       
      console.warn("[onboarding-v2] profiles upsert failed:", upsertError);
    }
  } catch (e) {
    upsertError = e instanceof Error ? e.message : String(e);
     
    console.warn("[onboarding-v2] profiles upsert threw:", upsertError);
  }

  // Note: we deliberately do NOT call snapshotDailyTargetIfMissing
  // here. The snapshot is "first food log of the day wins" by design
  // (F-2 invariant). The user's first log will trigger it naturally
  // and freeze the new target into today's row. Calling it from this
  // path would corrupt today's `% of goal` reads if the user
  // re-runs onboarding mid-day. data-integrity Stage F sign-off.

  // F-149 (2026-05-11): seed goal_history with the onboarding values
  // so a new user immediately has a baseline row. Without this, the
  // very first read after onboarding (before any food log) would
  // bypass goal_history and fall through to the live-profile path.
  // The helper dedupes by goal-shape, so re-running onboarding mid-day
  // with identical values is a no-op. Fire-and-forget.
  if (upsertError == null) {
    const { recordGoalHistory } = await import("../nutrition/goalHistory");
    void recordGoalHistory(
      supabase as Parameters<typeof recordGoalHistory>[0],
      args.userId,
      {
        activity_level: typeof row.activity_level === "string" ? row.activity_level : null,
        goal: typeof row.goal === "string" ? row.goal : null,
        plan_pace: typeof row.plan_pace === "string" ? row.plan_pace : null,
        target_calories: typeof row.target_calories === "number" ? row.target_calories : null,
        target_protein_g: typeof row.target_protein === "number" ? row.target_protein : null,
        target_carbs_g: typeof row.target_carbs === "number" ? row.target_carbs : null,
        target_fat_g: typeof row.target_fat === "number" ? row.target_fat : null,
        target_fiber_g: typeof row.target_fiber_g === "number" ? row.target_fiber_g : null,
      },
      "onboarding",
    );
  }

  return {
    ok: upsertError == null,
    error: upsertError,
  };
}
