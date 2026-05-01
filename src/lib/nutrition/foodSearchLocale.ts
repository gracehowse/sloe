/**
 * Locale gating for the food-search "Brand not found? Try a barcode
 * scan" hint.
 *
 * Why this exists (2026-04-26 — FatSecret Premier Free upgrade):
 * Premier Free is a US-only dataset. UK/EU/AU users searching for a
 * regional brand (e.g. "Greggs sausage roll") will never hit a match
 * via FatSecret. Open Food Facts (OFF) carries good UK/EU brand
 * coverage but only via barcode lookup. So when search returns 0
 * results AND the user is non-US, surface a CTA to switch to the
 * barcode scanner.
 *
 * For US users we hide the hint outright — false-positive UK brand
 * suggestions to a US tester were the original concern.
 *
 * The helper accepts the resolved locale string (e.g. "en-GB",
 * "en-AU", "fr-FR") and returns whether the hint should render.
 *
 * Caller responsibility:
 *   - Web: pass `Intl.DateTimeFormat().resolvedOptions().locale`.
 *   - Mobile: pass `expo-localization`'s resolved locale or
 *     `Intl.DateTimeFormat().resolvedOptions().locale` (RN's Hermes
 *     supports `Intl` from SDK 53).
 *
 * Decision doc: `docs/decisions/2026-04-26-fatsecret-upgrade.md`.
 */

/**
 * Country / region codes considered "US dataset" — i.e. Premier Free
 * coverage is good enough to NOT show the OFF-fallback hint.
 *
 * The set is deliberately narrow. Anything outside this set falls
 * through to `non-us` and triggers the hint. We treat US-territories
 * (PR, GU, AS, VI, MP) as US since FatSecret's US dataset largely
 * covers their brand inventory too.
 */
const US_REGIONS = new Set<string>([
  "US",
  "PR", // Puerto Rico
  "GU", // Guam
  "AS", // American Samoa
  "VI", // US Virgin Islands
  "MP", // Northern Mariana Islands
]);

/**
 * Extract the region (uppercase, 2-letter ISO 3166-1 alpha-2) from a
 * BCP-47 locale string. Returns null if the locale has no region tag
 * (e.g. bare "en") — in that case the caller should default to
 * showing the hint (UK + EU + AU users will land here when their
 * browser only reports a bare language tag).
 */
export function regionFromLocale(locale: string | null | undefined): string | null {
  if (!locale || typeof locale !== "string") return null;
  // BCP-47 splits on `-` or `_`. Region is the 2-letter alpha-2
  // segment that follows the language tag (and an optional script
  // subtag). We scan for the first two-letter all-uppercase segment.
  const parts = locale.split(/[-_]/).map((p) => p.trim()).filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

/**
 * Returns true when the locale-aware "Try a barcode scan" empty-state
 * hint should render alongside the "No results" message.
 *
 * Rules:
 *   - US (and US territories): false (FatSecret Premier Free dataset
 *     is good enough; don't risk false-positive UK suggestions).
 *   - Any other region: true.
 *   - No region tag at all (bare "en", "es", etc.): true — defaulting
 *     to the safe fallback for non-US users with permissive browsers.
 *   - Null / empty locale: true — same reasoning.
 */
export function shouldShowBarcodeFallbackHint(locale: string | null | undefined): boolean {
  const region = regionFromLocale(locale);
  if (!region) return true;
  return !US_REGIONS.has(region);
}

/**
 * Test-only helper exposing the US-region set so tests don't have to
 * keep this in sync by hand.
 */
export const US_DATASET_REGIONS_FOR_TESTS: ReadonlySet<string> = US_REGIONS;
