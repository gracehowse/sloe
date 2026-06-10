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

/** Curated pricing bullets for the landing cards (Figma LP1). */
export function landingFreeFeatures(): string[] {
  return [
    "Track calories & macros",
    `Save up to ${FREE_SAVE_LIMIT} recipes`,
    "Cook mode & meal logging",
    "Daily targets",
  ];
}

export const LANDING_PRO_FEATURES = [
  "Everything in Free",
  "Unlimited recipe imports",
  "Full macro & micro insights",
  "Weekly recap & trends",
  "Fasting & plan tools",
] as const;
