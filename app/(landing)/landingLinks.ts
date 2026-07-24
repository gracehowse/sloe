/**
 * Landing-page destinations + the single sign-up label.
 *
 * Extracted from `LandingPage.tsx` (design-consistency pass, 2026-07-24) so the
 * page chrome (`LandingChrome.tsx`), the trending rail (`TrendingRail.tsx`) and
 * the page body can all reference ONE copy of them — and so `LandingPage.tsx`
 * stays under its line budget (`npm run check:screen-budget`).
 */

export const NAV_LINKS = [
  { href: "/discover", label: "Recipes" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

export const SIGNUP_HREF = "/onboarding";
export const SIGNIN_HREF = "/login";
export const DISCOVER_HREF = "/discover";

/**
 * ONE sign-up label at every door. The nav said "Get started" while the hero
 * 40px below said "Get the app"; both point at `/onboarding`, which is the WEB
 * flow, so "Get the app" also implied an App Store hand-off that does not
 * happen. "Get started" is the honest, single label — nav, hero, final CTA
 * (and it is already what the Pricing cards use).
 */
export const SIGNUP_CTA_LABEL = "Get started";
