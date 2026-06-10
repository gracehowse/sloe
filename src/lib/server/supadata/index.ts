/**
 * Supadata acquisition layer (ENG-994) — SERVER-ONLY barrel.
 *
 * Do not import from `"use client"` components or `apps/mobile/` — the
 * `SUPADATA_KEY` must never reach a client bundle. Mobile gets the same
 * behaviour by calling the web `/api/recipe-import` route, which runs this
 * server-side.
 */
export {
  scrapeUrl,
  fetchTranscript,
  hasSupadataConfig,
  SUPADATA_DEFAULT_LANG,
  type SupadataScrapeResult,
  type SupadataTranscriptResult,
  type SupadataResult,
  type SupadataErrorCode,
  type FetchLike,
} from "./client";

export {
  acquireRecipeSource,
  setAcquisitionAdapter,
  resetAcquisitionAdapter,
  supadataAdapter,
  type AcquisitionAdapter,
  type AcquisitionResult,
  type AcquiredRecipeSource,
  type AcquisitionKind,
  type AcquisitionSource,
  type AcquisitionErrorReason,
  type AcquireOptions,
} from "./acquisitionAdapter";
