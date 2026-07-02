/**
 * POST /api/cron/supabase-advisor-check
 *
 * Alarm 6 of the 6 production alarms (ENG-509). Daily-cron poll of
 * Supabase's Performance + Security advisors. Emits one Sentry
 * `captureMessage` per ERROR / WARN finding with a stable
 * `fingerprint` so Sentry groups recurring findings into a single
 * issue (no per-day spam) and resurfaces them only when the
 * underlying lint flips state.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml) → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → fetch Supabase Management API advisors
 *                 → filter ERROR/WARN, skip INFO (intentional state)
 *                 → Sentry.captureMessage per finding
 *                 → return summary JSON
 *
 * All implementation lives in `src/lib/server/supabaseAdvisorCheck.ts`
 * — Next.js's App Router route validator rejects non-handler exports
 * from a `route.ts` file ("not a valid Route export field" at build),
 * so the helpers (fetchAdvisors, emitAdvisorFinding, runAdvisorCheck,
 * deriveProjectRef, AdvisorLint type, safeCompare) live in the lib
 * module + are imported here.
 *
 * Env vars
 *   - `SUPPR_CRON_SECRET`        shared with all scheduled crons (GH Actions workflow + Vercel env, rotate together).
 *   - `SUPABASE_PAT`             Supabase Management API personal
 *                                access token (created at
 *                                https://supabase.com/dashboard/account/tokens).
 *   - `NEXT_PUBLIC_SUPABASE_URL` already present — project ref derived.
 */
import { NextResponse } from "next/server";
import { runAdvisorCheck } from "../../../../src/lib/server/supabaseAdvisorCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function POST(req: Request): Promise<NextResponse> {
  return runAdvisorCheck(req);
}

// Sentry-aware GET as an explicit 405 — easier to debug than the default
// Next.js "GET not allowed" shape when someone hits the URL in a browser.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "POST with X-Cron-Secret header" },
    { status: 405 },
  );
}
