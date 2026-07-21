/**
 * / — marketing landing page, always.
 *
 * Grace 2026-04-20: "suppr-club.com = main landing page." This route
 * unconditionally renders the marketing landing for ALL visitors,
 * authed or not. The dashboard moved to /home. Sign-up CTAs point at
 * /onboarding (real Supabase signUp inline at v2 step 02); sign-in
 * CTAs point at /login.
 *
 * Previously this file did a server-side `supabase.auth.getUser()`
 * and rendered HomePageClient for authed users. That created a loop
 * for authed-but-onboarding-incomplete users: HomePageClient's gate
 * client-side-redirected to /onboarding, which 307s to /onboarding/v2,
 * which sometimes bounced back to / — every visit to suppr-club.com
 * felt broken.
 *
 * Authed users who want the dashboard navigate to /home (or are sent
 * there after sign-in / onboarding completion).
 */

import type { Metadata } from "next";
import { LandingPage } from "./(landing)/LandingPage.tsx";
import { isEurStripePricingConfigured } from "../src/lib/stripe/resolveProStripePrice.ts";

export const metadata: Metadata = {
  title: "Sloe — The recipe and nutrition platform for people who actually cook",
  description:
    "Paste a link from Instagram, TikTok, or any recipe blog — Sloe parses every ingredient and matches it against USDA FoodData Central and other public food databases.",
};

// 2026-05-15: dropped `force-dynamic` + `revalidate = 0`. The original
// reason (auth-conditional HomePageClient render) is gone — this route
// unconditionally renders the marketing landing now. Letting Next
// prerender static means TikTok/Instagram cold-opens hit Vercel's CDN
// instead of paying a function invocation per visit. Saves ~150–400ms
// TTFB + protects function budget under viral-spike traffic.
//
// ENG-1441 (2026-07-21): the two props below are `process.env` reads,
// NOT `headers()`/`cookies()` — Next only opts a route out of static
// rendering for the latter, so this does not touch the static-rendering
// behaviour the comment above protects. Region/currency detection
// itself is deliberately NOT done here for the same reason — see
// `detectRegionFromNavigatorLanguage`'s doc comment
// (`src/lib/region/detectRegion.ts`): `LandingPage`'s `Pricing` section
// resolves it client-side instead.
export default function Page() {
  return (
    <LandingPage
      stripeTaxEnabled={process.env.STRIPE_TAX_ENABLED === "true"}
      eurPricingReady={isEurStripePricingConfigured()}
    />
  );
}
