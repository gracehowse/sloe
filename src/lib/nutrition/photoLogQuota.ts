/**
 * Photo-log free-taster quota (2026-05-02).
 *
 * Single source of truth for the rolling-7-day free-tier photo-log
 * limit. Imported from:
 *  - `app/api/nutrition/photo-log/route.ts` — server-side enforcement
 *    via the `api:photo-log:free-quota` rate-limit bucket (separate
 *    from the existing `api:photo-log` Pro 100/day bucket).
 *  - `apps/mobile/components/PhotoLogSheet.tsx` — optimistic "X free
 *    logs remaining this week" line before the first response lands,
 *    then the authoritative `freeQuotaRemaining` from the response
 *    takes over.
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

/**
 * Free + Base users get this many photo logs per rolling 7 days
 * (168 hours) before the AI paywall lands.
 *
 * 5 covers a realistic first-week evaluation loop without giving the
 * feature away outright — typically: snap breakfast, snap lunch, snap
 * a doubt-case, then re-test 1-2 days later. Tap 6 returns 403 and
 * routes to the in-flow `AiPaywallSheet`/`AiPaywallDialog` whose copy
 * references the user's just-experienced-and-exhausted quota.
 *
 * Calibration; revisit on real funnel data after one cohort week.
 */
export const FREE_PHOTO_LOG_WEEKLY_LIMIT = 5;

/**
 * Window over which `FREE_PHOTO_LOG_WEEKLY_LIMIT` applies. Rolling
 * 7 days = 168 hours = 604_800_000 ms. The underlying rate-limit
 * infra (`src/lib/server/rateLimit.ts`) uses Upstash sliding-window
 * when configured, in-memory fixed-window in dev — both honour this
 * `windowMs` value.
 */
export const FREE_PHOTO_LOG_WINDOW_MS = 7 * 24 * 60 * 60_000;
