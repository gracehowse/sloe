/**
 * ENG-1305 — Open Food Facts staleness.
 *
 * OFF is a crowd-sourced, editable database; `last_modified_t` (Unix
 * seconds) is the last time ANY field on the product was edited — not
 * necessarily the nutrition facts specifically, but it's the only
 * freshness signal OFF exposes. Pre-fix, neither `searchProducts.ts` nor
 * `fetchProductByBarcode.ts` requested or checked it, so a product last
 * touched in 2019 was trusted exactly like one edited yesterday.
 *
 * Threshold rationale: packaged-food reformulation cycles run roughly
 * 2-3 years in practice (recipe/cost/health-driven relabelling). We flag
 * — not reject — anything older than that: a stale-but-still-accurate
 * entry is usually better than no OFF match at all, so this demotes
 * confidence (same treatment as `_basisCorrected`) rather than dropping
 * the row outright.
 */
export const OFF_STALE_THRESHOLD_MS = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years

/** `lastModifiedT` is Unix SECONDS (OFF's convention); `now` is epoch ms. */
export function isOffDataStale(
  lastModifiedT: number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (typeof lastModifiedT !== "number" || !Number.isFinite(lastModifiedT) || lastModifiedT <= 0) {
    // No timestamp published — can't assert freshness, but also can't
    // penalize a row for a field OFF simply didn't return. Not stale.
    return false;
  }
  return now - lastModifiedT * 1000 > OFF_STALE_THRESHOLD_MS;
}
