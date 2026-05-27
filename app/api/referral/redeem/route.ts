/**
 * POST /api/referral/redeem
 *
 * Called after a new user completes onboarding and had a referral code
 * stored (from the `/i/[code]` landing page via cookie or from the
 * onboarding code-entry field). Idempotent — calling twice for the same
 * referee is a no-op (returns already_redeemed).
 *
 * Body: { code: string }
 *
 * Response:
 *   200 { ok: true, referrerId, referrerDays, refereeDays }
 *   400 { ok: false, error: "missing_code" }
 *   401 { ok: false, error: "unauthorized" }
 *   404 { ok: false, error: "code_not_found" }
 *   409 { ok: false, error: "already_redeemed" | "self_referral" | "code_flagged" | "referrer_cap_reached" }
 *   503 { ok: false, error: "service_unavailable" }
 *
 * NOTE: Pro reward (referral_credits.reward_granted_at) stays NULL until
 * ENG-198 (RevenueCat provisioning). The row is created immediately so
 * no referral is lost.
 */

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { redeemReferralCode } from "@/lib/referral/referralLib";
import { captureRouteError } from "@/lib/observability/captureRouteError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const code = typeof body === "object" && body !== null ? (body as Record<string, unknown>).code : undefined;
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  try {
    const result = await redeemReferralCode(code.trim(), userId);

    if (!result.ok) {
      if (result.reason === "service_role_missing") {
        return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
      }
      if (result.reason === "code_not_found") {
        return NextResponse.json({ ok: false, error: "code_not_found" }, { status: 404 });
      }
      // conflict-class errors
      return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      referrerId: result.referrerId,
      referrerDays: result.referrerDays,
      refereeDays: result.refereeDays,
    });
  } catch (err) {
    captureRouteError(err, "referral/redeem");
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
