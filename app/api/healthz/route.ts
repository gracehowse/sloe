/**
 * GET /api/healthz
 *
 * ENG-1407 (2026-07-05 deep audit, production readiness, IM-06): the
 * cheapest possible "is prod up at 3am" check did not exist at all — no
 * healthz route, no external uptime monitor. This is the route half of that
 * fix; wiring an external monitor (UptimeRobot / BetterStack) against it is
 * a dashboard-only follow-up, tracked on the same ticket.
 *
 * Deliberately a pure liveness check — no DB round-trip, no external
 * dependency call. An uptime monitor pinging this route should answer
 * exactly one question ("is the Next.js process up and responding?") with
 * zero false-positive risk from a slow/degraded downstream (Supabase,
 * PostHog, etc.) — those have their own alarms. Unauthenticated by design:
 * external monitors have no way to carry a secret header.
 */
import { NextResponse } from "next/server";
import packageJson from "../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      version: packageJson.version,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
