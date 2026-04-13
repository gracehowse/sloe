import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAdaptiveTDEE } from "./adaptiveTdee.ts";

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

/**
 * Recompute adaptive TDEE from `nutrition_entries` + `profiles.weight_kg_by_day`, persist when confidence is medium/high.
 * Throttled (default 6h) to limit reads/writes. Safe to fire-and-forget after journal or weight changes.
 */
export async function refreshAdaptiveTdeeForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { bypassThrottle?: boolean },
): Promise<void> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("adaptive_tdee_updated_at, weight_kg_by_day")
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
  for (const row of entries as { date_key: string; calories: number | null }[]) {
    const k = row.date_key;
    const c = row.calories ?? 0;
    if (!k || c <= 0) continue;
    intakeByDay[k] = (intakeByDay[k] ?? 0) + c;
  }

  const computed = computeAdaptiveTDEE({ intakeByDay, weightByDay });
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
