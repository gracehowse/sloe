"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Gift, Sparkles, Check } from "lucide-react";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

type Props = { code: string | null; valid: boolean };

export function ReferralLanding({ code, valid }: Props) {
  // Fire install_attributed event once when the page loads.
  // referrerId is unknown at landing time (we only know the code);
  // the full attribution fires from the redeem route after signup.
  useEffect(() => {
    if (valid && code) {
      track(AnalyticsEvents.referral_install_attributed, { referralCode: code });
    }
  }, [code, valid]);

  const signupHref = code ? `/signup?ref=${code}` : "/signup";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] px-6 py-16 text-white">
      {/* Icon */}
      <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-3xl bg-[#7C3AED]/20">
        <Gift className="text-[#7C3AED]" size={40} strokeWidth={1.5} />
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-bold text-center leading-tight mb-3">
        Your friend invited you to Suppr
      </h1>
      <p className="text-base text-white/60 text-center mb-10 max-w-sm">
        Sign up today and you'll both get <span className="text-white font-semibold">1&nbsp;month of Pro free</span> — no&nbsp;credit card required.
      </p>

      {/* Perks */}
      <div className="w-full max-w-xs space-y-3 mb-10">
        {[
          "AI photo & voice food logging",
          "Unlimited recipe imports",
          "Multi-day meal plans",
        ].map((perk) => (
          <div key={perk} className="flex items-center gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
              <Check size={12} className="text-[#7C3AED]" strokeWidth={2.5} />
            </span>
            <span className="text-sm text-white/80">{perk}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href={signupHref}
        className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#7C3AED] text-white font-semibold text-[15px] hover:bg-[#6D28D9] transition-colors"
      >
        <Sparkles size={16} strokeWidth={2} />
        Claim your free month
      </Link>

      {valid ? null : (
        code ? (
          <p className="mt-4 text-xs text-white/40 text-center">
            This invite link may have expired or already been redeemed — you can still sign up for free.
          </p>
        ) : null
      )}

      <p className="mt-6 text-xs text-white/30 text-center">
        Free month applied after you complete setup. No card needed.
      </p>
    </main>
  );
}
