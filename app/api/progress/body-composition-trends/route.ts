import { NextResponse } from "next/server";

import { buildBodyCompositionTrendCopy } from "@/lib/progress/bodyCompositionTrends";
import {
  createSupabaseServiceRoleClient,
  getUserIdFromRequest,
  getUserTier,
} from "@/lib/supabase/serverAnonClient";

function parseNumMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * ENG-1237 — Pro-gated body-composition trends. Free/Base callers get 403 so
 * historical `body_fat_pct_by_day` is not an advisory-only gate.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  if (tier !== "pro") {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const sb = createSupabaseServiceRoleClient();
  if (!sb) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const { data, error } = await sb
    .from("profiles")
    .select("body_fat_pct, body_fat_pct_by_day, weight_kg_by_day")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trends = buildBodyCompositionTrendCopy({
    bodyFatPctByDay: parseNumMap(data?.body_fat_pct_by_day),
    weightKgByDay: parseNumMap(data?.weight_kg_by_day),
    bodyFatPctLatest:
      data?.body_fat_pct != null ? Number(data.body_fat_pct) : null,
  });

  return NextResponse.json({ trends, tier });
}
