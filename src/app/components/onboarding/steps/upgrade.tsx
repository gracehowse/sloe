"use client";

/**
 * ENG-1241 — skippable Pro trial decision (web).
 * Gated by `onboarding_conversion_funnel_v1` at the flow shell.
 */
import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { OptionCard } from "@/app/components/ui/option-card";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { PRICING_TIERS } from "@/lib/landing/pricingTiers";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const proTier = PRICING_TIERS.find((t) => t.name === "Pro");

export function UpgradeStep() {
  const { state, set, go } = useOnboarding();
  const overline = useStepOverline();
  const annualPrice = proTier?.annualPrice ?? proTier?.price ?? "—";

  const chooseFree = React.useCallback(() => {
    set({ trialChoice: "free" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "free",
      platform: "web",
    });
    go(1);
  }, [set, go]);

  const chooseTrial = React.useCallback(() => {
    set({ trialChoice: "trial" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "trial",
      platform: "web",
    });
  }, [set]);

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Start with everything on"
        subtitle="Try Sloe Pro free for 7 days — barcode scanning, custom macros, and coaching. Cancel anytime."
      />

      <OptionCard
        selected={state.trialChoice === "trial"}
        onClick={chooseTrial}
        title="7-day free trial"
        subtitle={`Then ${annualPrice}${proTier?.annualPeriod ?? "/year"} — region pricing at checkout`}
        icon={<Sparkles className="size-5" />}
      />

      <div className="mt-4 flex flex-col gap-3">
        {state.trialChoice === "trial" ? (
          <Button asChild size="lg" className="h-12 rounded-full font-bold">
            <Link href="/pricing?from=onboarding" onClick={chooseTrial}>
              Start free trial
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 rounded-full font-semibold"
          onClick={chooseFree}
        >
          Continue on Free
        </Button>
      </div>
    </StepBody>
  );
}
