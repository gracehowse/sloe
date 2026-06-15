/**
 * TikTok / Reel parse-rate audit harness — ENG-7 / ENG-670.
 *
 * Fires a battery of real Reel URLs at the live `/api/recipe-import` route,
 * records per-URL outcome (ok / error code / duration / imageUsed), and
 * writes a dated report. This is the evidence the viral-push gate reads:
 * ≥90% successful parse over 100 Reels, three consecutive green days, before
 * the import wedge opens on 2026-07-01. Full gate definition:
 * `docs/operations/viral-push-gate.md`.
 *
 * SAFETY / SCOPE:
 *   - Env-guarded. Exits 0 (no-op) unless `AUDIT_TIKTOK_REELS=1` is set, and
 *     refuses to run in CI (`CI` truthy). It exercises live AI + Supadata
 *     quota — never let it run on a push.
 *   - Auth: signs in the throwaway audit account (NOT Grace's daily-driver)
 *     via Supabase password sign-in, exactly like `scripts/verify-gate0-db.mts`,
 *     and sends the access token as `Authorization: Bearer`.
 *   - Resilient: one URL failing (timeout, network, bad response) never kills
 *     the run — it's recorded as a failure and the loop continues.
 *
 * Usage:
 *   AUDIT_TIKTOK_REELS=1 npx tsx scripts/audit-tiktok-reels.ts [urls.json]
 *
 *   urls.json defaults to scripts/fixtures/reel-urls.sample.json (placeholders).
 *   Replace that file with Grace's curated 100-Reel list before a gate read.
 *
 * Env:
 *   AUDIT_TIKTOK_REELS=1                 (required to run)
 *   AUDIT_TIKTOK_BASE_URL                (default http://localhost:3000)
 *   REEL_AUDIT_EMAIL / REEL_AUDIT_PASSWORD  (throwaway audit account)
 *   NEXT_PUBLIC_SUPABASE_URL / *_ANON_KEY   (from .env.local)
 *   NEXT_PUBLIC_POSTHOG_KEY              (optional — enables per-attempt events)
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { serverTrack } from "@/lib/analytics/serverTrack";
import { PERSONA_FORBIDDEN_EMAILS } from "./_lib/personaSeed";
import {
  aggregateAttempts,
  classifyResponse,
  renderReport,
  runMeetsGateThreshold,
  GATE_TARGET_SAMPLE_SIZE,
  GATE_SUCCESS_THRESHOLD_PCT,
  type ReelAttempt,
} from "./_lib/reelAuditReport";
import { loadRepoEnvLocal } from "./load-repo-env-local.mjs";

const PER_ATTEMPT_TIMEOUT_MS = 50_000;
const SPACING_MS = 150;
const SAMPLE_FIXTURE_PATH = "scripts/fixtures/reel-urls.sample.json";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Refuse to run against a real account (mirrors verify-gate0-db.mts). */
function assertAuditAccountSafe(email: string): void {
  const lower = email.toLowerCase();
  if (PERSONA_FORBIDDEN_EMAILS.some((f) => f.toLowerCase() === lower)) {
    throw new Error(
      `Refusing to run the Reel audit against real account ${email}. ` +
        "Set REEL_AUDIT_EMAIL to a plus-address throwaway (e.g. gracehowse+reelaudit@outlook.com).",
    );
  }
  if (
    process.env.E2E_EMAIL?.trim() &&
    process.env.E2E_EMAIL.trim().toLowerCase() === lower
  ) {
    throw new Error(`Refusing: REEL_AUDIT_EMAIL must not equal E2E_EMAIL (${email}).`);
  }
}

/** Read + validate the URL list from a JSON file (array of strings). */
function loadUrlList(path: string): string[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`${path} must be a JSON array of URL strings.`);
  }
  const urls = raw
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && !u.startsWith("#"));
  if (urls.length === 0) {
    throw new Error(`${path} contained no usable URLs.`);
  }
  return urls;
}

/** POST one URL; never throws — every failure becomes a recorded attempt. */
async function runOne(
  baseUrl: string,
  accessToken: string,
  url: string,
): Promise<ReelAttempt> {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PER_ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/recipe-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url }),
      signal: ac.signal,
    });
    const body = await res.json().catch(() => null);
    const { ok, errorCode, imageUsed } = classifyResponse(res.status, body);
    return { url, ok, errorCode, imageUsed, durationMs: Date.now() - t0 };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      url,
      ok: false,
      errorCode: aborted ? "timeout" : "network_error",
      imageUsed: null,
      durationMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget per-attempt analytics. Failures are logged, never thrown. */
async function emitAttemptEvent(distinctId: string, a: ReelAttempt): Promise<void> {
  const res = await serverTrack("recipe_import_stage_changed", distinctId, {
    audit_batch: true,
    stage: a.ok ? "done" : "failed",
    kind: "url",
    platform: "web",
    ...(a.ok ? {} : { errorCode: a.errorCode ?? "unknown" }),
    elapsedMs: a.durationMs,
  });
  if (!res.ok) {
    console.warn(`  · analytics emit skipped (${res.reason})`);
  }
}

async function main(): Promise<void> {
  loadRepoEnvLocal();

  if (process.env.AUDIT_TIKTOK_REELS !== "1") {
    console.log(
      "Reel parse-rate audit is gated. Set AUDIT_TIKTOK_REELS=1 to run " +
        "(exercises live AI + Supadata quota — see docs/operations/viral-push-gate.md).",
    );
    return;
  }
  if (process.env.CI) {
    console.log("Refusing to run the Reel audit in CI (live quota).");
    return;
  }

  const baseUrl = (process.env.AUDIT_TIKTOK_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const email = process.env.REEL_AUDIT_EMAIL?.trim() ?? "gracehowse+reelaudit@outlook.com";
  const password = process.env.REEL_AUDIT_PASSWORD?.trim();

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or anon key in .env.local.");
  }
  if (!password) {
    throw new Error(
      "Set REEL_AUDIT_PASSWORD (and REEL_AUDIT_EMAIL) for the throwaway audit account in .env.local.",
    );
  }
  assertAuditAccountSafe(email);

  const fixturePath = process.argv[2]?.trim() || SAMPLE_FIXTURE_PATH;
  const sampleFixture = fixturePath === SAMPLE_FIXTURE_PATH;
  const urls = loadUrlList(join(process.cwd(), fixturePath));

  // Mint a session (same approach as scripts/verify-gate0-db.mts).
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn.session) {
    throw new Error(`Sign-in failed for ${email}: ${signInErr?.message ?? "no session"}`);
  }
  const accessToken = signIn.session.access_token;
  const distinctId = signIn.user.id;

  console.log(`Reel parse-rate audit → ${baseUrl}/api/recipe-import`);
  console.log(`Fixture: ${fixturePath}${sampleFixture ? " (PLACEHOLDER sample — not a gate read)" : ""}`);
  console.log(`URLs: ${urls.length}\n`);

  const attempts: ReelAttempt[] = [];
  for (const [i, target] of urls.entries()) {
    const attempt = await runOne(baseUrl, accessToken, target);
    attempts.push(attempt);
    console.log(
      `${String(i + 1).padStart(3)}/${urls.length}  ${attempt.ok ? "ok  " : "FAIL"}  ${
        attempt.errorCode ?? ""
      }  ${attempt.durationMs}ms  ${target}`,
    );
    // Fire-and-forget (review MINOR): never awaited, never throws —
    // analytics latency must not serialise the audit loop.
    void emitAttemptEvent(distinctId, attempt);
    if (i < urls.length - 1) await sleep(SPACING_MS);
  }

  const summary = aggregateAttempts(attempts);
  const dateIso = new Date().toISOString().slice(0, 10);
  const report = renderReport({ dateIso, baseUrl, summary, attempts, sampleFixture });

  const outDir = join(process.cwd(), "docs/testing");
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, `audit-tiktok-reels-${dateIso}.md`);
  const jsonPath = join(outDir, `audit-tiktok-reels-${dateIso}.json`);
  writeFileSync(mdPath, report);
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, attempts }, null, 2));

  console.log(
    `\nParse rate: ${summary.successRatePct}% (${summary.succeeded}/${summary.total})  ` +
      `avg ${summary.avgDurationMs}ms  max ${summary.maxDurationMs}ms`,
  );
  if (summary.failureModes.length) {
    console.log("Top failure modes:");
    for (const m of summary.failureModes) console.log(`  ${m.errorCode}: ${m.count}`);
  }
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);

  if (!sampleFixture && urls.length < GATE_TARGET_SAMPLE_SIZE) {
    console.error(
      `\nGate read requires ${GATE_TARGET_SAMPLE_SIZE} URLs; got ${urls.length}. ` +
        "Replace the fixture with Grace's curated battery.",
    );
    process.exit(1);
  }
  if (!sampleFixture && !runMeetsGateThreshold(summary)) {
    console.error(
      `\nGate FAILED: ${summary.successRatePct}% < ${GATE_SUCCESS_THRESHOLD_PCT}% threshold.`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
