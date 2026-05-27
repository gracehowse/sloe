/**
 * GET /api/referral/status
 *
 * Returns the authenticated user's referral stats: their code, how many
 * friends have redeemed it, how many reward days have been credited, and
 * how many credits are still pending (waiting for ENG-198 Pro grant).
 *
 * Response:
 *   200 { ok: true, code, shareUrl, totalRedeemed, totalRewardDaysGranted, pendingCredits }
 *   200 { ok: false, error: "not_found" }   — user has no code yet (never shared)
 *   401 { ok: false, error: "unauthorized" }
 *   503 { ok: false, error: "service_unavailable" }
 */

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { getReferralStatus } from "@/lib/referral/referralLib";
import { captureRouteError } from "@/lib/observability/captureRouteError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shareUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://suppr.app").replace(/\/$/, "");
  return `${base}/i/${code}`;
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await getReferralStatus(userId);

    if (!result.ok) {
      if (result.reason === "service_role_missing") {
        return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
      }
      if (result.reason === "not_found") {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 200 });
      }
      return NextResponse.json(
        { ok: false, error: result.reason, detail: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      code: result.code,
      shareUrl: shareUrl(result.code),
      totalRedeemed: result.totalRedeemed,
      totalRewardDaysGranted: result.totalRewardDaysGranted,
      pendingCredits: result.pendingCredits,
    });
  } catch (err) {
    captureRouteError(err, "referral/status");
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
