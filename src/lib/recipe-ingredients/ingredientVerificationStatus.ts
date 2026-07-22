/**
 * ingredientVerificationStatus — derive a single verification tier for a
 * recipe-ingredient row from the persisted `{is_verified, confidence,
 * source}` triple.
 *
 * Bug this solves (2026-05-02): the recipe-detail row UI used the
 * numeric `confidence` column alone to pick a label. When a user
 * manually verified a row through the verify flow, we wrote
 * `is_verified=true, source='USDA'` but did NOT update the stale
 * `confidence` (e.g. 0.69 from the original AI parse). The row then
 * rendered "69% · Partial match" + a Verify CTA forever, even though
 * the user had already resolved it.
 *
 * Policy:
 *   - If `is_verified` is true → "verified" (green dot, no Verify CTA)
 *   - Else if `source` is one of our trusted database sources (USDA /
 *     FatSecret / OFF / Edamam / manual) → "verified". Belt-and-braces
 *     for legacy rows where `is_verified` was not flipped despite the
 *     row coming from a verified source.
 *   - Else (row is NOT manually verified AND source is untrusted/
 *     unspecified) fall back to confidence buckets, capped at "partial"
 *     — this fallback can never reach "verified":
 *       confidence >= 0.55 → "partial"    (amber dot + Verify CTA)
 *       confidence > 0      → "estimated" (amber dot + Verify CTA)
 *       confidence null     → "unverified"
 *
 * ENG-1425 (2026-07-22, conf-2 audit finding): the fallback used to grant
 * "verified" (green, no Verify CTA) to an untrusted-source row on a bare
 * confidence >= 0.75 — e.g. an AI-parse row with no allow-listed source
 * would render identically to a human-verified USDA row, suppressing the
 * Verify CTA on a signal that was never validated as a "no further
 * verification needed" bar. Product call (not a guessed threshold): the
 * no-CTA "verified" tier is now reserved for `is_verified === true` or an
 * allow-listed trusted source — the confidence-only path tops out at
 * "partial". Trusted-source and is_verified classification are unchanged.
 *
 * ENG-1431 (2026-07-06 trust-vocabulary pass): the partial floor moved
 * 0.50 → 0.55 to align with `MIN_ACCEPT_CONFIDENCE`
 * (verifyConfidencePolicy.ts) — a row at confidence 0.52 used to render
 * "Partial match" here while simultaneously being rejected by the
 * accept-floor pipeline elsewhere, a real cross-system contradiction.
 * "Estimated" also moved from a red dot to amber (RecipeDetail.tsx's
 * `ING_TIER_COLOR`) — red is reserved for errors/destructive actions
 * per the 2026-07-01 calorie-ring red retirement (ENG-1296); a
 * low-confidence nutrition estimate is not an error state.
 *
 * Cross-platform: shared lib so web `RecipeDetail.tsx` and mobile
 * `apps/mobile/app/recipe/[id].tsx` derive identical tiers.
 */

export type IngredientVerificationTier =
  | "verified"
  | "partial"
  | "estimated"
  | "unverified";

const TRUSTED_SOURCES = new Set([
  "usda",
  "fatsecret",
  "off",
  "open food facts",
  "openfoodfacts",
  "edamam",
  "manual",
  "user",
  "custom",
  "barcode",
]);

function sourceIsTrusted(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = String(source).trim().toLowerCase();
  if (!s) return false;
  if (TRUSTED_SOURCES.has(s)) return true;
  // Tolerate label variants ("USDA · branded", "FatSecret search").
  if (s.startsWith("usda")) return true;
  if (s.startsWith("fatsecret")) return true;
  if (s.startsWith("off ") || s.startsWith("off·") || s.startsWith("off ·")) return true;
  if (s.startsWith("edamam")) return true;
  return false;
}

export function deriveIngredientVerificationTier(input: {
  isVerified: boolean | null | undefined;
  confidence: number | null | undefined;
  source: string | null | undefined;
}): IngredientVerificationTier {
  if (input.isVerified === true) return "verified";
  if (sourceIsTrusted(input.source)) return "verified";

  const c =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? input.confidence
      : null;
  if (c == null) return "unverified";
  // ENG-1425: capped at "partial" — this branch only runs for rows that
  // are neither manually verified nor from a trusted source, so a bare
  // confidence score (however high) must never grant the no-CTA
  // "verified" tier here.
  if (c >= 0.55) return "partial";
  if (c > 0) return "estimated";
  return "unverified";
}

/** Whether the row should surface a "Verify →" CTA. */
export function ingredientShouldShowVerifyCta(
  tier: IngredientVerificationTier,
): boolean {
  return tier === "partial" || tier === "estimated" || tier === "unverified";
}
