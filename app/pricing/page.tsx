import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PageViewTracker } from "../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";
import { CurrentTierBadge } from "./CurrentTierBadge.tsx";
import { CheckoutButton } from "./CheckoutButton.tsx";

export const metadata: Metadata = {
  title: "Pricing — Platemate",
  description: "Choose a plan that fits your goals. Free, Base, or Pro.",
};

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic tracking",
    features: [
      "Save up to 10 recipes",
      "Browse community recipes",
      "Basic nutrition logging",
      "Daily macro tracking",
      "Profile & target setup",
    ],
    cta: "Get Started",
    checkoutTier: null,
    highlighted: false,
  },
  {
    name: "Base",
    price: "$5",
    period: "/month",
    description: "Unlock the full meal planning loop",
    features: [
      "Unlimited saved recipes",
      "Smart meal plan generation",
      "Macro-optimised planning",
      "Shopping list from plan",
      "Cook mode with timers",
      "Recipe import from URL",
      "Fiber & water tracking",
      "Export shopping list & data",
    ],
    cta: "Upgrade to Base",
    checkoutTier: "base" as const,
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    description: "For creators and serious trackers",
    features: [
      "Everything in Base",
      "Publish recipes publicly",
      "Creator analytics & followers",
      "Recipe import from photos",
      "Activity-adjusted calories",
      "Advanced nutrition insights",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    checkoutTier: "pro" as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PageViewTracker event={AnalyticsEvents.pricing_page_viewed} />
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Platemate
          </a>
          <a
            href="/login"
            className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            From tracking macros to planning meals that hit your targets. Choose the plan that fits your goals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                tier.highlighted
                  ? "bg-gradient-to-b from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-300 dark:border-violet-700 shadow-xl shadow-violet-500/10"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold">
                  Most popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {tier.name}
                </h3>
                <CurrentTierBadge tierName={tier.name} />
              </div>
              <div className="mb-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{tier.price}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm ml-1">{tier.period}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {tier.description}
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <CheckoutButton
                tier={tier.checkoutTier}
                label={tier.cta}
                highlighted={tier.highlighted}
              />
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All plans include Supabase-backed cloud sync. Cancel anytime.
            Have a promo code? Redeem it in{" "}
            <a href="/?view=settings" className="text-violet-600 dark:text-violet-400 underline">
              Settings
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
