/**
 * Pricing tiers SSOT (leaf — no `@/…` aliases).
 *
 * Lives alongside `./nutritionSources` as a mobile-safe leaf so the
 * React Native app can `import { PRICING_TIERS }` directly with a
 * relative path, without pulling `src/lib/landing/content.ts`' full
 * dependency graph (which uses `@/…` aliases that don't resolve in
 * `apps/mobile/tsconfig.json`).
 *
 * `content.ts` re-exports everything here so web consumers keep
 * using the single landing entry-point. If the web tests
 * (`landingParity.test.tsx`) find a pricing-shape regression, the
 * fix lives in this file — not in `content.ts`.
 *
 * See `docs/decisions/2026-04-19-pricing-v1.md` for the pricing
 * decisions these values encode.
 */

import { FREE_SAVE_LIMIT } from "../../context/appData/constants";

export type PricingTierName = "Free" | "Base" | "Pro";

export type BillingPeriod = "monthly" | "annual";

export type PricingTier = {
  name: PricingTierName;
  tag: string;
  /** Monthly-view price (e.g. "£3.99"). Free shows "£0". */
  price: string;
  /** Monthly-view period suffix (e.g. "/month"). Free shows "forever". */
  period: string;
  /** Annual-view price (e.g. "£29.99"). Absent for Free. */
  annualPrice?: string;
  /** Annual-view period suffix — typically "/year". */
  annualPeriod?: string;
  /** Annual saving badge copy (e.g. "Save 37%"). */
  annualSavings?: string;
  /** Tier key for checkout. `null` for Free. */
  checkoutTier: "base" | "pro" | null;
  /** Bullet used on /pricing as a small tier summary. */
  nutritionNote: string;
  /** First line shown above the feature list ("Everything in …, plus"). */
  featHead?: string;
  features: string[];
  highlighted: boolean;
};

/**
 * Pricing matches the actual gating in code. Any feature claimed
 * in a tier must have a real gate (server check or client guard);
 * claims without a gate are treated as monetisation bugs and are
 * tracked in `docs/product/landing-maintenance.md`.
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    tag: "Track meals and see verified macros.",
    price: "£0",
    period: "forever",
    checkoutTier: null,
    nutritionNote: "Sourced from USDA FoodData Central",
    features: [
      `Save up to ${FREE_SAVE_LIMIT} recipes`,
      "Browse community recipes",
      "Macro tracking with confidence scores",
      "Recipe import from URL, Instagram, TikTok, YouTube",
      "Barcode scanning",
      "Cook mode with inline timers",
      "Fiber & water tracking",
      "Single-day meal plan",
      "Apple Health sync (iOS)",
      "Export your data (JSON)",
    ],
    highlighted: false,
  },
  {
    name: "Base",
    tag: "The full meal-planning loop.",
    price: "£3.99",
    period: "/month",
    annualPrice: "£29.99",
    annualPeriod: "/year",
    annualSavings: "Save 37%",
    checkoutTier: "base",
    nutritionNote: "Unlimited recipes + multi-day planning",
    featHead: "Everything in Free, plus",
    features: [
      "Unlimited saved recipes",
      "Multi-day meal plans matched to your macro targets",
      "Shopping list from plan",
      "Publish recipes to the community",
    ],
    highlighted: true,
  },
  {
    name: "Pro",
    tag: "Log by photo and voice, faster.",
    price: "£7.99",
    period: "/month",
    annualPrice: "£59.99",
    annualPeriod: "/year",
    annualSavings: "Save 37%",
    checkoutTier: "pro",
    nutritionNote: "AI photo & voice logging",
    featHead: "Everything in Base, plus",
    features: [
      "AI photo meal recognition (100/day)",
      "Voice food logging (100/day)",
      "Priority email support",
    ],
    highlighted: false,
  },
];
