/**
 * Server-side helpers for the `POST /api/cron/supabase-advisor-check`
 * route. Split out of the route file because Next.js's App Router
 * route validator only allows the canonical handler exports
 * (`GET` / `POST` / `runtime` / `dynamic` / `revalidate` / ...) — extra
 * named exports on a `route.ts` fail the build with a misleading "not
 * a valid Route export field" error.
 *
 * Everything route-agnostic + testable lives here:
 *   - `safeCompare`        — constant-time string compare for the cron-secret gate
 *   - `deriveProjectRef`   — extract project ref from the public Supabase URL
 *   - `fetchAdvisors`      — Supabase Management API call (security or performance)
 *   - `emitAdvisorFinding` — Sentry capture with stable fingerprint
 *   - `runAdvisorCheck`    — full handler logic, dependency-injected for tests
 *
 * Source / rationale: ENG-509 alarm 6 (`docs/operations/alerting.md`).
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/** Constant-time string compare to avoid timing attacks on the cron secret. */
export function safeCompare(a: string, b: string): boolean {
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

/** `https://fnfgxsignmuepshbebrl.supabase.co` → `fnfgxsignmuepshbebrl`. */
export function deriveProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const m = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m?.[1] ?? null;
}

/** Fetch one advisor category. Throws on non-2xx so the caller surfaces a 502. */
export async function fetchAdvisors(
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

/** Emit a single finding to Sentry with stable fingerprint. */
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

/**
 * Full handler logic. Exported so the test harness can drive it
 * without HTTP, with injected `fetchAdvisors` + `emit` for stub
 * substitution.
 */
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
