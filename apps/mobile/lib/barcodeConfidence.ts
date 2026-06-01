/**
 * Honest Verified / Estimated tier for a scanned barcode product — feeds the
 * barcode result sheet's `<SearchResultConfidenceChip>` (search-results
 * redesign, ENG-817 / 2026-05-31).
 *
 * Lives in its own side-effect-free module (no Supabase client import) so the
 * classifier is unit-testable without standing up the data layer. Re-exported
 * from `lib/verifyRecipe.ts` for screen call sites.
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
  product: { verified?: boolean; basisCorrected?: boolean },
): BarcodeConfidenceTier {
  if (product.basisCorrected) return "estimated";
  return product.verified === true ? "verified" : "estimated";
}
