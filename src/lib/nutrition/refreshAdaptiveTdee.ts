import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAdaptiveTDEE } from "./adaptiveTdee";
import { calculateBMR, ACTIVITY_MULTIPLIERS, type Sex } from "./tdee";

const THROTTLE_MS = 6 * 60 * 60 * 1000;

function parseWeightKgByDay(json: unknown): Record<string, number> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Median of the positive HealthKit basal (resting) energy values in
 * `profiles.basal_burn_by_day`, or null when there isn't enough signal.
 * This is the R3 resting-energy floor — the survey's "the Watch's *resting*
 * energy is a better lower-bound source than its active energy" — and it is
 * formula-grade (Apple derives resting energy from a Mifflin/Harris-Benedict
 * formula), so it is a legitimate hard lower bound. Requires ≥3 days so a
 * single noisy reading can't set the floor.
 */
function restingEnergyFloorFromBasal(json: unknown): number | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const vals: number[] = [];
  for (const v of Object.values(json as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) vals.push(n);
  }
  if (vals.length < 3) return null;
  vals.sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 === 0
    ? Math.round((vals[mid - 1] + vals[mid]) / 2)
    : Math.round(vals[mid]);
}

/**
 * Recompute adaptive TDEE from `nutrition_entries` + `profiles.weight_kg_by_day`, persist when confidence is medium/high.
 * Throttled (default 6h) to limit reads/writes. Safe to fire-and-forget after journal or weight changes.
 *
 * ONE-TIME REFRESH of a stale value (e.g. Grace's `adaptive_tdee = 1314`
 * written by the OLD gate-less logic): this is the ONLY writer of the
 * `adaptive_tdee*` columns. It refreshes on the next journal/weight write on
 * app open; for an immediate refresh call it with `{ bypassThrottle: true }`
 * (the authed `POST /api/nutrition/adaptive-tdee` route does exactly this).
 * Never set the column by direct SQL — the tier-lockdown trigger rejects
 * client writes and a manual value bypasses the confidence gate. See
 * `docs/decisions/2026-06-10-adaptive-tdee-gating.md` § "one-time refresh".
 *
 * Feeds `computeAdaptiveTDEE` the body-stat-derived guards added 2026-06-10
 * (`docs/decisions/2026-06-10-adaptive-tdee-gating.md`):
 *   - `bmrKcal`          → R1 completeness floor `max(1000, 0.8 × BMR)`
 *   - `sedentaryTdeeKcal`→ R3 plausibility band [0.85, 1.30] × sedentary
 *   - `entryCountByDay`  → R1 ≥2-entries requirement (a single large entry
 *     is not, on its own, a full day of eating)
 * BMR + the sedentary multiplier are read from profile body stats; both
 * arms degrade gracefully (`computeAdaptiveTDEE` falls back to the flat
 * 1000-kcal floor / skips the band when a stat is missing).
 */
export async function refreshAdaptiveTdeeForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { bypassThrottle?: boolean },
): Promise<void> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "adaptive_tdee_updated_at, weight_kg_by_day, sex, weight_kg, height_cm, age, basal_burn_by_day",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return;

  const updatedAt = profile.adaptive_tdee_updated_at as string | null | undefined;
  if (!options?.bypassThrottle && updatedAt) {
    const t = new Date(updatedAt).getTime();
    if (Number.isFinite(t) && Date.now() - t < THROTTLE_MS) return;
  }

  const weightByDay = parseWeightKgByDay(profile.weight_kg_by_day);
  if (Object.keys(weightByDay).length < 3) return;

  const { data: entries, error: entriesError } = await supabase
    .from("nutrition_entries")
    .select("date_key, calories")
    .eq("user_id", userId);

  if (entriesError || !entries?.length) return;

  const intakeByDay: Record<string, number> = {};
  const entryCountByDay: Record<string, number> = {};
  for (const row of entries as { date_key: string; calories: number | null }[]) {
    const k = row.date_key;
    const c = row.calories ?? 0;
    if (!k || c <= 0) continue;
    intakeByDay[k] = (intakeByDay[k] ?? 0) + c;
    entryCountByDay[k] = (entryCountByDay[k] ?? 0) + 1;
  }

  // Body-stat guards for the completeness gate (R1) + plausibility band (R3).
  // Both are optional inside `computeAdaptiveTDEE`; we pass them when the
  // stats are present so the gate scales to the person and the band can fire.
  const weightKg = num(profile.weight_kg);
  const heightCm = num(profile.height_cm);
  const age = num(profile.age);
  const sex = (profile.sex as Sex) ?? "unspecified";
  let bmrKcal: number | null = null;
  let sedentaryTdeeKcal: number | null = null;
  if (weightKg != null && heightCm != null && age != null && weightKg > 0 && heightCm > 0 && age > 0) {
    bmrKcal = calculateBMR(sex, weightKg, heightCm, age);
    sedentaryTdeeKcal = Math.round(bmrKcal * ACTIVITY_MULTIPLIERS.sedentary);
  }

  const restingEnergyFloorKcal = restingEnergyFloorFromBasal(
    profile.basal_burn_by_day,
  );

  const computed = computeAdaptiveTDEE({
    intakeByDay,
    weightByDay,
    entryCountByDay,
    bmrKcal,
    sedentaryTdeeKcal,
    restingEnergyFloorKcal,
  });
  if (!computed) return;

  if (computed.confidence !== "medium" && computed.confidence !== "high") return;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      adaptive_tdee: computed.tdee,
      adaptive_tdee_confidence: computed.confidence,
      adaptive_tdee_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError && process.env.NODE_ENV === "development") {
    console.warn("[refreshAdaptiveTdeeForUser] update failed:", updateError.message);
  }
}
