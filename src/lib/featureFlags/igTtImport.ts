/**
 * Feature flag — Instagram / TikTok / YouTube share-sheet caption import.
 *
 * Default: OFF. The flag stays OFF in production until two upstream legal
 * conditions land:
 *
 *   1. The Suppr DMCA designated agent is registered with the US Copyright
 *      Office (https://www.copyright.gov/dmca-directory/). The form on
 *      `/dmca` and the takedown route at `/api/dmca-takedown` ship now so
 *      the registration can list a working notice channel; the FLAG MUST
 *      STAY OFF until that registration is filed.
 *
 *   2. `legal-reviewer` signs off on the privacy-notice text and the
 *      DMCA-form copy. See
 *      `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`
 *      for the full verdict and prerequisites.
 *
 * To enable in any environment, set `IG_TT_IMPORT_ENABLED=true` in that
 * environment's env vars. Production (Vercel) MUST NOT have this set
 * until the prerequisites above are met.
 *
 * The flag gates ONLY the new caption-text parsing path — i.e. the path
 * where the iOS share sheet hands Suppr the user-supplied caption text
 * alongside a URL. When the flag is OFF and an IG/TT/YouTube URL is
 * shared without caption text, the existing import behaviour is
 * unchanged.
 *
 * Server-only flag (no `NEXT_PUBLIC_` prefix). Mobile reads the flag
 * indirectly: it always sends caption text up to the server when the
 * share sheet provides it; the server route is what decides whether to
 * activate the caption path or fall through to the legacy URL path.
 */

export function isIgTtImportEnabled(): boolean {
  return process.env.IG_TT_IMPORT_ENABLED === "true";
}
