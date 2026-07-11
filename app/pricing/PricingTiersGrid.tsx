"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { BillingPeriod, PricingTier } from "../../src/lib/landing/content.ts";
import {
  computeAnnualSavingsBadge,
  FREE_CUSTOM_MACROS_FEATURE,
  FREE_ADAPTIVE_TDEE_FEATURE_PLAIN,
  FREE_ADAPTIVE_TDEE_FEATURE_GLOSS,
  PAYWALL_FREE_MFP_WINS_FLAG,
} from "../../src/lib/landing/content.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { CurrentTierBadge } from "./CurrentTierBadge.tsx";
import { CheckoutButton } from "./CheckoutButton.tsx";
import { PricingNoPaymentChip } from "./PricingNoPaymentChip.tsx";
import { BillingDisclosure } from "./BillingDisclosure.tsx";

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
   *  default / US-ish surfaces.
   *
   *  ENG-33 (2026-05-13): the parent (`/pricing/page.tsx`) now passes
   *  the region note **only** when `STRIPE_TAX_ENABLED=true`. When
   *  the flag is off, the "Prices include VAT" claim is untrue —
   *  Stripe isn't computing VAT, so the user pays the sticker price
   *  without VAT added. Until the flag flips and Stripe dashboard
   *  has `tax_behavior=inclusive` on each Price object, this prop
   *  arrives empty for UK/EU visitors and the disclosure falls back
   *  to the honest "Price excludes any applicable taxes" line. */
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

  // ENG-1203 — the "Custom macros — free forever" Free-column bullet is
  // gated behind the default-on `paywall_free_mfp_wins_v1` flag; off →
  // the bullet is suppressed (kill switch), leaving the legacy list.
  const mfpWinsEnabled = isFeatureEnabled(PAYWALL_FREE_MFP_WINS_FLAG);

  // ENG-1461 — jargon gloss (product-wide extension of ENG-1187). Same
  // flag + grammar as Progress/the weekly check-in so "TDEE" never carries
  // more than one label across the product.
  const jargonGlossEnabled = isFeatureEnabled("onboarding_jargon_gloss_v1");

  // ENG-1460 — the hero CTA above only renders behind
  // `pricing_conversion_pair_v1`; the tier-card CTA only demotes to
  // outline when that hero CTA actually exists to avoid competing with —
  // off → these stay the legacy filled/muted CheckoutButton (kill switch).
  const conversionPairEnabled = isFeatureEnabled("pricing_conversion_pair_v1");

  // Phase 5 / B1.3 (D-2026-04-27-05) — pricing collapses to Free + Pro.
  // PR-01 (audit 2026-04-28): the Base filter is now a no-op — Base
  // was removed from PRICING_TIERS in batch 19. Kept as a defensive
  // identity pass so the pre-fix grid behaviour is preserved if any
  // legacy tier name slips back into the SSOT during migration.
  // Audit 2026-05-04 #23: anchor Pro on the left (default eye-path)
  // — Free anchored left was the wrong conversion anchor for cold
  // traffic. Sort `highlighted: true` first; remaining tiers preserve
  // their SSOT order. Free reads as a legitimate fallback in the
  // right-hand position, not de-emphasised beyond positional weight.
  const visibleTiers = [...tiers].sort((a, b) =>
    Number(Boolean(b.highlighted)) - Number(Boolean(a.highlighted)),
  );

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
          className="mb-6 mx-auto max-w-xl text-center text-xs font-medium text-muted-foreground border border-border rounded-full px-4 py-2"
          style={{ background: "var(--background-secondary)" }}
        >
          {regionNote}
        </div>
      ) : null}
      <BillingToggle billing={billing} onChange={onPeriodCommit} tiers={tiers} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start max-w-3xl mx-auto">
        {visibleTiers.map((tier) => {
          const isAnnual = billing === "annual";
          const showAnnual = isAnnual && Boolean(tier.annualPrice);
          const price = showAnnual ? tier.annualPrice! : tier.price;
          const period = showAnnual ? tier.annualPeriod ?? "" : tier.period;

          return (
            <div
              key={tier.name}
              className={`relative rounded-2xl flex flex-col ${
                tier.highlighted
                  ? // Canonical palette 2026-05-22: premium tier surface
                    // is `--card-elevated` (warm cream lift), NOT a dark
                    // slate card. Dark-on-cream reads richer than white-
                    // on-slate on the warm palette. Indigo accent ring
                    // (transparent --accent-primary-ring) replaces the
                    // solid violet border so the Pro card harmonises
                    // with the cream surface family rather than
                    // looking like a different platform.
                    "border-2 shadow-2xl md:scale-105 md:-my-2 pt-10 pb-6 px-6"
                  : "bg-card border border-border shadow-sm p-6"
              }`}
              style={
                tier.highlighted
                  ? {
                      background: "var(--card-elevated)",
                      borderColor: "var(--accent-primary-ring)",
                      boxShadow:
                        "0 4px 16px var(--accent-primary-soft), 0 12px 32px rgba(26, 23, 20, 0.08)",
                    }
                  : undefined
              }
            >
              {tier.highlighted && (
                // SLOE DS: the recommended-tier ribbon is the clay action
                // hue (the Sloe "best value" signal in the Figma paywall),
                // replacing the violet→indigo gradient.
                <div
                  className="absolute -top-px left-0 right-0 h-8 flex items-center justify-center rounded-t-2xl text-white text-xs font-bold tracking-wide"
                  style={{ background: "var(--accent-primary)" }}
                >
                  Most popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-1">
                {/* SLOE DS: plum serif tier name (the brand display voice). */}
                <h3 className="text-lg font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand">
                  {tier.name}
                </h3>
                <CurrentTierBadge tierName={tier.name} />
              </div>

              <div className="mb-2 flex items-baseline gap-2">
                {/* SLOE DS: plum serif price numeral. */}
                <span className="text-4xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand">
                  {price}
                </span>
                <span className={`text-sm text-muted-foreground`}>
                  {period}
                </span>
                {showAnnual ? (() => {
                  // Audit P04 (2026-05-05) — derive from prices instead
                  // of using a hardcoded "Save 37%" string. Falls back
                  // to `tier.annualSavings` if a manual override was
                  // set (none today).
                  const badge = computeAnnualSavingsBadge(tier);
                  if (!badge) return null;
                  // SLOE DS: savings badge in the sage "on-track" hue.
                  return (
                    <span
                      className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--accent-success-soft)",
                        color: "var(--accent-success-solid)",
                      }}
                    >
                      {badge}
                    </span>
                  );
                })() : null}
              </div>
              {/* 2026-05-12 (premium-bar audit #7, P0 legal exposure):
                  UK/EU visitors must see the VAT-inclusive line in the
                  visible viewport, not buried beneath the feature list.
                  Stripe + Linear ship this directly under the price
                  digit. The full BillingDisclosure still renders below
                  the feature list with the longer statutory copy; this
                  is the at-a-glance reassurance. */}
              {regionVatNote && tier.checkoutTier ? (
                <p
                  data-testid={`pricing-vat-inclusive-${tier.name.toLowerCase()}`}
                  className="-mt-1 mb-2 text-xs text-muted-foreground"
                >
                  Includes VAT
                </p>
              ) : null}
              {/* Audit 2026-05-04 #23: surface the annual savings in
                  the Monthly default view too — the previous design
                  hid the whole savings signal until the user flipped
                  the toggle, which most cold-traffic users never
                  reach. Informational line, not a default change:
                  monthly price stays the displayed price. Only renders
                  on tiers that actually have an annual SKU + savings
                  string to substantiate the claim. */}
              {!showAnnual && tier.annualPrice && tier.annualSavings ? (
                // SLOE DS: annual-savings nudge in the sage "on-track" hue.
                <p
                  data-testid={`pricing-monthly-savings-nudge-${tier.name.toLowerCase()}`}
                  className="-mt-1 mb-2 text-xs"
                  style={{ color: "var(--accent-success-solid)" }}
                >
                  {tier.annualSavings} with annual — {tier.annualPrice}
                  {tier.annualPeriod ? `${tier.annualPeriod}` : ""}
                </p>
              ) : null}
              {showAnnual ? (() => {
                const refLine = computeAnnualReferenceLine(tier);
                if (!refLine) return null;
                return (
                  <p
                    data-testid={`pricing-annual-reference-${tier.name.toLowerCase()}`}
                    className={`-mt-1 mb-2 text-xs text-muted-foreground`}
                  >
                    {refLine}
                  </p>
                );
              })() : null}

              <p className={`text-sm mb-5 text-muted-foreground`}>
                {tier.tag.replace(/\.$/, "")}
              </p>

              <ul className="space-y-2 mb-5 flex-1">
                {tier.featHeadStripped ? (
                  <li className={`text-sm font-medium text-foreground`}>
                    {tier.featHeadStripped}
                  </li>
                ) : null}
                {tier.features
                  .filter(
                    (feature) =>
                      mfpWinsEnabled || feature !== FREE_CUSTOM_MACROS_FEATURE,
                  )
                  .map((feature) => {
                    // ENG-1461 — swap the plain "Adaptive TDEE" bullet for its
                    // glossed sibling behind `onboarding_jargon_gloss_v1`, the
                    // same per-bullet-swap pattern as the MFP-wins bullet above.
                    const displayFeature =
                      jargonGlossEnabled && feature === FREE_ADAPTIVE_TDEE_FEATURE_PLAIN
                        ? FREE_ADAPTIVE_TDEE_FEATURE_GLOSS
                        : feature;
                    return (
                      <li
                        key={feature}
                        className={`flex items-start gap-2 text-sm text-foreground`}
                      >
                        {/* SLOE DS: feature checks — sage on highlighted/Pro
                            (the "included" tick in the Figma paywall table),
                            muted on the Free tier. */}
                        <Check
                          className="w-4 h-4 shrink-0 mt-0.5"
                          style={{
                            color:
                              tier.highlighted || tier.name === "Pro"
                                ? "var(--accent-success-solid)"
                                : "var(--foreground-tertiary)",
                          }}
                        />
                        {displayFeature}
                      </li>
                    );
                  })}
              </ul>

              {/* SLOE DS: nutrition note pill — cream slab with plum
                  text on the Pro/highlighted tier, muted on Free. */}
              <div
                className="text-xs font-medium mb-4 px-2.5 py-1.5 rounded-md inline-block"
                style={
                  tier.highlighted || tier.name === "Pro"
                    ? {
                        background: "var(--background-secondary)",
                        color: "var(--foreground-brand)",
                      }
                    : {
                        background: "var(--background-secondary)",
                        color: "var(--muted-foreground)",
                      }
                }
              >
                {tier.nutritionNote}
              </div>

              {tier.checkoutTier === "pro" && billing === "annual" ? (
                <PricingNoPaymentChip />
              ) : null}

              {/* ENG-1460: when the hero CTA above is the ONE filled CTA on
                  the page ("Start free trial" on annual, "Subscribe" on
                  monthly — ENG-1511), these tier-card CTAs stay
                  outline so they don't compete with it. Flag off → legacy
                  auto (highlighted tier stays filled, no hero exists). */}
              <CheckoutButton
                tier={tier.checkoutTier}
                period={billing}
                currency={regionCurrency}
                label={tier.cta}
                highlighted={tier.highlighted}
                emphasis={conversionPairEnabled ? "outline" : "auto"}
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
  tiers,
}: {
  billing: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
  tiers: PricingTier[];
}) {
  // Audit P04 (2026-05-05) — derive the badge from the headline paid
  // tier (i.e. the first tier with `annualPrice` set), not a hardcoded
  // string. Falls through to no badge if no tier has annual pricing.
  const headlineTier = tiers.find((t) => Boolean(t.annualPrice));
  const annualBadge = headlineTier ? computeAnnualSavingsBadge(headlineTier) : null;
  return (
    <div className="flex flex-col items-center mb-8 gap-2">
      {/* 2026-05-13 (premium-bar audit Group I #4): web parity mirror
          of the mobile paywall eyebrow. TF feedback found that the
          period toggle floated with no label, and testers thought
          the "Save 37%" badge was advertising a generic discount
          rather than a billing-period switch. The BILLING eyebrow
          anchors the toggle's purpose. */}
      {/* SLOE DS: billing eyebrow + segmented toggle on the cream rail
          (`--background-secondary`); selected tab lifts to the white page
          surface. Sage savings badge. Replaces the slate/emerald set. */}
      <span className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground">
        BILLING
      </span>
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
          onClick={() => onChange("monthly")}
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
          onClick={() => onChange("annual")}
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
    </div>
  );
}
