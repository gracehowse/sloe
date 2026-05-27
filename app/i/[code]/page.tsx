/**
 * /i/[code] — Referral landing page (ENG-5).
 *
 * When a user arrives via a friend's share link:
 *   1. We verify the code exists (server-side) and store it in a cookie
 *      so it survives through the signup flow.
 *   2. We render a landing page explaining the "both get 1 month Pro"
 *      mechanic.
 *   3. The CTA takes the user to /signup (or /home if already signed in).
 *
 * Cookie `suppr_ref=<code>` is httpOnly=false (client-readable) with a
 * 30-day expiry so the web-flow's `ReferralRedeemer` component can
 * consume it post-onboarding and call POST /api/referral/redeem.
 * If the code is invalid we still render the page — the /signup path
 * will simply not find the code to redeem (graceful degradation).
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ReferralLanding } from "./ReferralLanding";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";

export const metadata: Metadata = {
  title: "You've been invited to Suppr — get 1 month Pro free",
  description:
    "A friend invited you to Suppr. Sign up today and you'll both get 1 month of Pro free.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ code: string }> };

async function isValidCode(code: string): Promise<boolean> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return false;
  const { data } = await sb
    .from("referrals")
    .select("code, flagged_at")
    .eq("code", code)
    .maybeSingle();
  return data !== null && data.flagged_at === null;
}

export default async function ReferralPage({ params }: Props) {
  const { code } = await params;
  const safeCode = /^[A-Za-z0-9]{4,16}$/.test(code) ? code : null;

  // Store in cookie so ReferralRedeemer can consume it post-onboarding.
  // We set it regardless of validity so a mistyped link doesn't confuse
  // the user — the redeem API will fail gracefully.
  if (safeCode) {
    const cookieStore = await cookies();
    cookieStore.set("suppr_ref", safeCode, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // client-readable for ReferralRedeemer
    });
  }

  const valid = safeCode ? await isValidCode(safeCode) : false;

  return <ReferralLanding code={safeCode} valid={valid} />;
}
