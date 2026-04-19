"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { BillingPeriod, PricingTier } from "../../src/lib/landing/content.ts";
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
export function PricingTiersGrid({ tiers }: { tiers: Tier[] }) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  return (
    <>
      <BillingToggle billing={billing} onChange={setBilling} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {tiers.map((tier) => {
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
}: {
  price: string;
  period: string;
  isAnnual: boolean;
  isProDark: boolean;
}) {
  const periodNoun = isAnnual ? "year" : "month";
  return (
    <p
      className={`mt-2 text-xs leading-snug text-center ${
        isProDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300"
      }`}
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
      <a
        href="/terms#refunds"
        className={`underline underline-offset-2 ${
          isProDark ? "hover:text-slate-100" : "hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        7-day refund policy
      </a>
      . Price excludes any applicable taxes.
    </p>
  );
}
