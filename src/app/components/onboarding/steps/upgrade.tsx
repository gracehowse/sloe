"use client";

/**
 * ENG-1241 — optional, skippable "See Pro" trial decision (web).
 * TERMINAL step of the conversion funnel (first-log → upgrade). Gated by
 * `onboarding_conversion_funnel_v1` at the flow shell.
 *
 * Two affordances only (legal C4 — skip must be an unambiguous,
 * first-viewport, neutrally-labelled control, never disabled-styled or
 * scroll-gated):
 *   - "Start free trial" (primary) → opens `UpgradePaywallDialog`
 *     in-place (NOT a route to the heavier /pricing — the user is already
 *     signed up). The dialog carries the full CMA auto-renew disclosure +
 *     VAT gate + trust strip (legal C1/C8) and defaults to the ANNUAL
 *     (trial-eligible) period so the trial is what's offered (Decision 4 /
 *     legal C2 — "trial" wording only when the trial SKU is selected).
 *     Its checkout hits `/api/stripe/checkout` with `period: "annual"`,
 *     which the route turns into a real 7-day `trial_period_days` (ENG-1285).
 *   - "Continue on Free" (skip) → runs the terminal completion path
 *     (`complete()`) so the user lands straight on Today with no detour
 *     (Decision 2 / legal C4).
 *
 * No confirmshaming, no urgency timer, no pre-ticked trial (legal C5).
 * Analytics honesty (legal C10): `UpgradePaywallDialog` emits
 * `paywall_viewed` + `paywall_dismissed` with `from: "onboarding"` on
 * open/close, and this step emits `onboarding_trial_choice` for the
 * trial-vs-free decision so skip-rate is measurable.
 */
import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { UpgradePaywallDialog } from "@/app/components/suppr/upgrade-paywall-dialog";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { PRICING_TIERS } from "@/lib/landing/pricingTiers";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const proTier = PRICING_TIERS.find((t) => t.name === "Pro");

export function UpgradeStep() {
  const { set, complete } = useOnboarding();
  const overline = useStepOverline();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const annualPrice = proTier?.annualPrice ?? proTier?.price ?? "—";

  React.useEffect(() => {
    track(AnalyticsEvents.onboarding_upgrade_step_viewed, { platform: "web" });
  }, []);

  const chooseFree = React.useCallback(() => {
    set({ trialChoice: "free" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "free",
      platform: "web",
    });
    // Decision 2 — skip lands straight on Today via the terminal
    // completion path. No detour through /pricing or any other screen.
    complete();
  }, [set, complete]);

  const chooseTrial = React.useCallback(() => {
    set({ trialChoice: "trial" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "trial",
      platform: "web",
    });
    // Open the compliant upgrade dialog in-place (defaults to annual —
    // see `defaultPeriod` — so the trial is the offer). The dialog owns
    // the disclosure + checkout; it emits paywall_viewed on open.
    setDialogOpen(true);
  }, [set]);

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Start your 7-day free trial"
        subtitle="Try Sloe Pro free for 7 days — unlimited saved recipes, multi-day macro-matched meal plans, and AI photo & voice logging. Cancel anytime. No payment due now."
      />

      {/* Static price callout (ENG-1516) — deliberately NON-interactive.
          It was a selectable option card whose click toggled a `trialChoice`
          selected-highlight that nothing consumed (dead affordance —
          same pattern as the mobile twin, fixed on both). The step keeps
          exactly two affordances: the buttons below (legal C4). Layout
          mirrors the card's resting render so nothing visually shifts,
          minus the radio/hover/press signifiers that implied a choice. */}
      <div className="flex items-center gap-3.5 rounded-card border border-border bg-card p-4">
        <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground tracking-tight leading-snug text-[15px]">
            7-day free trial
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {`Then ${annualPrice}${proTier?.annualPeriod ?? "/year"} — first charge on Day 7. Region pricing at checkout.`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 rounded-full font-bold"
          onClick={chooseTrial}
        >
          Start free trial
        </Button>
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

      {/* The dialog carries the binding disclosure + Stripe checkout.
          `from="onboarding"` attributes the funnel; `defaultPeriod="annual"`
          preselects the trial-eligible SKU (Decision 4). `bypassSessionCap`
          because this is an explicit intent tap. */}
      <UpgradePaywallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        from="onboarding"
        userTier="free"
        bypassSessionCap
        defaultPeriod="annual"
      />
    </StepBody>
  );
}
