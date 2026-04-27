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
  opts?: { now?: Date },
): Promise<boolean> {
  if (!userId) return false;

  const today = dateKeyFromDate(opts?.now ?? new Date());

  // Read the user's *current* targets + plan state. These are the values
  // we freeze for this day — later profile edits must not rewrite them.
  // `adaptive_tdee` is the best proxy we have for "maintenance TDEE" —
  // when a user has enough data we trust the adaptive number, otherwise
  // the formula estimate is recomputable from the frozen activity_level
  // plus the user's static basics.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, activity_level, plan_pace, goal, adaptive_tdee",
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

  const row = {
    user_id: userId,
    date_key: today,
    target_calories: targetCalories,
    target_protein_g: toInt(profile.target_protein),
    target_carbs_g: toInt(profile.target_carbs),
    target_fat_g: toInt(profile.target_fat),
    target_fiber_g: toInt(profile.target_fiber_g),
    activity_level: typeof profile.activity_level === "string" ? profile.activity_level : null,
    plan_pace: typeof profile.plan_pace === "string" ? profile.plan_pace : null,
    goal: typeof profile.goal === "string" ? profile.goal : null,
    maintenance_tdee: toInt(profile.adaptive_tdee),
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
