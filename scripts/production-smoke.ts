/**
 * Lightweight production / preview smoke checks (no Playwright, no auth).
 *
 * Fires a handful of high-signal unauthenticated HTTP requests at the target
 * and asserts each returns its EXPECTED status (200 / 307-redirect / 401).
 * Status-code assertions only — no Playwright, no auth, no writes. Safe to run
 * against production on a schedule (see .github/workflows/production-smoke.yml).
 *
 * Every check here is validated against real https://getsloe.com so the monitor
 * never cries wolf: a failure means a genuine regression, not a stale check.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://getsloe.com npm run smoke:production
 */
const base = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

type Expectation =
  | { kind: "status"; status: number }
  | { kind: "redirect"; to: string }; // 3xx whose Location ends with `to`

type Check = {
  path: string;
  method: "GET" | "POST";
  expect: Expectation;
  /** Why this check exists / what breaking it means. */
  why: string;
};

/**
 * The canonical smoke surface. Ordered public → app-shell → billing → API.
 * Each expectation was confirmed against real prod on 2026-07-05.
 */
const CHECKS: Check[] = [
  // --- Public surfaces load (unauthenticated 200) ---
  { path: "/", method: "GET", expect: { kind: "status", status: 200 }, why: "landing page serves" },
  { path: "/login", method: "GET", expect: { kind: "status", status: 200 }, why: "auth entry serves" },
  { path: "/pricing", method: "GET", expect: { kind: "status", status: 200 }, why: "pricing surface serves" },
  { path: "/privacy", method: "GET", expect: { kind: "status", status: 200 }, why: "legal: privacy serves" },
  { path: "/terms", method: "GET", expect: { kind: "status", status: 200 }, why: "legal: terms serves" },
  { path: "/reset-password", method: "GET", expect: { kind: "status", status: 200 }, why: "password-reset flow serves" },

  // --- App shell gates anonymous users (redirect to /login) ---
  // A 200 here would mean the app leaked authed content to anonymous users, or
  // the auth gate broke — both are P0 regressions, so the redirect is asserted.
  { path: "/home", method: "GET", expect: { kind: "redirect", to: "/login" }, why: "core app route (Today) redirects anon → /login" },
  { path: "/account/billing", method: "GET", expect: { kind: "redirect", to: "/login" }, why: "billing surface gated behind auth" },

  // --- Billing / paywall API is deployed and guarded (401, no Stripe env needed) ---
  { path: "/api/stripe/subscription-status", method: "GET", expect: { kind: "status", status: 401 }, why: "billing status API deployed + rejects anon" },
  { path: "/api/stripe/checkout", method: "POST", expect: { kind: "status", status: 401 }, why: "checkout API deployed + rejects anon" },

  // --- Plan-import API deployed and guarded (401) ---
  { path: "/api/plan-import/parse", method: "POST", expect: { kind: "status", status: 401 }, why: "plan-import parse deployed + rejects anon" },
  { path: "/api/plan-import/extract", method: "POST", expect: { kind: "status", status: 401 }, why: "plan-import extract deployed + rejects anon" },
];

type Result = { check: Check; ok: boolean; status: number; detail: string };

async function run(check: Check): Promise<Result> {
  const url = `${base}${check.path}`;
  try {
    const res = await fetch(url, {
      method: check.method,
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    const status = res.status;

    if (check.expect.kind === "status") {
      const want = check.expect.status;
      const ok = status === want;
      return { check, ok, status, detail: ok ? `${status}` : `${status}, expected ${want}` };
    }

    // redirect expectation
    const want = check.expect.to;
    const isRedirect = status >= 300 && status < 400;
    const location = res.headers.get("location") ?? "";
    const ok = isRedirect && location.endsWith(want);
    return {
      check,
      ok,
      status,
      detail: ok
        ? `${status} → ${location}`
        : isRedirect
          ? `${status} → ${location || "(no Location)"}, expected redirect to …${want}`
          : `${status}, expected 3xx redirect to …${want}`,
    };
  } catch (e) {
    return {
      check,
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  console.log(`Production smoke: ${base}\n`);
  const results: Result[] = [];
  for (const check of CHECKS) {
    // Sequential (not Promise.all): keeps output ordered and avoids a burst of
    // parallel requests looking like a spike to any upstream rate limiter.
    const r = await run(check);
    results.push(r);
    const tag = r.ok ? "OK  " : "FAIL";
    console.log(`  [${tag}] ${check.method.padEnd(4)} ${check.path} → ${r.detail}  (${check.why})`);
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`\nsmoke:production: ${failures.length}/${results.length} check(s) failed.`);
    for (const f of failures) {
      console.error(`  - ${f.check.method} ${f.check.path}: ${f.detail}`);
    }
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed.`);
}

main();
