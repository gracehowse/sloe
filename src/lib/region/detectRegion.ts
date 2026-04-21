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
 * Inputs (precedence order):
 *   1. `CF-IPCountry` header — Cloudflare edge-injected ISO-3166-alpha-2.
 *      Trusted when present because the request passed through Cloudflare.
 *   2. `Accept-Language` — falls back to locale sniffing when no CF header
 *      exists (most local-dev / direct-to-Vercel paths).
 *   3. Default: GBP / en-GB / no VAT note — safe for unknown regions
 *      because Stripe checkout defaults to GBP today.
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
  // v1 — EUR SKUs not yet live. Show GBP amounts with a soft-landing
  // note and an inclusive-VAT disclosure (memo-compliant).
  return {
    currency: "EUR",
    locale: "en-EU",
    vatNote: "Prices include VAT",
    displayAmountsInGbp: true,
  };
}

function defaultRegion(): RegionInfo {
  return {
    currency: "GBP",
    locale: "en-GB",
    vatNote: "",
    displayAmountsInGbp: true,
  };
}
