import { NextResponse } from "next/server";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { refreshAdaptiveTdeeForUser } from "@/lib/nutrition/refreshAdaptiveTdee";
import {
  calculateTDEE,
  getEffectiveTDEE,
  type Sex,
  type ActivityLevel,
} from "@/lib/nutrition/tdee";

/**
 * GET /api/nutrition/adaptive-tdee
 *
 * Returns the user's current TDEE information:
 * - Static TDEE from Mifflin-St Jeor
 * - Adaptive TDEE from energy balance (if available)
 * - Which is currently active
 * - Confidence level + data requirements
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("sex, weight_kg, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, weight_kg_by_day")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });
  }

  const sex = (profile.sex as Sex) ?? "unspecified";
  const weightKg = Number(profile.weight_kg) || 70;
  const heightCm = Number(profile.height_cm) || 170;
  const age = Number(profile.age) || 30;
  const activityLevel = (profile.activity_level as ActivityLevel) ?? "moderate";

  const staticTdee = calculateTDEE(sex, weightKg, heightCm, age, activityLevel);
  const effective = getEffectiveTDEE({
    adaptive_tdee: profile.adaptive_tdee as number | null,
    adaptive_tdee_confidence: profile.adaptive_tdee_confidence as string | null,
    sex,
    weight_kg: weightKg,
    height_cm: heightCm,
    age,
    activity_level: activityLevel,
  });

  // Count logging days and weigh-ins for data requirements display
  const { count: loggingDays } = await supabase
    .from("nutrition_entries")
    .select("date_key", { count: "exact", head: true })
    .eq("user_id", userId);

  const weightByDay = profile.weight_kg_by_day as Record<string, unknown> | null;
  const weighInCount = weightByDay ? Object.keys(weightByDay).length : 0;

  return NextResponse.json({
    ok: true,
    staticTdee,
    adaptiveTdee: profile.adaptive_tdee as number | null,
    adaptiveConfidence: (profile.adaptive_tdee_confidence as string) ?? null,
    adaptiveUpdatedAt: (profile.adaptive_tdee_updated_at as string) ?? null,
    effectiveTdee: effective.tdee,
    isAdaptive: effective.isAdaptive,
    dataStatus: {
      loggingDays: loggingDays ?? 0,
      weighInCount,
      minLoggingDays: 7,
      minWeighIns: 3,
      mediumConfidenceLoggingDays: 14,
      mediumConfidenceWeighIns: 5,
      highConfidenceLoggingDays: 21,
      highConfidenceWeighIns: 7,
    },
  });
}

/**
 * POST /api/nutrition/adaptive-tdee
 *
 * Force a recalculation of the adaptive TDEE.
 */
export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  await refreshAdaptiveTdeeForUser(supabase, userId, { bypassThrottle: true });

  // Return updated values
  const { data: profile } = await supabase
    .from("profiles")
    .select("adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, weight_kg, height_cm, age, activity_level")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });
  }

  const effective = getEffectiveTDEE({
    adaptive_tdee: profile.adaptive_tdee as number | null,
    adaptive_tdee_confidence: profile.adaptive_tdee_confidence as string | null,
    sex: (profile.sex as Sex) ?? "unspecified",
    weight_kg: Number(profile.weight_kg) || 70,
    height_cm: Number(profile.height_cm) || 170,
    age: Number(profile.age) || 30,
    // Default to sedentary (1.2) when missing — "moderate" (1.55) silently
    // over-inflated TDEE by ~14% (TestFlight `AIIm60nKi_sTu3-4YjR-WR4`).
    activity_level: (profile.activity_level as ActivityLevel) ?? "sedentary",
  });

  return NextResponse.json({
    ok: true,
    adaptiveTdee: profile.adaptive_tdee as number | null,
    adaptiveConfidence: (profile.adaptive_tdee_confidence as string) ?? null,
    effectiveTdee: effective.tdee,
    isAdaptive: effective.isAdaptive,
  });
}
