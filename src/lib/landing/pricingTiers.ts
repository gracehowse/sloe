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

export type PricingTierName = "Free" | "Pro";

export type BillingPeriod = "monthly" | "annual";

export type PricingTier = {
  name: PricingTierName;
  tag: string;
  /** Monthly-view price (e.g. "£7.99"). Free shows "£0". */
  price: string;
  /** Monthly-view period suffix (e.g. "/month"). Free shows "forever". */
  period: string;
  /** Annual-view price (e.g. "£59.99"). Absent for Free. */
  annualPrice?: string;
  /** Annual-view period suffix — typically "/year". */
  annualPeriod?: string;
  /**
   * Optional fixed annual savings copy. When unset (the canonical path
   * post-P04 fix, 2026-05-05), the badge copy is computed from the
   * tier's `price` + `annualPrice` via `computeAnnualSavingsPct`. Set
   * this only if a tier needs to override the derived value (e.g. a
   * marketing-led "Save 50%" promotion that doesn't match the math).
   */
  annualSavings?: string;
  /** Tier key for checkout. `null` for Free. */
  checkoutTier: "pro" | null;
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
 *
 * PR-01 (audit 2026-04-28): Base tier removed per the 2026-04-27
 * strategic direction (memory `project_strategic_direction_2026-04-27.md`).
 * Pre-collapse there were three tiers (Free / Base / Pro); now Free
 * + Pro only. The four Base features (unlimited saves, multi-day
 * plans, shopping list from plan, publish) folded into Pro per
 * monetisation-architect's recommendation — Free still includes the
 * single-day plan + import + barcode + cook mode, so Pro's pitch is
 * "the full multi-day loop + AI logging" at a single price point.
 *
 * Internal `UserTier` enum keeps `"base"` for safety (any legacy
 * Stripe webhook event referencing a Base price ID writes
 * `profiles.user_tier = "base"` and the runtime treats that branch
 * as Free-equivalent for gating).
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
      // 2026-05-12 (premium-bar audit DC11 polish): surface the
      // adaptive-TDEE differentiator on the Free card. MFP / Lose It
      // / Cronometer all stop at the Mifflin-St-Jeor formula estimate.
      // Suppr learns your real maintenance over 7+ days of logging
      // and ≥ 3 weight entries, then replaces the formula with the
      // empirical TDEE. Strongest single Free-tier reason to switch.
      "Adaptive TDEE — your target re-tunes as we learn your real maintenance",
      "Recipe import from URL, Instagram, TikTok, YouTube",
      "Barcode scanning",
      "Cook mode with inline timers",
      "Fiber & water tracking",
      "Single-day meal plan",
      "AI photo logging (5 per week)",
      "Apple Health sync (iOS)",
      "Export your data (JSON)",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    tag: "The full meal-planning loop, plus unlimited AI logging.",
    price: "£7.99",
    period: "/month",
    annualPrice: "£59.99",
    annualPeriod: "/year",
    // Audit P04 (2026-05-05) — derived at render time from `price` +
    // `annualPrice` via `computeAnnualSavingsPct`. Was hardcoded
    // `"Save 37%"` in two places; on any price change the literal
    // would silently lie while the computed reference-line was still
    // correct.
    annualSavings: undefined,
    checkoutTier: "pro",
    // Audit 2026-05-22 subtractive: previous "Unlimited saved recipes
    // · AI photo + voice logging up to 100 per day" was duplicate of
    // three bullets in `features` (lines 127/131/132). The note slot
    // now reinforces Pro's data moat rather than re-stating bullets:
    // same USDA-backed source as Free, just with the unlock that Pro
    // is the only paid tier carrying. One pricing decision per row.
    nutritionNote: "Same USDA-backed nutrition · no daily cap on food logs",
    featHead: "Everything in Free, plus",
    features: [
      "Unlimited saved recipes",
      "Multi-day meal plans matched to your macro targets",
      "Shopping list from plan",
      "Publish recipes to the community",
      "AI photo meal recognition (up to 100/day)",
      "Voice food logging (up to 100/day)",
      "Priority email support",
    ],
    highlighted: true,
  },
];

/**
 * Parse a currency string like "£7.99" or "$59.99" into the numeric
 * amount. Returns `null` if the string can't be parsed. Mirrored from
 * `app/pricing/PricingTiersGrid.tsx` so callers without the page-level
 * helper (mobile paywall, tests, future shared call sites) don't need
 * to reinvent it.
 */
function parseCurrencyAmount(s: string | undefined): number | null {
  if (!s) return null;
  const match = s.match(/[\d.,]+/);
  if (!match) return null;
  const n = Number.parseFloat(match[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute the annual-savings percentage badge copy for a given tier
 * (audit P04, 2026-05-05). Centralising this means the badge string
 * tracks the source-of-truth `price` + `annualPrice` numbers — a
 * future price change refreshes the badge automatically instead of
 * silently lying while the reference line ("save N% vs £X/mo") stays
 * correct.
 *
 * Returns `null` for tiers without annual pricing (Free). Returns the
 * tier's manual `annualSavings` override when set, otherwise computes
 * from prices. The returned string is the badge copy ("Save 37%"),
 * not the raw percentage.
 */
export function computeAnnualSavingsBadge(tier: PricingTier): string | null {
  if (!tier.annualPrice) return null;
  if (tier.annualSavings) return tier.annualSavings;
  const annual = parseCurrencyAmount(tier.annualPrice);
  const monthly = parseCurrencyAmount(tier.price);
  if (annual == null || monthly == null || monthly <= 0) return null;
  const pct = Math.round((1 - annual / (monthly * 12)) * 100);
  if (pct <= 0) return null;
  return `Save ${pct}%`;
}
