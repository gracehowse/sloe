"use client";

import { useState } from "react";
import { computeAnnualSavingsBadge, type PricingTier } from "../../src/lib/landing/content.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { CheckoutButton } from "./CheckoutButton.tsx";

/**
 * PricingHeroCta — the ENG-1460 conversion pair: a compact annual/monthly
 * selector + ONE filled CTA ("Start free trial" on annual — the only SKU
 * carrying a trial — "Subscribe" on monthly, ENG-1511), rendered directly under
 * the `/pricing` hero so a visitor meets a real price and a real button
 * inside the first viewport (desktop AND mobile-web), instead of five
 * sections of feature restatement first.
 *
 * DECIDED (Fable, 2026-07-07, per Grace's delegation) — part 1 of ENG-1460
 * was never in question, just unbuilt. Surfaces the SAME `PRICING_TIERS`
 * SSOT the tier grid below reads (no new numbers, no new claims — the
 * honesty-note character of the page is unchanged, this just moves an
 * existing price + CTA earlier).
 *
 * "One filled CTA per screen": this hero CTA is the ONE filled action;
 * the tier-card CTAs below stay visually calmer (outline/ghost) so they
 * don't compete — see the `highlighted` prop threading in `PricingTiersGrid`.
 *
 * Own local billing-period state, not lifted from `PricingTiersGrid` — the
 * two selectors are independent affordances for the same underlying toggle
 * (same pattern as a landing page's hero CTA vs. its pricing section
 * further down); keeping them independent means neither has to reach into
 * the other's client-component tree, and the price shown here always
 * matches what `CheckoutButton` will actually charge for the same period.
 *
 * Self-gated behind `pricing_conversion_pair_v1` (default-ON): the flag
 * check happens INSIDE this client component (not in the server `page.tsx`
 * that renders it — `track.ts` is "use client" and cannot be invoked from
 * a server component). Off → renders nothing (kill switch; the tier grid
 * below still has its own CTAs).
 */
export function PricingHeroCta({
  proTier,
  paywallFrom,
  regionCurrency = "GBP",
}: {
  proTier: PricingTier;
  paywallFrom: PaywallViewedFrom;
  regionCurrency?: "GBP" | "EUR" | "USD";
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const conversionPairEnabled = isFeatureEnabled("pricing_conversion_pair_v1");
  const isAnnual = billing === "annual";
  const price = isAnnual && proTier.annualPrice ? proTier.annualPrice : proTier.price;
  const period = isAnnual && proTier.annualPrice ? proTier.annualPeriod ?? "" : proTier.period;
  const annualBadge = computeAnnualSavingsBadge(proTier);

  function onPeriodChange(next: "monthly" | "annual") {
    if (next === billing) return;
    track(AnalyticsEvents.paywall_period_changed, {
      from: paywallFrom,
      fromPeriod: billing,
      toPeriod: next,
      surface: "web_pricing_hero",
      platform: "web",
    });
    setBilling(next);
  }

  if (!conversionPairEnabled) return null;

  return (
    <div
      data-testid="pricing-hero-cta"
      className="mx-auto mb-10 max-w-sm rounded-2xl border border-border bg-card px-5 py-5 shadow-sm"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          role="tablist"
          aria-label="Billing period"
          className="inline-flex items-center p-1 rounded-full border border-border"
          style={{ background: "var(--background-secondary)" }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={billing === "monthly"}
            onClick={() => onPeriodChange("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              billing === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billing === "annual"}
            onClick={() => onPeriodChange("annual")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
              billing === "annual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            {annualBadge ? (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-success-soft)",
                  color: "var(--accent-success-solid)",
                }}
              >
                {annualBadge}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand">
            {price}
          </span>
          <span className="text-sm text-muted-foreground">{period}</span>
        </div>

        <div className="w-full">
          {/* ENG-1436 legal P0: only annual carries the 7-day trial (ENG-1285),
              so a static "Start free trial" on the monthly selection was a
              false trial claim (CMA/FTC). Label tracks the period, like the
              caption below. */}
          <CheckoutButton
            tier="pro"
            period={billing}
            currency={regionCurrency}
            // ENG-1511 — the 7-day trial exists on the ANNUAL SKU only
            // (`/api/stripe/checkout` adds `trial_period_days` for annual
            // alone), so the label tracks the selected period exactly like
            // the caption below and the mobile paywall CTA ("Start free
            // 7-day trial" vs "Subscribe — …", apps/mobile/app/paywall.tsx).
            label={isAnnual ? "Start free trial" : "Subscribe"}
            highlighted
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {/* Honesty-note character: only annual carries the 7-day trial
              (matches `BillingDisclosure`'s leadClause below) — the caption
              must track the selected period, not imply monthly has one too. */}
          {isAnnual
            ? "7-day free trial · cancel anytime"
            : "Charged today · cancel anytime"}
        </p>
      </div>
    </div>
  );
}

export default PricingHeroCta;
