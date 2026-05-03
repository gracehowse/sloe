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
 *   - Else fall back to confidence buckets:
 *       confidence >= 0.75 → "verified"
 *       confidence >= 0.50 → "partial"  (orange dot + Verify CTA)
 *       confidence > 0      → "estimated" (red dot + Verify CTA)
 *       confidence null     → "unverified"
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
  if (c >= 0.75) return "verified";
  if (c >= 0.5) return "partial";
  if (c > 0) return "estimated";
  return "unverified";
}

/** Whether the row should surface a "Verify →" CTA. */
export function ingredientShouldShowVerifyCta(
  tier: IngredientVerificationTier,
): boolean {
  return tier === "partial" || tier === "estimated" || tier === "unverified";
}
