/**
 * Live RLS/security-advisor verification (ENG-1354).
 *
 * Why this exists
 * ----------------
 * 13 of 172 migrations touch RLS, yet before this script the only live
 * verification was `scripts/verify-eng1244-live-rls.mts` — a single
 * ticket-scoped script wired to nothing (not in `npm run ci`, not in any
 * GitHub Actions workflow). Policy correctness otherwise rested entirely on
 * eyeball review of SQL files. This script runs Supabase's own security
 * advisors (the linter behind the Supabase MCP `get_advisors` tool and the
 * Dashboard's Advisors page) against the LIVE linked project and fails
 * loudly if any ERROR-level lint is present — RLS-disabled tables,
 * RLS-enabled-no-policy, security-definer views callable by anon, etc.
 *
 * This is READ-ONLY. It never applies migrations or mutates schema — it
 * only runs the Supabase CLI's `db lint`, which executes advisory SQL
 * queries against `lint.*` views.
 *
 * Mechanism
 * ---------
 * Uses the Supabase CLI (`supabase link` + `supabase db lint --linked
 * --fail-on error`) rather than the Management API `run-query` endpoint
 * that `src/lib/server/supabaseAdvisorCheck.ts` uses — the CLI's
 * `--fail-on` flag gives us a load-bearing exit code from Supabase's own
 * tooling instead of us re-deriving pass/fail from parsing an undocumented
 * response shape. The existing Vercel cron
 * (`app/api/cron/supabase-advisor-check`) is a *separate*, complementary
 * check: it polls on a schedule and emits Sentry issues for ERROR **and**
 * WARN findings (a monitoring/alerting concern). This script is a
 * CI-visible, exit-code-gated ERROR-only gate — a red GitHub Actions run,
 * not a Sentry issue someone has to notice.
 *
 * Required env (repo secrets in CI; `.env.local` for local runs):
 *   - SUPABASE_ACCESS_TOKEN  Supabase CLI personal access token (Management
 *                            API auth). Create at
 *                            https://supabase.com/dashboard/account/tokens.
 *                            Scope: read is sufficient for `db lint`.
 *   - SUPABASE_PROJECT_REF   The live project ref (e.g. the subdomain in
 *                            NEXT_PUBLIC_SUPABASE_URL — see deriveProjectRef
 *                            below for the same derivation
 *                            supabaseAdvisorCheck.ts uses, so this can also
 *                            be omitted if NEXT_PUBLIC_SUPABASE_URL is set).
 *
 * Usage:
 *   node --import tsx scripts/verify-rls-advisors.mts
 *   npm run verify:rls-advisors
 *
 * Exit codes:
 *   0  no ERROR-level advisor findings
 *   1  at least one ERROR-level finding, OR the CLI could not run
 *      (missing creds, link failure, connection failure) — fails CLOSED,
 *      never silently passes when verification didn't actually happen.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");

/** `https://fnfgxsignmuepshbebrl.supabase.co` → `fnfgxsignmuepshbebrl`. */
function deriveProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const m = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m?.[1] ?? null;
}

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function main() {
  console.log("ENG-1354 live RLS/security-advisor verification\n");

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    fail(
      "SUPABASE_ACCESS_TOKEN is not set. This script needs a Supabase " +
        "Management API personal access token (create at " +
        "https://supabase.com/dashboard/account/tokens) to authenticate the " +
        "Supabase CLI non-interactively. Set it as a repo secret in CI or in " +
        ".env.local for local runs. Refusing to silently pass — live " +
        "verification did not run.",
    );
  }

  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    deriveProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!projectRef) {
    fail(
      "Could not determine the Supabase project ref. Set SUPABASE_PROJECT_REF " +
        "explicitly, or NEXT_PUBLIC_SUPABASE_URL (ref is derived from its " +
        "subdomain). Refusing to silently pass — live verification did not run.",
    );
  }

  console.log(`Project ref: ${projectRef}`);
  console.log("Linking Supabase CLI to the live project (read-only)...");

  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken };

  const link = spawnSync("supabase", ["link", "--project-ref", projectRef], {
    encoding: "utf8",
    env,
  });
  if (link.error) {
    fail(
      `Failed to invoke 'supabase link': ${link.error.message}. Is the Supabase CLI installed?`,
    );
  }
  if (link.status !== 0) {
    console.error(link.stdout);
    console.error(link.stderr);
    fail(
      `'supabase link --project-ref ${projectRef}' exited ${link.status}. ` +
        "Check SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF are correct.",
    );
  }
  console.log("Linked.\n");

  console.log(
    "Running `supabase db lint --linked --fail-on error` (security + " +
      "performance advisors, all schemas)...\n",
  );

  // Read-only: `db lint` runs SELECT-only advisory queries against the
  // `lint.*` schema. It never applies migrations or mutates the linked
  // project's schema.
  const lint = spawnSync(
    "supabase",
    ["db", "lint", "--linked", "--fail-on", "error", "--level", "warning"],
    { encoding: "utf8", env },
  );
  if (lint.error) {
    fail(`Failed to invoke 'supabase db lint': ${lint.error.message}.`);
  }

  const output = `${lint.stdout ?? ""}\n${lint.stderr ?? ""}`;
  console.log(lint.stdout);
  if (lint.stderr) console.error(lint.stderr);

  const errorLines = output
    .split("\n")
    .filter((line) => /\bERROR\b/.test(line));

  if (lint.status !== 0) {
    console.error(
      `\n[FAIL] supabase db lint exited ${lint.status} — ERROR-level advisor ` +
        `finding(s) present on the LIVE project.`,
    );
    if (errorLines.length > 0) {
      console.error("\nERROR-level lines from lint output:");
      for (const line of errorLines) console.error(`  ${line.trim()}`);
    }
    console.error(
      "\nFix: open the Supabase Dashboard → Advisors (or re-run " +
        "`supabase db lint --linked` locally) to see full remediation " +
        "guidance per finding, then ship a migration. Do NOT ignore or " +
        "suppress — these are RLS/security gaps on the live database.",
    );
    process.exit(1);
  }

  console.log("\n[PASS] No ERROR-level Supabase advisor findings on the live project.");
  process.exit(0);
}

main();
