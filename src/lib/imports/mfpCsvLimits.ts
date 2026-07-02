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
 * Confidence threshold for any future user-initiated "find a better
 * match" flow on an imported log entry. Set deliberately high —
 * anything softer risks asking users to swap their MFP-confirmed totals
 * for weak fuzzy matches, which CLAUDE.md prohibits. Pinned to the
 * published "high confidence" 0.70 trust band — deliberately STRICTER
 * than the live verify-pipeline accept floor (`MIN_ACCEPT_CONFIDENCE`
 * = 0.55 in `verifyConfidencePolicy`; D-05 proposed 0.70 but the
 * 2026-05-26 impact review shipped 0.55 — see that constant's doc).
 * ENG-1305 (2026-07-01): corrected this comment, which wrongly claimed
 * the live floor was 0.70. The 0.70 value HERE is intentional: swapping
 * user-confirmed totals warrants the strict band, not the accept floor.
 *
 * The synchronous import route (`POST /api/imports/mfp-csv`) does NOT
 * re-match CSV rows, and ENG-750 explicitly rejects background
 * low-confidence re-matching because imported rows have no stored
 * confidence and their macros are already user-confirmed in the source
 * app. If enrichment ships, it must be opt-in, per-entry, and confirmed
 * by the user before any swap is applied. See the decision doc at
 * `docs/decisions/2026-05-02-mfp-csv-import.md`.
 */
export const MFP_MATCH_CONFIDENCE_THRESHOLD = 0.7;
