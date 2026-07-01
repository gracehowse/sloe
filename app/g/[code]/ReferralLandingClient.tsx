"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { REFERRAL_STORAGE_KEY, normaliseReferralCode } from "@/lib/referrals/referralClient";

export function ReferralLandingClient({ code }: { code: string }) {
  const cleanCode = normaliseReferralCode(code);

  React.useEffect(() => {
    if (!cleanCode) return;
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, cleanCode);
    } catch {
      /* storage unavailable — onboarding can still read the query param */
    }
  }, [cleanCode]);

  const href = cleanCode
    ? `/onboarding?ref=${encodeURIComponent(cleanCode)}`
    : "/onboarding";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift className="h-5 w-5" aria-hidden />
        </div>
        <p className="mb-3 text-sm font-semibold text-primary">Sloe invite</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-normal text-foreground">
          Start with 30 Pro reward days.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Join from this invite and you both earn a 30-day Sloe Pro reward when setup is complete.
        </p>
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
