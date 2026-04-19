import type { Metadata } from "next";
import { Check, Shield, Cloud, Download, ChevronDown } from "lucide-react";
import { PageViewTracker } from "../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { FREE_SAVE_LIMIT, NUTRITION_SOURCES, PRICING_TIERS } from "../../src/lib/landing/content.ts";
import { CurrentTierBadge } from "./CurrentTierBadge.tsx";
import { CheckoutButton } from "./CheckoutButton.tsx";

/** Map a raw `?from=` URL-param value into the canonical enum so
 *  `paywall_viewed.from` cannot drift from the PostHog dashboard slice.
 *  Unknown / missing values fall back to `"deep_link"`. Shared contract
 *  with `apps/mobile/app/paywall.tsx`. */
function normalisePaywallFrom(raw: string | string[] | undefined): PaywallViewedFrom {
  const s = Array.isArray(raw) ? raw[0] : raw ?? "";
  switch (s) {
    case "voice_log":
    case "photo_log":
    case "settings":
    case "onboarding":
    case "trial_end":
    case "deep_link":
      return s;
    default:
      return "deep_link";
  }
}

export const metadata: Metadata = {
  title: "Pricing — Suppr",
  description: "Choose a plan that fits your goals. Free, Base, or Pro.",
};

/**
 * Tier rendering reads PRICING_TIERS from the shared SSOT so the
 * landing page and /pricing cannot drift. Only the fields specific
 * to this page (cta label, description paragraph) are mapped here.
 */
const TIERS = PRICING_TIERS.map((t) => ({
  name: t.name,
  price: t.price,
  period: t.period,
  description: t.tag.replace(/\.$/, ""),
  /** "Everything in Free, plus" → "Everything in Free" for the
   *  /pricing bullet list rendering style. */
  features: t.featHead
    ? [t.featHead.replace(/,\s*plus$/i, ""), ...t.features]
    : t.features,
  nutritionNote: t.nutritionNote,
  // Parity with `app/(landing)/LandingPage.tsx` — the free-tier CTA
  // reads "Continue for free" on both surfaces.
  cta: t.checkoutTier === null ? "Continue for free" : `Upgrade to ${t.name}`,
  checkoutTier: t.checkoutTier,
  highlighted: t.highlighted,
}));

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings — your data stays. You'll keep access until the end of your billing period.",
  },
  {
    q: "What happens to my data if I downgrade?",
    // Copy aligned to `FAQS` in `src/lib/landing/content.ts` — see the
    // matching note there; the client only blocks *new* saves above the
    // limit rather than making existing ones read-only.
    a: `Your recipes, logs, and plans are never deleted. Recipes above the Free tier's ${FREE_SAVE_LIMIT}-recipe limit stay saved; you won't be able to add more until you're back under the limit or on Base. Everything else stays fully accessible and exportable.`,
  },
  {
    q: "Is there an annual plan?",
    a: "Not yet, but it's coming. Subscribe monthly now and we'll offer a discounted annual option when it launches.",
  },
  {
    q: "How is nutrition data sourced?",
    // Reads from the shared `NUTRITION_SOURCES` SSOT so pipeline order
    // (see `src/lib/nutrition/verifyIngredients.ts`) stays pinned to the
    // copy — the parity test catches drift.
    a: `Every ingredient is matched against ${NUTRITION_SOURCES[0]} first, then ${NUTRITION_SOURCES[1]}, then ${NUTRITION_SOURCES[2]}, then ${NUTRITION_SOURCES[3]} for branded items. Photo and voice use AI models cross-referenced against the same database stack. You can verify and edit any entry.`,
  },
  {
    q: "Do you offer refunds?",
    a: "If you're unhappy within the first 7 days, email support@suppr-club.com and we'll process a refund. Refunds are handled manually via Stripe.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-slate-200 dark:border-slate-800 last:border-0">
      <summary className="flex cursor-pointer items-center justify-between py-4 text-sm font-semibold text-slate-900 dark:text-white">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{a}</p>
    </details>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  // Next.js App Router passes `searchParams` as an async Promise in
  // the current major — awaited once here so the page stays server-
  // rendered without forcing client-side navigation.
  searchParams?: Promise<{ from?: string | string[] }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  // L6 G9 (2026-04-18) — `paywall_viewed.from` is mandatory so funnel
  // F2 (AI-Pro paywall conversion) can attribute the view to its
  // originating surface. Normalised through the shared enum above.
  const paywallFrom = normalisePaywallFrom(resolvedSearchParams.from);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PageViewTracker event={AnalyticsEvents.pricing_page_viewed} />
      <PageViewTracker
        event={AnalyticsEvents.paywall_viewed}
        properties={{ from: paywallFrom }}
      />

      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Suppr
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
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Everything you need to eat well
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            From tracking macros to planning meals that hit your targets. Pick the plan that fits your goals.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {TIERS.map((tier) => (
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
              <div className="mb-2">
                <span className={`text-4xl font-bold ${tier.name === "Pro" ? "text-white" : "text-slate-900 dark:text-white"}`}>{tier.price}</span>
                <span className={`text-sm ml-1 ${tier.name === "Pro" ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>{tier.period}</span>
              </div>
              <p className={`text-sm mb-6 ${tier.name === "Pro" ? "text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
                {tier.description}
              </p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className={`flex items-start gap-2 text-sm ${tier.name === "Pro" ? "text-slate-200" : "text-slate-700 dark:text-slate-300"}`}>
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.highlighted ? "text-violet-600 dark:text-violet-400" : tier.name === "Pro" ? "text-violet-400" : "text-slate-400 dark:text-slate-500"}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className={`text-xs font-medium mb-4 px-2.5 py-1.5 rounded-md inline-block ${
                tier.name === "Pro"
                  ? "bg-violet-500/20 text-violet-300"
                  : tier.highlighted
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {tier.nutritionNote}
              </div>

              <CheckoutButton
                tier={tier.checkoutTier}
                label={tier.cta}
                highlighted={tier.highlighted}
              />
              {/* Billing-honesty disclosure adjacent to the CTA so the
                  user sees the renewal commitment before clicking
                  through to Stripe (monetisation-architect finding,
                  2026-04-19). Only shown for paid tiers; the Free tier
                  has no billing to disclose. */}
              {tier.checkoutTier !== null ? (
                <p className={`mt-2 text-[11px] leading-snug text-center ${
                  tier.name === "Pro"
                    ? "text-slate-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}>
                  Billed monthly until cancelled. Cancel anytime.
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            Cancel anytime
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Cloud sync across devices
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Download className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            Export your data anytime
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">
            Frequently asked questions
          </h2>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
