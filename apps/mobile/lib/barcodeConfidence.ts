/**
 * Honest Verified / Estimated tier for a scanned barcode product — feeds the
 * barcode result sheet's `<SearchResultConfidenceChip>` (search-results
 * redesign, ENG-817 / 2026-05-31).
 *
 * The rule itself is now the shared cross-platform classifier in
 * `src/lib/nutrition/barcodeConfidence.ts` (ENG-737, 2026-06-17) so web and
 * mobile cannot drift. This module is a thin re-export kept so existing mobile
 * call sites (`lib/verifyRecipe.ts`, `app/(tabs)/barcode.tsx`) and the
 * `tests/unit/barcodeConfidenceTier.test.ts` import path stay stable.
 */
export {
  barcodeConfidenceTier,
  type BarcodeConfidenceTier,
} from "@suppr/shared/nutrition/barcodeConfidence";
