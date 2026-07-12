/**
 * F-2 · Daily target snapshot write helper.
 *
 * Freezes the user's current target/plan state into `daily_targets` on
 * the first write of a local day. Past days stop moving when the user
 * later edits `activity_level` / `plan_pace` / `goal`. See migration
 * `20260425120000_daily_targets.sql` and TestFlight feedback
 * `AEyOuUJrB4l` (2026-04-19).
 *
 * Contract:
 *   - One row per (`user_id`, `date_key`). First write wins — we use
 *     `on conflict do nothing` so re-logs on the same day never clobber.
 *   - Called on the "log food" code path, after the optimistic UI add
 *     but fire-and-forget relative to the insert — a snapshot failure
 *     must never block the user's log.
 *   - No row is written when the user has no `target_calories` set
 *     (pre-onboarding edge case — we'd be freezing garbage).
 *   - `date_key` is always *today local*. Copying a meal into a past
 *     day does NOT backfill that past day's snapshot — the read path
 *     falls back to the current profile target for days without a
 *     snapshot (the retro-approximate chip in the UI signals that).
 *
 * Cross-platform:
 *   - Both web (`browserClient`) and mobile (`@/lib/supabase`)
 *     instances satisfy this shape. The helper is deliberately typed
 *     loosely so a single copy lives under `src/lib/nutrition/…` and
 *     the mobile bundle imports it via its existing relative import
 *     pattern (matches e.g. `savedMeals.ts`).
 */

import { dateKeyFromDate } from "./trackerStats";
import {
  effectiveTargetsForDateKey,
  parseDayTargetSchedule,
} from "./dayTargetSchedule";
import { resolveMaintenance } from "./resolveMaintenance";
import { buildMaintenanceInputs } from "./energyNumbers";

/**
 * Minimal Supabase client shape used by this helper. Both the web
 * `SupabaseClient<Database>` and mobile `@/lib/supabase` export satisfy
 * it without a `as any`.
 */
 
export type DailyTargetSnapshotClient = any;

/**
 * Writes a `daily_targets` row for (`userId`, today) only when no row
 * exists yet. Returns a boolean indicating whether a fresh snapshot
 * was attempted — `false` means we deliberately skipped (no userId,
 * no profile target yet, or the helper was asked not to write).
 *
 * Failures are logged to `console.warn` and swallowed: the user's
 * meal log must not roll back because the snapshot couldn't write.
 */
export async function snapshotDailyTargetIfMissing(
  supabase: DailyTargetSnapshotClient,
  userId: string | null | undefined,
  opts?: {
    now?: Date;
    /**
     * ENG-1506 — `true` routes the maintenance resolve through the
     * canonical `buildMaintenanceInputs` policy (latest weigh-in beats
     * the lagging profile snapshot, strict-null basics). Callers pass
     * `isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)` — this module is shared
     * web + mobile, so the HOST owns the flag read (same pattern as
     * `netEnergyBalance`'s `balancedWording`). Default `false` keeps the
     * exact pre-ENG-1506 input assembly: `daily_targets` is first-write-
     * wins/frozen, so while the flag is OFF the writer must freeze the
     * SAME number every flag-OFF display surface shows (F-145 contract) —
     * an early adoption here would be un-fixable by the kill switch.
     */
    canonicalEnergyInputs?: boolean;
  },
): Promise<boolean> {
  if (!userId) return false;

  const today = dateKeyFromDate(opts?.now ?? new Date());

  // Read the user's *current* targets + plan state. These are the values
  // we freeze for this day — later profile edits must not rewrite them.
  //
  // F-145 (2026-05-10): we now resolve maintenance via `resolveMaintenance`
  // at write time so the snapshot stores the SAME number `Today` displays.
  // Previously we stored raw `profile.adaptive_tdee` only, which:
  //   - was `null` for users without enough adaptive data → past-day reads
  //     fell back to live `currentTargets` and showed *today's* maintenance
  //     against past meals (the "1900 vs 1600" divergence on Maintenance);
  //   - bypassed the staleness check `resolveMaintenance` enforces, so a
  //     stale adaptive value could freeze into the snapshot.
  // We pull the formula inputs (sex/weight/height/age/activity) so
  // `resolveMaintenance` can fall back to Mifflin-St Jeor when adaptive
  // is missing or rejected as stale.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, activity_level, plan_pace, goal, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, weight_kg, weight_kg_by_day, height_cm, age, calorie_schedule, high_days",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
     
    console.warn(
      "[dailyTargetSnapshot] profile read failed — skipping",
      profileErr.message ?? "",
    );
    return false;
  }
  if (!profile) return false;

  const targetCalories = toInt(profile.target_calories);
  // Skip if the user has no calorie target yet — freezing `null` would
  // just pollute the snapshot table and leak as "N% of null" later.
  if (targetCalories == null) return false;

  // F-145: resolve maintenance via the canonical helper so the
  // snapshotted number matches what Today shows. Falls back gracefully
  // when adaptive isn't set yet (formula path) or when adaptive is
  // stale (rejected → formula). Only stores `null` when we genuinely
  // cannot compute (e.g. pre-onboarding profile with no body stats).
  // ENG-1506 — flag ON (`canonicalEnergyInputs`, host-read): inputs come
  // from the canonical `buildMaintenanceInputs` policy (latest weigh-in
  // over the lagging profile snapshot, strict-null basics) so the frozen
  // snapshot can't disagree with live display once `energy_numbers_v1`
  // ramps. Flag OFF: the exact pre-ENG-1506 assembly below — the frozen
  // row must match what flag-OFF Today displayed that day (kill switch).
  const resolved = resolveMaintenance(
    opts?.canonicalEnergyInputs
      ? buildMaintenanceInputs(profile)
      : {
          sex: typeof profile.sex === "string" ? (profile.sex as "male" | "female") : null,
          weight_kg: typeof profile.weight_kg === "number" ? profile.weight_kg : null,
          height_cm: typeof profile.height_cm === "number" ? profile.height_cm : null,
          age: typeof profile.age === "number" ? profile.age : null,
          activity_level: typeof profile.activity_level === "string" ? (profile.activity_level as Parameters<typeof resolveMaintenance>[0]["activity_level"]) : null,
          adaptive_tdee: typeof profile.adaptive_tdee === "number" ? profile.adaptive_tdee : null,
          adaptive_tdee_confidence: typeof profile.adaptive_tdee_confidence === "string" ? profile.adaptive_tdee_confidence : null,
          adaptive_tdee_updated_at: profile.adaptive_tdee_updated_at ?? null,
        },
    { now: opts?.now },
  );

  // ENG-960 — snapshot the SCHEDULE-ADJUSTED target for this day so history
  // (recap/progress) matches what the ring showed. Flat when not opted in.
  const eff = effectiveTargetsForDateKey(
    {
      calories: targetCalories,
      proteinG: toInt(profile.target_protein),
      carbsG: toInt(profile.target_carbs),
      fatG: toInt(profile.target_fat),
      fiberG: toInt(profile.target_fiber_g),
    },
    parseDayTargetSchedule(profile.calorie_schedule, profile.high_days),
    today,
  );

  const row = {
    user_id: userId,
    date_key: today,
    target_calories: eff.calories,
    target_protein_g: eff.proteinG,
    target_carbs_g: eff.carbsG,
    target_fat_g: eff.fatG,
    target_fiber_g: eff.fiberG,
    activity_level: typeof profile.activity_level === "string" ? profile.activity_level : null,
    plan_pace: typeof profile.plan_pace === "string" ? profile.plan_pace : null,
    goal: typeof profile.goal === "string" ? profile.goal : null,
    maintenance_tdee: resolved?.kcal ?? toInt(profile.adaptive_tdee),
  };

  // `ignoreDuplicates: true` maps to `on conflict do nothing` at the
  // Supabase REST layer. First write per (user, date) wins. Re-logs on
  // the same day are silently no-ops — the snapshot stays frozen.
  // We use `upsert(..., { ignoreDuplicates: true })` because that's
  // the supabase-js helper for the "insert if not present, else skip"
  // semantic. Using `.insert` with those options is not a supported
  // API.
  const { error: insertErr } = await supabase
    .from("daily_targets")
    .upsert(row, { onConflict: "user_id,date_key", ignoreDuplicates: true });

  if (insertErr) {
    // Missing table (migration not applied yet) or transient network
    // error — we don't block the user. Keep a single low-noise warn
    // so it shows up in Sentry without flooding during rollout.
     
    console.warn(
      "[dailyTargetSnapshot] insert failed (probably migration pending) — skipping",
      insertErr.message ?? "",
    );
    return false;
  }

  return true;
}

function toInt(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * F-149 (2026-05-10) — backfill missing past-day snapshots.
 *
 * Why this exists:
 *   `dailyTargetRead.resolveDisplayTarget(dateKey)` falls back to live
 *   `currentTargets` for past days that have no `daily_targets` row.
 *   When a user later changes their goal/pace, that fallback shows the
 *   NEW target against past meals — i.e. "you went over your goal" on
 *   days you didn't even have that goal.
 *
 *   The snapshot writer (`snapshotDailyTargetIfMissing`) only writes
 *   for `today`, so days the user didn't log don't have snapshots.
 *
 *   Smaller fix (this function): right BEFORE the user's goal/pace
 *   retune writes new values to `profiles`, backfill snapshots for
 *   the past `lookbackDays` using the user's CURRENT (about-to-be-old)
 *   profile values. `upsert(..., { ignoreDuplicates: true })` means
 *   genuinely-snapshotted past days are untouched — only the gaps
 *   get filled. Past days without logs now show the target that was
 *   effective on that day, not the new one.
 *
 *   Proper fix per Theme 3 (parked) is a `goal_history` table; this
 *   helper is the smaller-blast-radius mitigation that lets the
 *   common case work correctly today.
 *
 * Returns the count of synthetic rows attempted, plus whether the
 * upsert succeeded. Failures are logged + swallowed — the user's
 * profile update must not roll back because backfill couldn't write.
 */
export async function backfillDailyTargetsFromProfile(
  supabase: DailyTargetSnapshotClient,
  userId: string,
  profile: Record<string, unknown>,
  options: {
    now?: Date;
    lookbackDays?: number;
    /** ENG-1506 — host-read `energy_numbers_v1` (see
     *  `snapshotDailyTargetIfMissing`'s doc for the full contract).
     *  Default `false` = exact pre-ENG-1506 input assembly. */
    canonicalEnergyInputs?: boolean;
  } = {},
): Promise<{ attempted: number; ok: boolean }> {
  if (!userId) return { attempted: 0, ok: false };
  const targetCalories = toInt(profile.target_calories);
  if (targetCalories == null) return { attempted: 0, ok: false };

  const now = options.now ?? new Date();
  const lookbackDays = Math.max(1, options.lookbackDays ?? 30);

  // ENG-1506 — flag ON: canonical input policy (see
  // `snapshotDailyTargetIfMissing`). Callers that don't select
  // `weight_kg_by_day` fall back to the profile snapshot weight inside the
  // builder — never a fabricated default. Flag OFF: the exact pre-ENG-1506
  // assembly (frozen rows must match flag-OFF displays).
  const resolved = resolveMaintenance(
    options.canonicalEnergyInputs
      ? buildMaintenanceInputs(profile)
      : {
          sex: typeof profile.sex === "string" ? (profile.sex as "male" | "female") : null,
          weight_kg: typeof profile.weight_kg === "number" ? profile.weight_kg : null,
          height_cm: typeof profile.height_cm === "number" ? profile.height_cm : null,
          age: typeof profile.age === "number" ? profile.age : null,
          activity_level: typeof profile.activity_level === "string" ? (profile.activity_level as Parameters<typeof resolveMaintenance>[0]["activity_level"]) : null,
          adaptive_tdee: typeof profile.adaptive_tdee === "number" ? profile.adaptive_tdee : null,
          adaptive_tdee_confidence: typeof profile.adaptive_tdee_confidence === "string" ? profile.adaptive_tdee_confidence : null,
          adaptive_tdee_updated_at:
            typeof profile.adaptive_tdee_updated_at === "string"
              ? profile.adaptive_tdee_updated_at
              : null,
        },
    { now },
  );

  // Build past-day rows. Iterate from yesterday backwards so the
  // upsert's first-write-wins semantic protects today's existing
  // snapshot (today is intentionally NOT backfilled — that's the
  // job of `snapshotDailyTargetIfMissing` on the next log).
  // ENG-960 — each backfilled day records its own schedule-adjusted target so a
  // past Saturday reads as the (higher) weekend goal, not the flat number.
  const backfillSchedule = parseDayTargetSchedule(profile.calorie_schedule, profile.high_days);
  const backfillBase = {
    calories: targetCalories,
    proteinG: toInt(profile.target_protein),
    carbsG: toInt(profile.target_carbs),
    fatG: toInt(profile.target_fat),
    fiberG: toInt(profile.target_fiber_g),
  };
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const dateKey = dateKeyFromDate(d);
    const eff = effectiveTargetsForDateKey(backfillBase, backfillSchedule, dateKey);
    rows.push({
      user_id: userId,
      date_key: dateKey,
      target_calories: eff.calories,
      target_protein_g: eff.proteinG,
      target_carbs_g: eff.carbsG,
      target_fat_g: eff.fatG,
      target_fiber_g: eff.fiberG,
      activity_level: typeof profile.activity_level === "string" ? profile.activity_level : null,
      plan_pace: typeof profile.plan_pace === "string" ? profile.plan_pace : null,
      goal: typeof profile.goal === "string" ? profile.goal : null,
      maintenance_tdee: resolved?.kcal ?? toInt(profile.adaptive_tdee),
    });
  }

  const { error } = await supabase
    .from("daily_targets")
    .upsert(rows, { onConflict: "user_id,date_key", ignoreDuplicates: true });

  if (error) {
    console.warn(
      "[backfillDailyTargetsFromProfile] upsert failed — skipping",
      error.message ?? "",
    );
    return { attempted: rows.length, ok: false };
  }
  return { attempted: rows.length, ok: true };
}
