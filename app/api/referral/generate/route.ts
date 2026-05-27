/**
 * GET /api/referral/generate
 *
 * Idempotent: returns the authenticated user's referral code, creating one
 * if it doesn't exist yet. Enforces a 7-day account-age requirement to
 * prevent throwaway accounts from farming referral credits.
 *
 * Response:
 *   200 { ok: true, code: string, shareUrl: string, created: boolean }
 *   401 { ok: false, error: "unauthorized" }
 *   403 { ok: false, error: "account_too_new", minAgeDays: 7 }
 *   503 { ok: false, error: string }
 */

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { createOrGetReferralCode } from "@/lib/referral/referralLib";
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
    const result = await createOrGetReferralCode(userId);

    if (!result.ok) {
      if (result.reason === "account_too_new") {
        return NextResponse.json(
          { ok: false, error: "account_too_new", minAgeDays: 7 },
          { status: 403 },
        );
      }
      if (result.reason === "service_role_missing") {
        return NextResponse.json(
          { ok: false, error: "service_unavailable" },
          { status: 503 },
        );
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
      created: result.created,
    });
  } catch (err) {
    captureRouteError(err, "referral/generate");
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
