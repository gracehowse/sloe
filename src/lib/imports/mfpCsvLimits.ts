/**
 * Constants for the MFP CSV bulk-import surface (`/api/imports/mfp-csv`).
 *
 * Lives here (rather than next to the route) because Next 15 rejects
 * non-`POST`/`GET`/`runtime`/`maxDuration` exports from a `route.ts`
 * file at build time. Tests and any future client surface (e.g. a
 * Settings post-onboarding entry) import from this module.
 */

/** Max rows accepted in a single upload. UI splits files above this. */
export const MFP_IMPORT_ROW_CAP = 1000;

/** Max raw bytes accepted (~5 MB — comfortable for >1k rows). */
export const MFP_IMPORT_BYTE_CAP = 5 * 1024 * 1024;

/**
 * Confidence threshold for "use a matched food name in place of the
 * raw CSV food string" in any future background-enrichment pass. Set
 * deliberately high — anything softer risks silently overriding
 * user-confirmed MFP totals with weak fuzzy matches, which CLAUDE.md
 * prohibits. Now exactly aligned with the verify-pipeline accept floor
 * `MIN_ACCEPT_CONFIDENCE = MIN_MATCH_CONFIDENCE = 0.70` in
 * `verifyIngredients` (both raised to the published reject-< 0.70 band
 * in ENG-691, 2026-05-25).
 *
 * The synchronous import route (`POST /api/imports/mfp-csv`) does NOT
 * currently re-match CSV rows — see the decision doc at
 * `docs/decisions/2026-05-02-mfp-csv-import.md` for why. This constant
 * is exported for the deferred enrichment job to use.
 */
export const MFP_MATCH_CONFIDENCE_THRESHOLD = 0.7;
