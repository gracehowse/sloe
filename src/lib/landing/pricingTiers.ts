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
 *
 * **Currency guard (ENG-1442):** this file is GBP-only in practice —
 * `displayByCurrency.EUR` is unset on every tier — but the `PricingTier`
 * type carries a `displayByCurrency` per-currency slot so the SSOT
 * *can* render another currency once one is actually priced. Before
 * setting `STRIPE_PRICE_PRO_MONTHLY_EUR` / `STRIPE_PRICE_PRO_ANNUAL_EUR`
 * (`src/lib/stripe/resolveProStripePrice.ts`) in any environment:
 *   1. Decide the real EUR price (a pricing call, not an FX conversion)
 *      and populate `displayByCurrency.EUR` on the Pro tier below.
 *   2. Wire `PricingTiersGrid` (and any other price-rendering call site)
 *      to read `resolveTierDisplay(tier, currency)` instead of the flat
 *      GBP fields.
 * `assertEurSkuDisplayReadiness()` (`src/lib/stripe/eurSkuDisplayGuard.ts`,
 * wired into `scripts/verify-production-env.ts` + `src/instrumentation.ts`)
 * refuses to let the app boot if a EUR SKU env var is ever set while step
 * 1 hasn't happened — see
 * `docs/decisions/2026-07-20-eng1442-currency-display-guard.md`.
 */

import { FREE_SAVE_LIMIT } from "../../context/appData/constants";

export type PricingTierName = "Free" | "Pro";

export type BillingPeriod = "monthly" | "annual";

/**
 * Display currencies the pricing SSOT is aware of. `GBP` is the only
 * one with real numbers today — see `displayByCurrency` below.
 */
export type CurrencyCode = "GBP" | "EUR";

/**
 * Per-currency rendering strings for a tier — same shape as the legacy
 * flat `price`/`period`/`annualPrice`/`annualPeriod` fields, so a
 * currency-aware renderer can do `resolveTierDisplay(tier, currency)`
 * instead of a second parallel schema.
 */
export type CurrencyPriceDisplay = {
  price: string;
  period: string;
  annualPrice?: string;
  annualPeriod?: string;
};

export type PricingTier = {
  name: PricingTierName;
  tag: string;
  /** Monthly-view price (e.g. "£7.99"). Free shows "£0". GBP only —
   *  kept as the flat legacy field every existing call site reads.
   *  New currency-aware call sites should read `displayByCurrency`
   *  (via `resolveTierDisplay`) instead. */
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
  /**
   * ENG-1442 (MP-10/LEGAL-009) — per-currency display SSOT.
   *
   * `GBP` is always populated (it mirrors the flat `price`/`period`/
   * `annualPrice`/`annualPeriod` fields above — same numbers, one
   * source). `EUR` is deliberately **absent** on every tier today: no
   * real EUR-denominated price has been decided (this is a pricing
   * call, not a mechanical FX-rate conversion of the GBP numbers, and
   * this fix does not make that call — see the file-level doc block
   * below).
   *
   * This field's job is narrow: make the SSOT *capable* of carrying a
   * currency-correct display string once EUR is actually priced, so a
   * future renderer can call `resolveTierDisplay(tier, "EUR")` instead
   * of inventing a second schema. It does not, by itself, change what
   * `/pricing` renders — `PricingTiersGrid` still reads the flat GBP
   * fields today.
   *
   * Optional (not every fixture/test construction of `PricingTier`
   * sets it) — `resolveTierDisplay` and `isEurPricingDisplayReady`
   * both treat a missing/undefined entry as "not ready", never throw.
   */
  displayByCurrency?: Partial<Record<CurrencyCode, CurrencyPriceDisplay>>;
};

/**
 * ENG-1203 — the exact Free-column bullet merchandising custom macro
 * goals as a free MFP-switch win. Exported so `PricingTiersGrid` can
 * gate JUST this line behind `paywall_free_mfp_wins_v1` (default-on)
 * without a fragile inline string literal. Genuinely free: the
 * onboarding manual-targets card (`data-bridges.tsx`) lets any user set
 * all four kcal/P/C/F values to override the BMR estimate, with no Pro
 * gate. Phrasing mirrors the adjacent "Barcode scanning — free forever".
 */
export const FREE_CUSTOM_MACROS_FEATURE = "Custom macros — free forever";

/**
 * ENG-1461 — jargon-gloss product-wide extension (2026-07-06 copy verdict).
 * "Adaptive TDEE" leads the Free-tier differentiator bullet below; the
 * acronym is unglossed to a first-time reader (only MacroFactor refugees
 * recognise "TDEE"). "Adaptive" stays as the established feature-brand
 * prefix (matches the roadmap + Today surfaces); only the bare acronym
 * gets the plain-English gloss, same grammar as every other TDEE site
 * (`onboarding_jargon_gloss_v1`, shared with `figmaCopy.ts`). Exported so
 * `PricingTiersGrid` can swap just this bullet behind the flag, the same
 * way `paywall_free_mfp_wins_v1` swaps `FREE_CUSTOM_MACROS_FEATURE`.
 */
export const FREE_ADAPTIVE_TDEE_FEATURE_PLAIN =
  "Adaptive TDEE — your target re-tunes as we learn your real maintenance";
export const FREE_ADAPTIVE_TDEE_FEATURE_GLOSS =
  "Adaptive daily burn (TDEE) — your target re-tunes as we learn your real maintenance";

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
    // ENG-1442 — Free has no Stripe charge, so there's no shown/charged
    // mismatch risk here; EUR is still left unset for consistency with
    // Pro rather than inventing a "€0" that implies the other EUR
    // fields are ready.
    displayByCurrency: {
      GBP: { price: "£0", period: "forever" },
    },
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
      // Plain default; `PricingTiersGrid` swaps to
      // `FREE_ADAPTIVE_TDEE_FEATURE_GLOSS` behind `onboarding_jargon_gloss_v1`
      // (ENG-1461) the same way it swaps the custom-macros bullet.
      FREE_ADAPTIVE_TDEE_FEATURE_PLAIN,
      "Recipe import from URL, Instagram, TikTok, YouTube",
      // ENG-1203 — the two MFP-switch wins called out explicitly on the
      // Free column. MyFitnessPal paywalled barcode scanning + custom
      // macro goals in 2026 (the #1 cited exodus reasons); Suppr ships
      // both free, so they read as concrete switch reasons here. Both
      // are genuinely free in code — barcode is the always-unlocked Scan
      // chip (`TodayQuickLogStrip.tsx`, `locked: false`); custom macros
      // is the onboarding manual-targets card (`data-bridges.tsx`, no Pro
      // gate). The custom-macros line is gated on `/pricing` behind the
      // default-on `paywall_free_mfp_wins_v1` flag in `PricingTiersGrid`
      // (the barcode line predates the rule and stays un-gated).
      "Barcode scanning — free forever",
      FREE_CUSTOM_MACROS_FEATURE,
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
    // ENG-971 — honest billing: Pro AI photo + voice logging is capped at
    // 100/day each (the `api:photo-log` / voice buckets), not "unlimited".
    // The feature bullets below already say "(up to 100/day)"; the tag must
    // not contradict them. "AI logging" without the false "unlimited".
    tag: "The full meal-planning loop, plus AI photo and voice logging.",
    price: "£7.99",
    period: "/month",
    annualPrice: "£59.99",
    annualPeriod: "/year",
    // ENG-1442 (MP-10/LEGAL-009) — the tier that actually charges
    // through Stripe. EUR is intentionally left unset: no EUR price
    // has been decided, and `resolveProStripePriceId` (checkout route)
    // already resolves a EUR Stripe Price the instant
    // STRIPE_PRICE_PRO_{MONTHLY,ANNUAL}_EUR env vars are set — if this
    // stayed unset while those env vars were populated, a EU visitor
    // would see "£7.99" here and get charged the Stripe Price's EUR
    // amount, which is exactly the shown-£/charged-€ bug this ticket
    // fixes. `assertEurSkuDisplayReadiness()`
    // (`src/lib/stripe/eurSkuDisplayGuard.ts`) refuses to let the app
    // boot if that env/display combination ever occurs — see
    // docs/decisions/2026-07-20-eng1442-currency-display-guard.md.
    displayByCurrency: {
      GBP: { price: "£7.99", period: "/month", annualPrice: "£59.99", annualPeriod: "/year" },
    },
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

/**
 * ENG-1442 — resolve the display strings for a tier in a given
 * currency. Falls back to GBP when the requested currency isn't
 * populated (mirrors the GBP-fallback pattern `resolveProStripePriceId`
 * already uses for the Stripe Price id itself, in
 * `src/lib/stripe/resolveProStripePrice.ts` — "unconfigured currency
 * degrades to GBP" stays one consistent rule across the checkout-id
 * resolver and the display layer), then to the tier's flat legacy
 * fields for any `PricingTier` that predates `displayByCurrency`
 * (test fixtures, mainly — `tests/**` isn't covered by
 * `tsconfig.json`'s `include`, so nothing enforces the field there).
 *
 * Not called from `PricingTiersGrid` today — `/pricing` still reads
 * the flat GBP fields directly, unconditionally, because EUR has no
 * real display data to switch to yet. This exists so a future
 * currency-aware renderer has one correct function to call instead of
 * re-deriving the fallback chain inline.
 */
export function resolveTierDisplay(
  tier: PricingTier,
  currency: CurrencyCode,
): CurrencyPriceDisplay {
  const requested = tier.displayByCurrency?.[currency];
  if (requested) return requested;
  const gbp = tier.displayByCurrency?.GBP;
  if (gbp) return gbp;
  return {
    price: tier.price,
    period: tier.period,
    annualPrice: tier.annualPrice,
    annualPeriod: tier.annualPeriod,
  };
}

/**
 * ENG-1442 (MP-10/LEGAL-009) — the single readiness signal the EUR-SKU
 * startup guard checks (`checkEurSkuDisplayReadiness` in
 * `src/lib/stripe/eurSkuDisplayGuard.ts`). True once every
 * checkout-eligible tier (`checkoutTier !== null` — i.e. Pro, the only
 * tier a Stripe charge can actually happen on) has a populated
 * `displayByCurrency.EUR` entry.
 *
 * Free is deliberately excluded from the check: it never reaches
 * Stripe, so a missing EUR string there is a cosmetic gap, not a
 * billing-safety one — gating boot on it would block real EUR launches
 * on an unrelated, harmless omission.
 */
export function isEurPricingDisplayReady(): boolean {
  return PRICING_TIERS.filter((tier) => tier.checkoutTier !== null).every((tier) =>
    Boolean(tier.displayByCurrency?.EUR),
  );
}
