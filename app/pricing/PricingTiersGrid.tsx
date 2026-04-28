"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { BillingPeriod, PricingTier } from "../../src/lib/landing/content.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { track } from "../../src/lib/analytics/track.ts";
import { CurrentTierBadge } from "./CurrentTierBadge.tsx";
import { CheckoutButton } from "./CheckoutButton.tsx";

type Tier = PricingTier & {
  /** CTA label computed by the server from `checkoutTier`. */
  cta: string;
  /** First line above the feature list, with ", plus" stripped for the
   *  /pricing rendering style. */
  featHeadStripped?: string;
};

/**
 * Parse a currency-prefixed price string (e.g. "£29.99", "$7.99") into
 * `{ symbol, amount }`. Returns `null` if the shape doesn't match, so
 * callers can bail out quietly rather than rendering a broken ref-price.
 */
function parseCurrencyString(s: string): { symbol: string; amount: number } | null {
  const m = s.match(/^([^\d\-.,]+)\s*([\d.,]+)/);
  if (!m) return null;
  const symbol = m[1].trim();
  const amount = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return { symbol, amount };
}

/**
 * Build the reference-price line for annual plans, per L1 (2026-04-21):
 * "Save 37%" needs a visible reference so the saving claim is
 * substantiated. Returns e.g. "£2.50/mo · save 37% vs £3.99/mo" or
 * `null` if the tier doesn't have the inputs to compute it.
 */
function computeAnnualReferenceLine(tier: PricingTier): string | null {
  if (!tier.annualPrice) return null;
  const annual = parseCurrencyString(tier.annualPrice);
  const monthlyRef = parseCurrencyString(tier.price);
  if (!annual || !monthlyRef) return null;
  const effectiveMonthly = annual.amount / 12;
  const savingsPct = Math.round(
    (1 - annual.amount / (monthlyRef.amount * 12)) * 100,
  );
  const fmt = (n: number) => `${annual.symbol}${n.toFixed(2)}`;
  return `${fmt(effectiveMonthly)}/mo · save ${savingsPct}% vs ${fmt(monthlyRef.amount)}/mo`;
}

/**
 * Client-side tier grid owning the monthly ↔ annual toggle state.
 *
 * Price, period, and the billing-renewal disclosure all read from the
 * shared SSOT so every on-screen string stays pinned to
 * `PRICING_TIERS` in `src/lib/landing/content.ts`. The prior page
 * implementation hardcoded the disclosure strings with the old USD
 * numbers, which made the disclosure silently drift the moment
 * pricing moved to GBP — pinning is enforced by the landing parity
 * test.
 */
export function PricingTiersGrid({
  tiers,
  /**
   * `stripeTaxEnabled` is read from `process.env.STRIPE_TAX_ENABLED` on
   * the server and passed in here so the client disclosure copy stays
   * in lockstep with the Stripe Checkout route's `automatic_tax`
   * behaviour (round-6, 2026-04-19).
   *
   *   - Flag OFF → render the pre-round-4 tax-EXCLUSIVE line
   *     (`"Price excludes any applicable taxes."`). This matches the
   *     route's behaviour while Stripe Tax is not yet active in the
   *     dashboard — `automatic_tax` is not passed to Checkout, so the
   *     price the user pays is the sticker price, and the copy must say
   *     so to stay truthful.
   *   - Flag ON  → render the round-4 tax-INCLUSIVE VAT line
   *     (`"Price includes any applicable VAT."`). At that point the
   *     route also passes `automatic_tax: { enabled: true }` and Stripe
   *     surfaces the VAT breakdown in Checkout.
   */
  stripeTaxEnabled = false,
  paywallFrom,
  regionVatNote = "",
  regionCurrency = "GBP",
  regionNote = "",
}: {
  tiers: Tier[];
  stripeTaxEnabled?: boolean;
  /** Canonical `from` surface propagated from the server page so
   *  `paywall_period_changed` carries the originating surface in
   *  its payload (analytics-engineer 2026-04-19 — parity with
   *  `paywall_viewed.from`). Defaults to `"deep_link"` when the
   *  server could not resolve a specific surface. */
  paywallFrom: PaywallViewedFrom;
  /** H7 (2026-04-21) — inline VAT disclosure for UK / EU visitors
   *  ("Prices include VAT"). Empty string suppresses the line for
   *  default / US-ish surfaces. Kept alongside the Stripe-flag-driven
   *  tax clause in `BillingDisclosure` so the UK/EU surface gets the
   *  inclusive-VAT note even when `STRIPE_TAX_ENABLED=false`. */
  regionVatNote?: string;
  /** H7 — detected display currency. GBP today everywhere; EUR tag is
   *  propagated for future EUR-SKU work but does NOT change the
   *  rendered amounts (see `regionNote` for the explainer shown to EU
   *  visitors in v1). */
  regionCurrency?: "GBP" | "EUR" | "USD";
  /** H7 — one-line region-specific banner above the tier grid (e.g.
   *  "EU pricing coming soon — current prices in GBP"). Empty string
   *  hides the banner. */
  regionNote?: string;
}) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  // Phase 5 / B1.3 (D-2026-04-27-05) — pricing collapses to Free + Pro.
  // We filter the Base tier out of the rendered grid here. The
  // PRICING_TIERS SSOT in src/lib/landing/pricingTiers.ts still carries
  // Base for grandfathered subscribers + Stripe / RevenueCat
  // entitlement compatibility. Stripe + RevenueCat reconfig is a
  // separate monetisation-architect deliverable (gated on the Base
  // migration path call); this UI change ships independently per
  // Phase 5 sequencing.
  const visibleTiers = tiers.filter((t) => t.name !== "Base");

  function onPeriodCommit(next: BillingPeriod) {
    if (next === billing) return;
    // `paywall_period_changed` fires on committed toggle flips only
    // (no-op early-return above). Mirrors the mobile paywall emit so
    // annual-adoption slices read identically across platforms.
    track(AnalyticsEvents.paywall_period_changed, {
      from: paywallFrom,
      fromPeriod: billing,
      toPeriod: next,
      surface: "web_pricing",
      platform: "web",
    });
    setBilling(next);
  }

  return (
    <>
      {regionNote ? (
        <div
          data-testid="pricing-region-note"
          className="mb-6 mx-auto max-w-xl text-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2"
        >
          {regionNote}
        </div>
      ) : null}
      <BillingToggle billing={billing} onChange={onPeriodCommit} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto">
        {visibleTiers.map((tier) => {
          const isAnnual = billing === "annual";
          const showAnnual = isAnnual && Boolean(tier.annualPrice);
          const price = showAnnual ? tier.annualPrice! : tier.price;
          const period = showAnnual ? tier.annualPeriod ?? "" : tier.period;

          return (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                tier.highlighted
                  ? "bg-gradient-to-b from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-300 dark:border-violet-700 shadow-xl shadow-violet-500/10 md:scale-105 md:-my-2"
                  : tier.name === "Pro"
                    ? "bg-slate-900 dark:bg-slate-800 border border-slate-700 shadow-lg"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md">
                  Most popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-1">
                <h3 className={`text-lg font-semibold ${tier.name === "Pro" ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {tier.name}
                </h3>
                <CurrentTierBadge tierName={tier.name} />
              </div>

              <div className="mb-2 flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${tier.name === "Pro" ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {price}
                </span>
                <span className={`text-sm ${tier.name === "Pro" ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {period}
                </span>
                {showAnnual && tier.annualSavings ? (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {tier.annualSavings}
                  </span>
                ) : null}
              </div>
              {showAnnual ? (() => {
                const refLine = computeAnnualReferenceLine(tier);
                if (!refLine) return null;
                return (
                  <p
                    data-testid={`pricing-annual-reference-${tier.name.toLowerCase()}`}
                    className={`-mt-1 mb-2 text-xs ${tier.name === "Pro" ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {refLine}
                  </p>
                );
              })() : null}

              <p className={`text-sm mb-6 ${tier.name === "Pro" ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                {tier.tag.replace(/\.$/, "")}
              </p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.featHeadStripped ? (
                  <li className={`text-sm font-medium ${tier.name === "Pro" ? "text-slate-200" : "text-slate-700 dark:text-slate-300"}`}>
                    {tier.featHeadStripped}
                  </li>
                ) : null}
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-2 text-sm ${tier.name === "Pro" ? "text-slate-200" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        tier.highlighted
                          ? "text-violet-600 dark:text-violet-400"
                          : tier.name === "Pro"
                            ? "text-violet-400"
                            : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <div
                className={`text-xs font-medium mb-4 px-2.5 py-1.5 rounded-md inline-block ${
                  tier.name === "Pro"
                    ? "bg-violet-500/20 text-violet-300"
                    : tier.highlighted
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {tier.nutritionNote}
              </div>

              <CheckoutButton
                tier={tier.checkoutTier}
                period={billing}
                label={tier.cta}
                highlighted={tier.highlighted}
              />

              {tier.checkoutTier !== null ? (
                <BillingDisclosure
                  price={price}
                  period={period}
                  isAnnual={showAnnual}
                  isProDark={tier.name === "Pro"}
                  stripeTaxEnabled={stripeTaxEnabled}
                  regionVatNote={regionVatNote}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function BillingToggle({
  billing,
  onChange,
}: {
  billing: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  return (
    <div className="flex justify-center mb-10">
      <div
        role="tablist"
        aria-label="Billing period"
        className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
      >
        <button
          type="button"
          role="tab"
          aria-selected={billing === "monthly"}
          onClick={() => onChange("monthly")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            billing === "monthly"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billing === "annual"}
          onClick={() => onChange("annual")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
            billing === "annual"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Annual
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Save 37%
          </span>
        </button>
      </div>
    </div>
  );
}

function BillingDisclosure({
  price,
  period,
  isAnnual,
  isProDark,
  stripeTaxEnabled,
  regionVatNote,
}: {
  price: string;
  period: string;
  isAnnual: boolean;
  isProDark: boolean;
  stripeTaxEnabled: boolean;
  /** H7 (2026-04-21) — region-aware VAT disclosure. When the visitor
   *  is detected as UK/EU we always render an inclusive-VAT note
   *  regardless of the Stripe flag, because the non-established-supplier
   *  rules in the 2026-04-19 consumer VAT memo require it. For
   *  default / unknown regions we fall back to the flag-gated clause.
   *  T22-E (2026-04-25): non-empty regionVatNote also signals UK/EU
   *  for the statutory cancellation clause — same region branch
   *  reused so the two disclosures can't drift. */
  regionVatNote: string;
}) {
  const periodNoun = isAnnual ? "year" : "month";
  // Tax-clause copy: UK/EU visitors always see the inclusive-VAT note
  // (regionVatNote wins). Outside UK/EU, the Stripe flag decides.
  const taxClause = regionVatNote
    ? `${regionVatNote}.`
    : stripeTaxEnabled
      ? "Price includes any applicable VAT."
      : "Price excludes any applicable taxes.";
  // T22-E (2026-04-25 paywall dark-pattern audit, item E): UK/EU
  // visitors see the statutory 14-day right alongside the 7-day
  // goodwill policy. Per the 2026-04-25 decision doc, path (a) ships
  // without counsel — we surface rights consumers already have by
  // law. Rest of world unchanged. See
  // docs/decisions/2026-04-25-uk-eu-statutory-cancellation.md.
  const isUkEu = regionVatNote.length > 0;
  return (
    <p
      className={`mt-2 text-xs leading-snug text-center ${
        isProDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300"
      }`}
      data-testid="billing-disclosure"
    >
      {`${price}${period}, charged today and automatically renews each ${periodNoun} until you cancel. Cancel anytime in `}
      <a
        href="/account/billing"
        className={`underline underline-offset-2 ${
          isProDark ? "hover:text-slate-100" : "hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        account settings
      </a>
      .{" "}
      {isUkEu ? (
        <>
          <span data-testid="billing-disclosure-statutory">
            UK/EU customers: under the Consumer Contracts Regulations 2013
            (UK) and Directive 2011/83/EU you have a 14-day right to cancel
            distance contracts for a full refund. Beyond that, our{" "}
          </span>
          <a
            href="/terms#refunds"
            className={`underline underline-offset-2 ${
              isProDark ? "hover:text-slate-100" : "hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            7-day goodwill refund policy
          </a>
          {" "}applies.{" "}
        </>
      ) : (
        <>
          <a
            href="/terms#refunds"
            className={`underline underline-offset-2 ${
              isProDark ? "hover:text-slate-100" : "hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            7-day refund policy
          </a>
          .{" "}
        </>
      )}
      {taxClause}
    </p>
  );
}
