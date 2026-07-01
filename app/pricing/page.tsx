import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ChevronDown } from "lucide-react";
import { PageViewTracker, PageDismissTracker } from "../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events.ts";
import { FREE_SAVE_LIMIT, NUTRITION_SOURCES, PRICING_TIERS } from "../../src/lib/landing/content.ts";
import { detectRegion, resolveRenderedVatNote } from "../../src/lib/region/detectRegion.ts";
import { isEurStripePricingConfigured } from "../../src/lib/stripe/resolveProStripePrice.ts";
import { PricingHero } from "./PricingHero.tsx";
import { PricingPaywallHonesty } from "./PricingPaywallHonesty.tsx";
import { PricingTiersGrid } from "./PricingTiersGrid.tsx";
import { PaywallTrustStrip } from "./PaywallTrustStrip.tsx";
import { PricingLegacyTrustSignals } from "./PricingLegacyTrustSignals.tsx";
import { PaywallValueGrid } from "./PaywallValueGrid.tsx";
import { PaywallComparison } from "./PaywallComparison.tsx";
import { PaywallTrajectoryChart } from "./PaywallTrajectoryChart.tsx";
import { PromoCodeBlock } from "./PromoCodeBlock.tsx";

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
  title: "Pricing — Sloe",
  description: "Choose a plan that fits your goals. Free or Pro.",
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
    a: `Nothing disappears. Your recipes above the Free tier's ${FREE_SAVE_LIMIT}-recipe limit stay saved and editable; you just won't be able to save new recipes until you're back at ${FREE_SAVE_LIMIT} or fewer, or on Pro.`,
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
    a: "If you're unhappy within the first 7 days, email support@getsloe.com and we'll process a refund. Refunds are handled manually via Stripe.",
  },
  // 2026-05-12 (premium-bar audit Group A pricing #5 — 6-question
  // FAQ): added two MFP-refugee-relevant entries — privacy posture
  // and competitor import compatibility — to lift the FAQ count
  // from 4 → 6 and shore up the conversion case for switchers.
  {
    q: "Is my food data private?",
    a: "Yes. Your food log, weight history, and saved recipes are private to your account. We never sell or share your data. You can export everything as JSON or delete your account anytime from Settings.",
  },
  {
    q: "Can I bring in my history from MyFitnessPal, Cronometer, or Lose It?",
    a: "MyFitnessPal CSV import is on the roadmap — paste-link import from any recipe URL already works. If you have an export from another tracker, email support@getsloe.com and we'll help you migrate manually in the meantime.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border last:border-0">
      <summary className="flex cursor-pointer items-center justify-between py-4 text-sm font-semibold text-foreground">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
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

  // H7 (2026-04-21) — region-aware pricing surface. `detectRegion`
  // reads CF-IPCountry / Accept-Language from the request headers and
  // returns the currency + locale + VAT note. UK / EU visitors get the
  // inclusive-VAT disclosure required by the 2026-04-19 consumer VAT
  // memo; EU visitors additionally see a "EU pricing coming soon"
  // banner because the Stripe SKUs are GBP-only in v1.
  const reqHeaders = await headers();
  const region = detectRegion(reqHeaders);
  return (
    <div className="min-h-screen bg-background">
      <PageViewTracker event={AnalyticsEvents.pricing_page_viewed} />
      {/* Canonical `paywall_viewed` contract (L6 G9 + 2026-04-19
          round-2): every emit carries `{ from, tier, surface, platform }`.
          `/pricing` is the full-route commercial surface, so
          `surface: "route"`. `tier: "pro"` tracks the only paid tier
          (PR-01, 2026-04-28: Base removed per strategic direction). */}
      <PageViewTracker
        event={AnalyticsEvents.paywall_viewed}
        properties={{
          from: paywallFrom,
          tier: "pro",
          surface: "route",
          platform: "web",
        }}
      />
      {/* T22 (full-sweep 2026-04-24): emit `paywall_dismissed` on
          unmount (page leave / SPA route change). F2 conversion
          funnel previously had no dismiss counterpart on the web
          /pricing surface — drop-off was indistinguishable from
          "still considering". Fires regardless of cause; checkout
          conversions still emit `checkout_started` separately so
          the funnel can subtract. */}
      <PageDismissTracker
        event={AnalyticsEvents.paywall_dismissed}
        properties={{
          from: paywallFrom,
          surface: "route",
          platform: "web",
        }}
      />

      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-[22px] font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand"
            aria-label="Sloe"
          >
            sloe
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-card transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 sm:py-16">
        {/* Photo hero — Sloe Pro paywall (Figma `284:2`, 2026-06-08).
            Full-bleed finished-dish photograph + soft fade + "SLOE PRO"
            eyebrow + "Cook what you love. / *Still* reach your goals."
            positioning headline. Extracted into `PricingHero` so the
            page body stays focused on the value grid + comparison +
            tier + FAQ composition. Same hero copy as the mobile paywall. */}
        <PricingHero />

        <PricingPaywallHonesty paywallFrom={paywallFrom} />

        {/* ENG-969 — calm projected-weight chart (default-OFF
            `paywall_trajectory_chart_v1`, self-gated client-side). The public
            /pricing route is unauthenticated and passes no per-user data, so it
            renders nothing here today — net-neutral. The component contract
            matches mobile so an authenticated web mount draws the same chart. */}
        <PaywallTrajectoryChart />

        {/* 2×2 value-prop grid (Figma `284:2`) — Unlimited imports /
            Macro fitting / AI coach / Cloud sync. Copy from the shared
            `PAYWALL_VALUE_PROPS` SSOT (web == mobile). */}
        <PaywallValueGrid />

        {/* FREE / PRO comparison matrix (Figma `284:2`) — PRO column
            lilac-highlighted. Rows from the shared
            `PAYWALL_COMPARISON_ROWS` SSOT. Free's ✓s stay visible
            (permission-not-restriction framing). */}
        <PaywallComparison />

        {/* Trust strip — three chips (cancel anytime / 7-day refund /
            price never changes mid-trial) rendered above the tier
            grid. Counter to the #1 user-sentiment pain across the
            competitive set per the 2026-04-30 14-app audit. Copy SSOT
            in `src/lib/landing/paywallTrust.ts`; mobile paywall renders
            the same three chips with identical wording. */}
        <PaywallTrustStrip />

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
        {/* ENG-33 (2026-05-13): when STRIPE_TAX_ENABLED is false, the
            "Prices include VAT" inclusive-VAT claim on UK/EU surfaces
            is untrue — Stripe isn't computing VAT, so the user pays the
            sticker price without VAT added. `resolveRenderedVatNote`
            gates the note on the flag so the disclosure falls back to
            the honest "Price excludes any applicable taxes" line until
            Stripe dashboard has `tax_behavior=inclusive` on each Price
            object and the flag flips. Authority: docs/operations/
            stripe-tax-launch-checklist.md + docs/decisions/2026-04-19-
            consumer-vat-posture-uk-eu.md. */}
        <PricingTiersGrid
          tiers={TIERS_FOR_GRID}
          stripeTaxEnabled={process.env.STRIPE_TAX_ENABLED === "true"}
          paywallFrom={paywallFrom}
          regionVatNote={resolveRenderedVatNote(
            region.vatNote,
            process.env.STRIPE_TAX_ENABLED === "true",
          )}
          regionCurrency={region.currency}
          regionNote={
            region.currency === "EUR" && !isEurStripePricingConfigured()
              ? "EU pricing coming soon — current prices in GBP"
              : ""
          }
        />

        <PricingLegacyTrustSignals />

        {/* FAQ */}
        <div className="mt-14 max-w-2xl mx-auto">
          {/* SLOE DS: plum serif section heading (brand display voice). */}
          <h2 className="text-2xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand text-center mb-6">
            Frequently asked questions
          </h2>
          <div className="rounded-2xl border border-border bg-card px-5">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Promo-code redemption (D9 W1/W2, 2026-04-21). Replaces the
            old Settings-pointer footnote; the Settings-side block stays
            live until task S2, which depends on this surface. */}
        <PromoCodeBlock />
      </main>
    </div>
  );
}
