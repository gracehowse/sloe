/**
 * Honest Verified / Estimated tier for a scanned barcode product — the single
 * cross-platform classifier feeding the barcode result card's confidence chip
 * (search-results redesign, ENG-817 / 2026-05-31; web parity ENG-737).
 *
 * Lives in the shared `src/lib/nutrition/` spine (no Supabase / network import)
 * so the rule is unit-testable without the data layer AND identical on web and
 * mobile. Mobile re-exports this via `@suppr/shared/nutrition/barcodeConfidence`
 * (and onward through `lib/verifyRecipe.ts` for existing screen call sites);
 * web imports it directly. Do NOT fork this logic per platform.
 *
 * CLAUDE.md trust posture: "Verified" must be backed by a real signal, never a
 * UI default. A barcode row earns "verified" ONLY when the source row is
 * flagged verified (a curated / corrected community entry promoted to the
 * verified corpus). Raw Open Food Facts product data, unverified community
 * submissions, and any row whose per-100g basis we had to reconstruct
 * (`basisCorrected` — we no longer trust the published panel) are "estimated".
 */
export type BarcodeConfidenceTier = "verified" | "estimated";

export function barcodeConfidenceTier(
  product: {
    verified?: boolean;
    basisCorrected?: boolean;
    verificationStatus?: "pending" | "verified" | "rejected";
  },
): BarcodeConfidenceTier {
  if (product.basisCorrected) return "estimated";
  if (product.verificationStatus === "pending") return "estimated";
  return product.verified === true ? "verified" : "estimated";
}
