import type { Metadata } from "next";
import { Shield, Cloud, Download, ChevronDown } from "lucide-react";
import { PageViewTracker } from "../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { FREE_SAVE_LIMIT, NUTRITION_SOURCES, PRICING_TIERS } from "../../src/lib/landing/content.ts";
import { PricingTiersGrid } from "./PricingTiersGrid.tsx";

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
    // Round-3 additions (2026-04-19) — one branch per new
    // `PaywallViewedFrom` value so the helper stays exhaustive. See
    // `tests/unit/analyticsEvents.test.ts` for the parity guard.
    case "recipes_library":
    case "shopping_list":
    case "profile":
    case "recipe_create":
    case "recipe_import":
    case "meal_planner":
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
 * to this page (cta label, `featHead` rewritten for bullet-list
 * rendering) are derived here. The tier grid itself lives in the
 * `PricingTiersGrid` client component so it can own the monthly ↔
 * annual toggle state.
 */
const TIERS_FOR_GRID = PRICING_TIERS.map((t) => ({
  ...t,
  // Parity with `app/(landing)/LandingPage.tsx` — the free-tier CTA
  // reads "Continue for free" on both surfaces.
  cta: t.checkoutTier === null ? "Continue for free" : `Upgrade to ${t.name}`,
  // "Everything in Free, plus" → "Everything in Free" for the
  // /pricing bullet-list rendering style (the grid renders the head
  // line as its own bullet rather than inline).
  featHeadStripped: t.featHead
    ? t.featHead.replace(/,\s*plus$/i, "")
    : undefined,
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
    // limit rather than making existing ones read-only. Round-2 legal
    // pass (2026-04-19) softened again: recipes "stay saved and editable".
    a: `Nothing disappears. Your recipes above the Free tier's ${FREE_SAVE_LIMIT}-recipe limit stay saved and editable; you just won't be able to save new recipes until you're back at ${FREE_SAVE_LIMIT} or fewer, or on Base.`,
  },
  // Annual-plan "Coming soon" FAQ intentionally removed 2026-04-19
  // (monetisation-architect round-2): parking a placeholder with no
  // shipped SKU created an implied promise. Matches the parallel
  // removal in `src/lib/landing/content.ts` FAQS.
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
      {/* Canonical `paywall_viewed` contract (L6 G9 + 2026-04-19
          round-2): every emit carries `{ from, tier, surface, platform }`.
          `/pricing` is the full-route commercial surface, so
          `surface: "route"`. `tier: "pro"` tracks the *primary* tier
          being sold; the page does also advertise Base but the
          monetisation funnel's conversion target is Pro. */}
      <PageViewTracker
        event={AnalyticsEvents.paywall_viewed}
        properties={{
          from: paywallFrom,
          tier: "pro",
          surface: "route",
          platform: "web",
        }}
      />

      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a
            href="/"
            className="text-lg font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #4c6ce0 0%, #e04888 100%)" }}
          >
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

        {/* Tier cards — client component owns the monthly ↔ annual
            toggle state. Price, period, and billing-renewal disclosure
            all read from the PRICING_TIERS SSOT so drift between copy
            and checkout (which hit the same PRICING_TIERS-backed
            Stripe price IDs) is impossible.

            `stripeTaxEnabled` is read server-side from the
            `STRIPE_TAX_ENABLED` env var and passed to the client so the
            tax-clause copy stays in lockstep with whether the
            /api/stripe/checkout route passes `automatic_tax` to Stripe
            (round-6 flag, 2026-04-19). */}
        <PricingTiersGrid
          tiers={TIERS_FOR_GRID}
          stripeTaxEnabled={process.env.STRIPE_TAX_ENABLED === "true"}
          paywallFrom={paywallFrom}
        />

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
            <a href="/home?view=settings" className="text-violet-600 dark:text-violet-400 underline">
              Settings
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
