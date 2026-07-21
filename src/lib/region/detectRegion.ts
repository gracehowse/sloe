/**
 * Region detection — server-side helper used by `/pricing` and any
 * future commerce surface that needs to render region-aware currency +
 * VAT disclosure.
 *
 * H7 (2026-04-21) — before this helper, `/pricing` rendered GBP-only
 * with no VAT note for any visitor. That's a bug against the two
 * non-negotiables recorded in product memory:
 *   - "Pricing must be region-aware" (project_region_aware_pricing)
 *   - "Consumer VAT posture — UK and EU" (decisions/2026-04-19) —
 *     non-established supplier rules apply regardless of Cayman /
 *     Delaware merchant posture; UK/EU surfaces must say
 *     "Prices include VAT".
 *
 * Scope of this helper (v1):
 *   - Pick a currency enum + locale + VAT note from request headers.
 *   - Multi-currency *pricing* (EUR/USD numerical amounts) is NOT yet
 *     wired — the Stripe price IDs only exist in GBP today. Until we
 *     ship EU / US Stripe prices, EU visitors see GBP amounts with an
 *     explicit "EU pricing coming soon — current prices in GBP" note.
 *     The UK surface always renders GBP.
 *
 *     ENG-1442 (MP-10/LEGAL-009, resolved 2026-07-20): the pricing SSOT
 *     (`PRICING_TIERS` in `src/lib/landing/pricingTiers.ts`) now has a
 *     `displayByCurrency` slot per tier so it CAN carry a real EUR
 *     string once one is priced, and `assertEurSkuDisplayReadiness()`
 *     (`src/lib/stripe/eurSkuDisplayGuard.ts`) refuses to let the app
 *     boot if a EUR Stripe Price env var is ever set before that
 *     happens. Actually launching EUR pricing — deciding the real €
 *     numbers and wiring `PricingTiersGrid` to render them — is still
 *     not done and has no open ticket; it's a future pricing decision,
 *     not a gap. See
 *     docs/decisions/2026-07-20-eng1442-currency-display-guard.md.
 *
 * Inputs (precedence order):
 *   1. `CF-IPCountry` header — Cloudflare edge-injected ISO-3166-alpha-2.
 *      Trusted when present because the request passed through Cloudflare.
 *   2. `Accept-Language` — falls back to locale sniffing when no CF header
 *      exists (most local-dev / direct-to-Vercel paths).
 *   3. Default: USD / en-US / no VAT note. ENG-1441 (2026-07-21):
 *      previously this branch returned GBP — mislabelling the largest
 *      single visitor cohort (US, and every other non-UK/non-EU region)
 *      as GBP with no indication their currency wasn't recognised at
 *      all. USD is a DISPLAY/label change only — `displayAmountsInGbp`
 *      stays `true` because there is no USD Stripe Price object yet
 *      (`CheckoutCurrency` in `src/lib/stripe/resolveProStripePrice.ts`
 *      is `"GBP" | "EUR"` — no USD SKU exists). Checkout is unaffected:
 *      `resolveProStripePriceId` already treats any non-EUR currency as
 *      GBP, so tagging the default region "USD" instead of "GBP"
 *      changes zero Stripe-side behaviour, only the region label +
 *      the "pricing coming soon" note surfaced via
 *      `resolveRegionPricingNote` below (mirrors the EUR
 *      `isEurStripePricingConfigured()` gate ENG-1442 already shipped —
 *      same "recognise the region, be honest the amount is still GBP"
 *      pattern, now applied to the cohort that was previously silently
 *      mislabelled rather than flagged). Launching real USD pricing
 *      (a pricing decision + Stripe USD Price ids + a
 *      `displayByCurrency.USD` slot, same readiness-guard shape as
 *      `eurSkuDisplayGuard.ts`) is separate, un-started product work —
 *      this change does not attempt it and does not fabricate USD
 *      numbers by converting the GBP figures.
 *
 * Region → currency map is deliberately coarse (UK vs EU vs other). A
 * country like Norway / Switzerland isn't in the EU but we treat it as
 * "EU" for VAT-disclosure purposes because the consumer-VAT memo lumps
 * "EU-adjacent" under the same inclusive-pricing rule until the legal
 * memo comes back with finer detail.
 */

/** Supported currency codes. Adding USD requires a Stripe USD price id. */
export type RegionCurrency = "GBP" | "EUR" | "USD";

/** Region detection result. `vatNote` is rendered verbatim alongside
 *  the pricing card; empty string means "no note" (default surface). */
export type RegionInfo = {
  currency: RegionCurrency;
  locale: string;
  /** Short inline disclosure. Empty string = render nothing. */
  vatNote: string;
  /**
   * True when the detected region is entitled to display-parity but the
   * *amounts* are still GBP (v1 limitation — no EUR Stripe SKU yet).
   * The pricing page renders a "EU pricing coming soon — current prices
   * in GBP" explainer when this flag is set so EU visitors aren't
   * surprised at Stripe checkout.
   */
  displayAmountsInGbp: boolean;
};

/** EU member states + EEA/adjacent that we treat as EU for VAT purposes.
 *  Kept narrow enough that a future VAT-memo refinement can split them.
 *  ISO-3166-alpha-2 codes. */
const EU_COUNTRY_CODES = new Set<string>([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA / EU-adjacent — same VAT treatment for inclusive-pricing v1.
  "IS", "LI", "NO", "CH",
]);

const UK_COUNTRY_CODES = new Set<string>(["GB", "UK", "IM", "GG", "JE"]);

/** Headers shape — reads as string-or-null so callers can pass
 *  `Headers` or a plain record. */
export type RegionHeaders = {
  get: (name: string) => string | null;
};

/** Main entry point. Pure — given identical headers, returns identical
 *  output. Safe to call at request time inside a React Server Component. */
export function detectRegion(headers: RegionHeaders): RegionInfo {
  // 1. Trust CF-IPCountry when present.
  const cfCountry = (headers.get("cf-ipcountry") ?? "").trim().toUpperCase();
  if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1") {
    if (UK_COUNTRY_CODES.has(cfCountry)) return ukRegion();
    if (EU_COUNTRY_CODES.has(cfCountry)) return euRegion();
    return defaultRegion();
  }

  // 2. Fall back to Accept-Language. Parse first locale token only.
  const accept = headers.get("accept-language") ?? "";
  const primaryTag = accept
    .split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (primaryTag) {
    // Examples: "en-gb", "de-de", "fr", "en-us".
    const parts = primaryTag.split("-");
    const regionPart = parts[1]?.toUpperCase();
    const langPart = parts[0];
    if (regionPart) {
      if (UK_COUNTRY_CODES.has(regionPart)) return ukRegion();
      if (EU_COUNTRY_CODES.has(regionPart)) return euRegion();
    } else if (langPart) {
      // Language-only tag — infer coarsely. `en` alone is ambiguous so
      // we don't treat it as UK; leave to default. A dedicated EU
      // language tag (de / fr / es / it / nl / pl / sv / da / fi / pt)
      // is a decent proxy for EU visitor when no region subtag is sent.
      const EU_LANG_HINTS = new Set([
        "de", "fr", "es", "it", "nl", "pl", "sv", "da", "fi", "pt", "cs",
        "el", "hu", "ro", "sk", "sl", "bg", "hr", "et", "lv", "lt", "mt",
      ]);
      if (EU_LANG_HINTS.has(langPart)) return euRegion();
    }
  }

  // 3. Default.
  return defaultRegion();
}

function ukRegion(): RegionInfo {
  return {
    currency: "GBP",
    locale: "en-GB",
    vatNote: "Prices include VAT",
    displayAmountsInGbp: true,
  };
}

function euRegion(): RegionInfo {
  // v1 — EUR SKUs optional (`STRIPE_PRICE_PRO_*_EUR`). Checkout picks
  // them when configured; until then show GBP amounts + soft-landing note.
  return {
    currency: "EUR",
    locale: "en-EU",
    vatNote: "Prices include VAT",
    displayAmountsInGbp: true,
  };
}

function defaultRegion(): RegionInfo {
  // ENG-1441 (2026-07-21) — was `currency: "GBP", locale: "en-GB"`. See
  // the file-level doc comment: this is a label change (the default
  // cohort — US and every other non-UK/non-EU region — is now tagged
  // USD instead of silently GBP), NOT a pricing change.
  // `displayAmountsInGbp: true` is unchanged — the rendered digits stay
  // the flat GBP `PRICING_TIERS` fields until real USD pricing ships.
  return {
    currency: "USD",
    locale: "en-US",
    vatNote: "",
    displayAmountsInGbp: true,
  };
}

/**
 * ENG-33 (2026-05-13): the inclusive-VAT note must only be rendered
 * to UK/EU visitors when Stripe Tax is actually computing VAT —
 * otherwise we're claiming "Prices include VAT" while the user pays
 * the sticker price at checkout without VAT, which is misleading.
 *
 * This helper takes the raw note from `detectRegion()` plus the
 * `STRIPE_TAX_ENABLED` flag and returns the note that should
 * actually be rendered. When the flag is off, the note is
 * suppressed for everyone — UK/EU visitors fall through to the
 * default tax-exclusive disclosure copy. Once the flag flips and
 * Stripe dashboard has `tax_behavior=inclusive` on each Price
 * object, the note passes through unchanged.
 *
 * Pure helper — pinned by `tests/unit/resolveRenderedVatNote.test.ts`.
 */
export function resolveRenderedVatNote(
  rawVatNote: string,
  stripeTaxEnabled: boolean,
): string {
  if (!stripeTaxEnabled) return "";
  return rawVatNote;
}

/**
 * ENG-1441 (2026-07-21) — best-effort region guess for client
 * components that have no request headers to read: the marketing
 * landing page (`app/(landing)/LandingPage.tsx`, kept fully static for
 * viral-traffic TTFB per the 2026-05-15 decision recorded in
 * `app/page.tsx` — calling `headers()`/`cookies()` in any Server
 * Component on that route would opt it back into dynamic rendering,
 * reverting that optimisation) and the in-app upgrade dialog
 * (`UpgradePaywallDialog`, mounted from multiple call sites with no
 * single Server Component choke point, and explicitly barred from
 * self-fetching per D12 §6.3 — "no loading spinner on an intent-driven
 * modal").
 *
 * Reuses `detectRegion` itself rather than a second classification
 * path (legal P0 — same rule `subscriptionCardView`'s region branch
 * follows) by feeding it a synthetic `RegionHeaders` whose
 * `accept-language` is `navigator.language`. This is the exact pattern
 * already shipped in `SubscriptionCard.tsx`'s local `detectRegionClient`
 * (ENG-748 #11) — extracted here so it has one definition instead of
 * three near-identical copies once the landing page + dialog need it
 * too. `SubscriptionCard.tsx` now imports this instead of its own copy.
 *
 * Weaker than server-side `detectRegion`: it never sees `CF-IPCountry`
 * (the trusted edge-geo signal), only the browser's reported language,
 * so a UK visitor on an `en-US`-locale browser reads as default. That
 * trade-off is deliberate — it's a display-only VAT-note / "pricing
 * coming soon" label; the actual charged amount + currency is always
 * resolved authoritatively server-side in the Stripe checkout route
 * (`detectRegion(req.headers)`), which this helper never touches.
 *
 * SSR-safe: returns the default region when `navigator` is unavailable
 * (this runs during Next's prerender pass for any `"use client"`
 * component that also renders on the server before hydration).
 */
export function detectRegionFromNavigatorLanguage(): RegionInfo {
  if (typeof navigator === "undefined") {
    return detectRegion({ get: () => null });
  }
  const lang = navigator.language || "";
  return detectRegion({
    get: (name: string) => (name.toLowerCase() === "accept-language" ? lang : null),
  });
}

/**
 * ENG-1441 (2026-07-21) — the "pricing coming soon" banner shown above
 * a tier grid for a region whose Stripe SKU isn't real yet. Extracted
 * from the inline ternary `/pricing/page.tsx` already used for EUR
 * (ENG-1442) so the landing page + upgrade dialog can share the exact
 * same copy/logic instead of drifting three separate copies of it.
 *
 * `eurPricingReady` is `isEurStripePricingConfigured()`
 * (`src/lib/stripe/resolveProStripePrice.ts`) — passed in rather than
 * imported here so this region-detection module doesn't reach into the
 * Stripe SKU module (kept as a leaf-ish, narrowly-scoped file).
 *
 * USD has no readiness concept to check — there is no
 * `STRIPE_PRICE_PRO_*_USD` env var and no `isUsdStripePricingConfigured`
 * (see the `defaultRegion` doc comment above): the note is unconditional
 * whenever the resolved currency is USD, until real USD pricing ships.
 */
export function resolveRegionPricingNote(
  currency: RegionCurrency,
  opts: { eurPricingReady: boolean },
): string {
  if (currency === "EUR" && !opts.eurPricingReady) {
    return "EU pricing coming soon — current prices in GBP";
  }
  if (currency === "USD") {
    return "US pricing coming soon — current prices in GBP";
  }
  return "";
}
