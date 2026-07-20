/**
 * POST /api/cron/testflight-expiry-check
 *
 * PRA-015/IM-16 (ENG-1414, 2026-07-05 deep audit) — "Alarm 10" from
 * `docs/operations/alerting.md`. Weekly poll of the App Store Connect API's
 * newest TestFlight build; alerts loudly to Sentry when its 90-day
 * `expirationDate` is under 21 days out. Replaces the calendar-reminder-only
 * guard documented in `docs/operations/founder-safety-net.md` §3.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml, weekly) → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → sign an App Store Connect ES256 JWT (ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY)
 *                 → GET /v1/builds?filter[app]=ASC_APP_ID&sort=-uploadedDate&limit=1
 *                 → compute days remaining until expirationDate
 *                 → Sentry.captureMessage (level "error") if <21 days remain
 *                 → return summary JSON
 *
 * All implementation lives in `src/lib/server/testflightExpiryCheck.ts` —
 * Next.js's App Router route validator rejects non-handler exports from a
 * `route.ts` file, so the helpers live in the lib module + are imported here.
 *
 * Env vars — see the lib module's doc comment for full provisioning detail.
 *   - `SUPPR_CRON_SECRET` shared with all scheduled crons (GH Actions + Vercel, rotate together).
 *   - `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY` / `ASC_APP_ID` — App Store
 *     Connect API credentials, NOT YET PROVISIONED in Vercel as of 2026-07-20
 *     (see docs/decisions/2026-07-20-eng1414-production-readiness-hardening-tail.md).
 *     Until they're set this route returns a clean 200 skip, never a crash.
 */
import { NextResponse } from "next/server";
import { runTestflightExpiryCheckRoute } from "../../../../src/lib/server/testflightExpiryCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function POST(req: Request): Promise<NextResponse> {
  return runTestflightExpiryCheckRoute(req);
}

// Explicit 405 for GET — easier to debug than the default Next.js "GET not
// allowed" shape when someone hits the URL in a browser.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "POST with X-Cron-Secret header" },
    { status: 405 },
  );
}
