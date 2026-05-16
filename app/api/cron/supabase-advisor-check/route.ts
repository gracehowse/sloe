/**
 * POST /api/cron/supabase-advisor-check
 *
 * Alarm 6 of the 6 production alarms (ENG-509, source: 2026-05-14
 * production-readiness audit, runbook
 * `docs/operations/alerting.md`). Daily-cron poll of Supabase's
 * Performance + Security advisors. Emits a Sentry `captureMessage`
 * per ERROR / WARN finding, with a stable `fingerprint` so Sentry
 * groups recurring findings into a single issue (no per-day spam) and
 * resurfaces them only when the underlying lint flips state.
 *
 * Invocation chain:
 *   Vercel cron → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → Supabase Management API:
 *                     GET /v1/projects/{ref}/advisors/security
 *                     GET /v1/projects/{ref}/advisors/performance
 *                 → filter to level ∈ {ERROR, WARN} (skip INFO)
 *                 → Sentry.captureMessage per finding
 *                 → return summary JSON
 *
 * Env vars
 *   - `SUPPR_CRON_SECRET`   shared with all Vercel crons; auth gate.
 *   - `SUPABASE_PAT`        Supabase Management API personal access
 *                            token. Grace creates at
 *                            https://supabase.com/dashboard/account/tokens
 *   - `NEXT_PUBLIC_SUPABASE_URL` already present — project ref is
 *                            derived from the URL (no separate ref var
 *                            needed).
 *
 * Why ERROR/WARN only
 *   INFO advisors (e.g. RLS-enabled-no-policy on write-only event
 *   tables) are intentional state, not actionable noise. Emitting
 *   them would dilute the signal — alarm fatigue defeats the alarm.
 *   If a future contributor needs to alarm on INFO, gate behind a
 *   tag/category filter, don't widen the level filter wholesale.
 *
 * Why fingerprint dedupe (not per-run state)
 *   Sentry's grouping handles it for free. Each finding has a stable
 *   `cache_key`. Same cache_key → same Sentry issue. New finding =
 *   new Sentry issue = Grace gets notified via the standard alarm-1
 *   route. Resolved finding = Sentry issue stays resolved unless it
 *   regresses. No state to manage in our DB.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Constant-time string compare to avoid timing attacks on the cron secret. */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Shape of a single advisor lint as returned by the Supabase Management API. */
export interface AdvisorLint {
  name: string;
  title: string;
  level: "ERROR" | "WARN" | "INFO";
  facing?: string;
  categories?: string[];
  description?: string;
  detail?: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
  cache_key: string;
}

interface AdvisorResponse {
  lints?: AdvisorLint[];
}

/** Project-ref extraction: `https://fnfgxsignmuepshbebrl.supabase.co` → `fnfgxsignmuepshbebrl`. */
export function deriveProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const m = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m?.[1] ?? null;
}

/** Fetch one advisor category. Throws on non-2xx so the caller surfaces a 502. */
async function fetchAdvisors(
  projectRef: string,
  pat: string,
  type: "security" | "performance",
): Promise<AdvisorLint[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/run-query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Equivalent to the MCP `get_advisors` tool.
        query: `select * from lint.${type === "security" ? "security_advisor" : "performance_advisor"};`,
      }),
    },
  );
  // Fall back to the v1 advisors endpoint if run-query isn't available
  // (Supabase added the dedicated advisors endpoint mid-2024).
  if (res.status === 404) {
    const fallback = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/advisors/${type}`,
      { headers: { Authorization: `Bearer ${pat}` } },
    );
    if (!fallback.ok) {
      throw new Error(`Supabase advisor fetch failed: ${fallback.status} ${await fallback.text().catch(() => "")}`);
    }
    const json = (await fallback.json()) as AdvisorResponse;
    return json.lints ?? [];
  }
  if (!res.ok) {
    throw new Error(`Supabase advisor fetch failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as AdvisorResponse | AdvisorLint[];
  return Array.isArray(json) ? json : json.lints ?? [];
}

/** Emit a single finding to Sentry with stable fingerprint. Exported for tests. */
export function emitAdvisorFinding(finding: AdvisorLint): void {
  Sentry.captureMessage(`[Supabase advisor] ${finding.title}`, {
    level: finding.level === "ERROR" ? "error" : "warning",
    fingerprint: ["supabase-advisor", finding.cache_key],
    tags: {
      type: "supabase-advisor",
      advisor_level: finding.level,
      advisor_name: finding.name,
      facing: finding.facing ?? "unknown",
      category: finding.categories?.[0] ?? "unknown",
    },
    extra: {
      detail: finding.detail,
      remediation: finding.remediation,
      metadata: finding.metadata,
    },
  });
}

interface RunSummary {
  ok: boolean;
  securityCount: number;
  performanceCount: number;
  emittedCount: number;
  skippedInfoCount: number;
  durationMs: number;
}

/** Run handler — exported so the test harness can drive it without HTTP. */
export async function runAdvisorCheck(
  req: Request,
  fetchAdvisorsImpl: typeof fetchAdvisors = fetchAdvisors,
  emitImpl: (f: AdvisorLint) => void = emitAdvisorFinding,
): Promise<NextResponse> {
  const t0 = Date.now();

  // 1. Auth gate — shared-secret header.
  const expected = process.env.SUPPR_CRON_SECRET;
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "SUPPR_CRON_SECRET unset" },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!safeCompare(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Supabase Management API PAT.
  const pat = process.env.SUPABASE_PAT;
  if (!pat || pat.length === 0) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "SUPABASE_PAT unset" },
      { status: 503 },
    );
  }

  // 3. Derive project ref from the public URL — no extra env var needed.
  const projectRef = deriveProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!projectRef) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "Could not derive project ref from NEXT_PUBLIC_SUPABASE_URL" },
      { status: 503 },
    );
  }

  // 4. Fetch both advisor categories in parallel.
  let security: AdvisorLint[];
  let performance: AdvisorLint[];
  try {
    [security, performance] = await Promise.all([
      fetchAdvisorsImpl(projectRef, pat, "security"),
      fetchAdvisorsImpl(projectRef, pat, "performance"),
    ]);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "cron/supabase-advisor-check", phase: "fetch" },
    });
    return NextResponse.json(
      {
        ok: false,
        error: "advisor_fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // 5. Filter to ERROR / WARN; emit to Sentry; tally.
  let emitted = 0;
  let skipped = 0;
  for (const finding of [...security, ...performance]) {
    if (finding.level !== "ERROR" && finding.level !== "WARN") {
      skipped++;
      continue;
    }
    try {
      emitImpl(finding);
      emitted++;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "cron/supabase-advisor-check", phase: "emit", cache_key: finding.cache_key },
      });
    }
  }

  const summary: RunSummary = {
    ok: true,
    securityCount: security.length,
    performanceCount: performance.length,
    emittedCount: emitted,
    skippedInfoCount: skipped,
    durationMs: Date.now() - t0,
  };
  return NextResponse.json(summary);
}

export function POST(req: Request): Promise<NextResponse> {
  return runAdvisorCheck(req);
}

// Sentry-aware GET as an explicit 405 — easier to debug than the default Next
// "GET not allowed" shape when someone hits the URL in a browser.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "POST with X-Cron-Secret header" },
    { status: 405 },
  );
}
