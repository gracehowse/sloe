/**
 * Sloe landing-page marketing copy (Figma LP1 · 345:2).
 *
 * Product claims on / still flow through `content.ts` for pricing
 * tiers and save limits. This file holds Sloe-specific editorial
 * sections that are not shared with /pricing or /roadmap.
 */

import { FREE_SAVE_LIMIT } from "../../context/appData/constants";

export type TrendingRecipe = {
  title: string;
  author: string;
  image: string;
  /**
   * Where the card links. The public recipe page (`app/recipe/[id]/page.tsx`)
   * renders unauthed for `published = true` recipes, so ideally each card
   * would deep-link to a real `/recipe/{id}`. As of 2026-06-07 there are 0
   * published recipes in the DB, so the cards route to `/discover` (the
   * Recipes browse surface) as a real, working interim. When seed/published
   * recipes land, swap these to `/recipe/{id}`. Tracked: landing trending
   * cards → real public recipe deep-links.
   */
  href: string;
};

/** Trending rail — Figma LP1 cards 345:75–345:120. */
export const TRENDING_RECIPES: TrendingRecipe[] = [
  { title: "Warm Tahini Grain Bowl", author: "@kalejunkie", image: "/landing/trending-1.png", href: "/discover" },
  { title: "Three Cheese Fusilli", author: "@cookwithchay", image: "/landing/trending-2.png", href: "/discover" },
  { title: "Chicken Kale Salad", author: "@madewithmel", image: "/landing/trending-3.png", href: "/discover" },
  { title: "Blueberry Baked Oats", author: "@ellies.fav.eats", image: "/landing/trending-4.png", href: "/discover" },
  { title: "Crispy Gnocchi Traybake", author: "@grilledcheesesocial", image: "/landing/trending-5.png", href: "/discover" },
];

export const SLOE_DIFFERENCE_BULLETS = [
  "Personal calorie & macro targets from your goal",
  "A “Fits your day” check on every recipe",
  "Progress that follows the food you actually cook",
] as const;

export const SLOE_HOW_IT_WORKS = [
  {
    n: "01",
    title: "Save it from anywhere",
    body: "Share a Reel, paste a link, snap a cookbook page or type it out. Any source works.",
  },
  {
    n: "02",
    title: "We do the nutrition",
    body: "Sloe parses ingredients and works out calories and macros — no manual logging.",
  },
  {
    n: "03",
    title: "Cook it & track it",
    body: "Cook in step-by-step mode. Logging your meal is one tap, and your day updates instantly.",
  },
] as const;

/**
 * ENG-1203 — the two MFP-switch-win bullets for the landing Free card.
 * MyFitnessPal paywalled barcode scanning + custom macro goals in 2026
 * (the #1 cited exodus reasons); Suppr ships both free, so we call them
 * out by name with the "Free" prefix as concrete switch reasons. Both
 * are genuinely free in code — barcode is the always-unlocked Scan chip
 * (`TodayQuickLogStrip.tsx`, `locked: false`); custom macros is the
 * onboarding manual-targets card (`data-bridges.tsx`, no Pro gate).
 */
export const LANDING_FREE_MFP_SWITCH_WINS = [
  "Free barcode scanning",
  "Free custom macros",
] as const;

/**
 * Curated pricing bullets for the landing Free card (Figma LP1).
 *
 * ENG-1203 — when `mfpWinsEnabled` is true (the default-on
 * `paywall_free_mfp_wins_v1` flag), the two MFP-switch-win callouts are
 * appended so the Free column merchandises the features MFP paywalled.
 * When false, the legacy four-bullet list renders (the kill-switch
 * path). The caller passes the flag value it reads from analytics.
 */
export function landingFreeFeatures(mfpWinsEnabled = false): string[] {
  const base = [
    "Track calories & macros",
    `Save up to ${FREE_SAVE_LIMIT} recipes`,
    "Cook mode & meal logging",
    "Daily targets",
  ];
  if (mfpWinsEnabled) base.push(...LANDING_FREE_MFP_SWITCH_WINS);
  return base;
}

export const LANDING_PRO_FEATURES = [
  "Everything in Free",
  "Unlimited recipe imports",
  "Full macro & micro insights",
  "Weekly recap & trends",
  "Fasting & plan tools",
] as const;

/* ─────────────── Hero copy ─────────────── */

/**
 * Hero copy lives here (not inline in `LandingPage.tsx`) so the landing
 * parity test pins it and so the two positioning variants sit side by
 * side, auditable in one place.
 *
 * The H1 carries one emphasised fragment rendered as `<em>` — modelled
 * as `{ pre, em, post }` so the content module owns the words while the
 * component owns the markup. `eyebrow` and `lead` are plain strings.
 *
 * Two variants, selected at render time by the `landing_hero_hybrid_v1`
 * feature flag (default ON — see `src/lib/analytics/track.ts`):
 *
 *   - `HERO_CURRENT` — the recipe-first hero (kill-switch / flag-off path).
 *   - `HERO_HYBRID` — resolves DECISION D-07 (Grace 2026-05-25: HYBRID).
 *     Keeps the macro-tracker + "what to eat next" coaching promise as the
 *     LEAD, and keeps the Reel/TikTok import hook as the differentiating
 *     supporting wedge line. A re-ordering of emphasis, NOT a new product
 *     claim — both variants assert only what the landing already promises.
 *
 * NOTE: D-07 HYBRID copy signed off 2026-06-29 (Grace) — `landing_hero_hybrid_v1`
 * is default-ON on web; off → `HERO_CURRENT` kill switch.
 *
 * TAGLINE (Grace, design-consistency pass 2026-07-24): the HEADLINE is no
 * longer part of the D-07 experiment. "Cook what you love. Still reach your
 * goals." is the ONE line at every front door — the onboarding welcome step
 * (`onboarding/steps/welcome.tsx`), `/login`, `/pricing`'s hero, the landing
 * final CTA and now the landing hero. The hybrid variant previously headlined
 * "Know what to eat next. Hit your macros anyway.", so the two front doors
 * greeted the same visitor with two different promises. `landing_hero_hybrid_v1`
 * still switches the LEAD (tracker-first vs recipe-first framing) — that is the
 * live positioning test; the tagline is settled and shared by both variants via
 * {@link SLOE_TAGLINE}.
 */

export type HeroHeadline = {
  /** Leading H1 fragment, rendered before the emphasised `<em>`. */
  pre: string;
  /** The single emphasised fragment, rendered inside `<em>`. */
  em: string;
  /** Trailing H1 fragment, rendered after the `<em>`. */
  post: string;
};

export type HeroCopy = {
  eyebrow: string;
  headline: HeroHeadline;
  lead: string;
};

/**
 * The product tagline, as an `<em>`-splittable headline. Shared by BOTH hero
 * variants and by the landing final CTA. The other front doors (onboarding
 * welcome, `/login`, `/pricing`) render the same words as static page copy in
 * their own markup rather than importing this — they are not variant-driven.
 */
export const SLOE_TAGLINE: HeroHeadline = {
  pre: "Cook what you love. ",
  em: "Still",
  post: " reach your goals.",
} as const;

/** Shipped recipe-first hero — the flag-OFF (current) path. Wording is
 *  the verbatim pre-ENG-1204 hero, just lifted out of JSX into the SSOT. */
export const HERO_CURRENT: HeroCopy = {
  eyebrow: "For people who love food — and have goals",
  headline: SLOE_TAGLINE,
  lead:
    "Save any recipe from Instagram, TikTok or the web. Sloe works out the nutrition and helps it fit your day — no foods off-limits.",
} as const;

/** Hybrid hero (D-07) — the flag-ON path. Same settled tagline headline as the
 *  kill-switch path (see the TAGLINE note above); the tracker-first coaching
 *  promise now lands in the LEAD, with the Reel/TikTok import hook alongside
 *  it as the differentiating wedge. */
export const HERO_HYBRID: HeroCopy = {
  eyebrow: "For people who love food — and have goals",
  headline: SLOE_TAGLINE,
  lead:
    "The calorie & macro tracker that tells you what to eat next — and fits the food you love into your day. Paste a TikTok or Reel and get real macros in seconds.",
} as const;
