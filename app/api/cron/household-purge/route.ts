/**
 * POST /api/cron/household-purge
 *
 * ENG-1359: the Netflix-model v1 disband flow (2026-05-01) flags a
 * household `disbanded_at` when its last member leaves, and the
 * `leaveHousehold` comment in `src/lib/household/householdClient.ts`
 * (and the migration that added the column) promised "a background job
 * (not yet shipped) hard-deletes after 30 days." That job never
 * existed — disbanded households (and everything cascading off them)
 * accumulated in production with no purge path. This route is that job.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml) → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → service-role client (bypasses RLS — disbanded
 *                   households have no members left to satisfy RLS)
 *                 → select households with disbanded_at <= now - 30d
 *                 → hard-delete them (FK CASCADE removes every
 *                   dependent row: household_members, household_meals,
 *                   household_invites, shopping_items; profiles.household_id
 *                   is SET NULL, not deleted)
 *                 → log counts only (no PII) for auditability
 *                 → return summary JSON
 *
 * All implementation lives in `src/lib/server/householdPurgeJob.ts` —
 * Next.js's App Router route validator rejects non-handler exports from
 * a `route.ts` file, so the helpers (safeCompare, runHouseholdPurge,
 * runHouseholdPurgeRoute) live in the lib module + are imported here.
 *
 * Env vars
 *   - `SUPPR_CRON_SECRET`         shared with all scheduled crons (GH Actions workflow + Vercel env, rotate together).
 *   - `SUPABASE_SERVICE_ROLE_KEY` service-role key — required to bypass RLS for the hard-delete.
 */
import { NextResponse } from "next/server";
import { runHouseholdPurgeRoute } from "../../../../src/lib/server/householdPurgeJob";
import { getSupabaseAdminClient } from "../../../../src/lib/supabase/serverAdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function POST(req: Request): Promise<NextResponse> {
  return runHouseholdPurgeRoute(req, getSupabaseAdminClient);
}

// Explicit 405 for GET — easier to debug than the default Next.js
// "GET not allowed" shape when someone hits the URL in a browser.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "POST with X-Cron-Secret header" },
    { status: 405 },
  );
}
