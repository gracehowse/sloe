/**
 * Photo-log free-taster quota (2026-05-02).
 *
 * Source of truth for the daily free-tier photo-log limit. Imported
 * from:
 *  - `app/api/nutrition/photo-log/route.ts` — server-side enforcement
 *    via the `api:photo-log:free-quota` rate-limit bucket.
 *  - `apps/mobile/components/PhotoLogSheet.tsx` — optimistic "X free
 *    logs remaining today" line before the first response lands.
 *  - `src/app/components/suppr/photo-log-dialog.tsx` — same on web.
 *  - `tests/integration/photoLogRoute.test.ts` — pins the limit at
 *    the rate-limit-call assertion level.
 *
 * Kept as its own module rather than living inside the API route so
 * Next.js doesn't reject it as a non-route export, and so non-server
 * code (the mobile sheet, the web dialog) can import it without
 * dragging in `next/server` types.
 *
 * Decision doc: `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 */

/** Free + Base users get this many photo logs per rolling 24h before
 *  the AI paywall lands. 3 = breakfast / lunch / dinner — covers a
 *  realistic first-day evaluation loop without giving away the
 *  feature outright. Calibration; revisit on real funnel data. */
export const FREE_PHOTO_LOG_DAILY_LIMIT = 3;
