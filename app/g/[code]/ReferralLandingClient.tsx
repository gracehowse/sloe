"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { isFeatureEnabled } from "@/lib/analytics/track";
import {
  REFERRAL_FLAG,
  REFERRAL_STORAGE_KEY,
  normaliseReferralCode,
} from "@/lib/referrals/referralClient";

export function ReferralLandingClient({ code }: { code: string }) {
  const cleanCode = normaliseReferralCode(code);
  // ENG-1541 — referral_invite_loop_v1 is DEFAULT-OFF: `redeem_referral_code`
  // records a referral relationship but no entitlement-grant path exists yet
  // (needs the purchase rail — see ENG-1487). This is a public,
  // unauthenticated page, so it must not advertise "30 Pro days" — or
  // silently capture the code for a later redemption that can't pay out —
  // while the flag is off. Off → plain invite copy, no promise, no capture.
  // Re-enable alongside ENG-1487 wiring an actual grant.
  const referralEnabled = isFeatureEnabled(REFERRAL_FLAG);

  React.useEffect(() => {
    if (!referralEnabled || !cleanCode) return;
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, cleanCode);
    } catch {
      /* storage unavailable — onboarding can still read the query param */
    }
  }, [referralEnabled, cleanCode]);

  const href =
    referralEnabled && cleanCode
      ? `/onboarding?ref=${encodeURIComponent(cleanCode)}`
      : "/onboarding";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift className="h-5 w-5" aria-hidden />
        </div>
        <p className="mb-3 text-sm font-semibold text-primary">Sloe invite</p>
        {referralEnabled ? (
          <>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-foreground">
              Start with 30 Pro reward days.
            </h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Join from this invite and you both earn a 30-day Sloe Pro reward when setup is complete.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-foreground">
              You&apos;ve been invited to Sloe.
            </h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Continue to set up your account.
            </p>
          </>
        )}
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href={href}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
