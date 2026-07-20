/**
 * Server-side helpers for `POST /api/cron/testflight-expiry-check`
 * (PRA-015/IM-16, ENG-1414 — "Alarm 10" from `docs/operations/alerting.md`).
 *
 * ## Why this job exists
 *
 * TestFlight builds auto-expire 90 days after upload. Until now the ONLY
 * guard against the promoted build lapsing (no install path, no rollback
 * target) was a recurring 60-day CALENDAR REMINDER
 * (`docs/operations/founder-safety-net.md` §3) — a human process that is
 * exactly the mechanism that fails during a busy launch month or a 7-day
 * absence, the two scenarios where it matters most (2026-07-05 deep audit,
 * PRA-015/IM-16). This job replaces the reminder with a real system alarm:
 * a weekly poll of the App Store Connect API's newest build, alerting
 * loudly to Sentry when its `expirationDate` is under 21 days out.
 *
 * ## Credentials — reuses the existing ASC_* auth, not a new naming scheme
 *
 * `scripts/fetch-testflight-feedback.mjs` already authenticates to this
 * exact API (ES256 JWT, `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY` /
 * `ASC_APP_ID`, read from `.env.local` for that LOCAL script). This module
 * deliberately reuses those same four env var names rather than inventing a
 * second naming scheme for one physical credential — the only difference is
 * where they're read from: this route runs server-side on Vercel, so the
 * four vars must be set in the Vercel PRODUCTION environment (Project
 * Settings → Environment Variables), not just `.env.local`. `ASC_PRIVATE_KEY`
 * must be the INLINE PEM contents on Vercel (the full
 * `-----BEGIN PRIVATE KEY-----...` block — Vercel's env var editor supports
 * multi-line values) — unlike the local script, there is no persistent
 * filesystem here to resolve a `.p8` file path against.
 *
 * Grace has not provisioned these on Vercel yet (2026-07-20) — see
 * `docs/decisions/2026-07-20-eng1414-production-readiness-hardening-tail.md`
 * for the exact provisioning steps. Until they're set, the route returns a
 * clean 200 skip (see `runTestflightExpiryCheckRoute` below) — never a
 * crash, never a 5xx that would trip `scheduled-crons.yml`'s failure
 * alerting (ENG-1400) for a rail that is simply not configured yet. This
 * mirrors `entitlementReconcileJob.ts`'s Stripe-not-configured clean skip.
 *
 * ## Auth to App Store Connect
 *
 * Apple requires a short-lived ES256 JWT signed with the `.p8` private key
 * (`signAppStoreConnectJwt`) — identical algorithm/claims to
 * `fetch-testflight-feedback.mjs`'s `signJwt`, reimplemented here in
 * TypeScript so the route carries no runtime dependency on that script.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml, weekly)
 *     → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *     → sign an ASC JWT → GET /v1/builds (newest by uploadedDate)
 *     → compute days remaining until expirationDate
 *     → Sentry.captureMessage (level "error") when <21 days remain
 *     → structured log + summary JSON
 *
 * All implementation lives here — Next.js's App Router route validator
 * rejects non-handler exports from a `route.ts` file, so the route stays a
 * thin wrapper (matches every other cron in this repo:
 * `supabaseAdvisorCheck.ts`, `entitlementReconcileJob.ts`,
 * `householdPurgeJob.ts`).
 *
 * Env vars
 *   - `SUPPR_CRON_SECRET` shared with all scheduled crons (GH Actions + Vercel, rotate together).
 *   - `ASC_KEY_ID`      App Store Connect API key id (Users and Access → Keys).
 *   - `ASC_ISSUER_ID`   App Store Connect issuer UUID (shown above the key list).
 *   - `ASC_PRIVATE_KEY` Inline PEM contents of the downloaded `.p8` key.
 *   - `ASC_APP_ID`      Numeric ascAppId (e.g. 6762522932).
 *   - The four ASC_* vars are all-or-nothing optional — unset means "not
 *     provisioned yet"; clean 200 skip, not a failure.
 */
import { NextResponse } from "next/server";
import { createPrivateKey, createSign } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

/**
 * Constant-time string compare for the cron-secret gate. Mirrors the
 * identical helper in `householdPurgeJob.ts` / `supabaseAdvisorCheck.ts` /
 * `entitlementReconcileJob.ts` — the established per-cron-lib convention (a
 * route file cannot export a shared helper without tripping Next's App
 * Router validator, and each cron lib carries its own tiny copy rather than
 * importing across crons).
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const ASC_API_BASE = "https://api.appstoreconnect.apple.com/v1";

/** Days out from expiry that trips the alarm — PRA-015's explicit recommendation. */
export const EXPIRY_ALERT_THRESHOLD_DAYS = 21;

export interface AscCredentials {
  keyId: string;
  issuerId: string;
  privateKeyPem: string;
  appId: string;
}

/**
 * Reads the four `ASC_*` env vars. Returns `null` (never throws) if any are
 * missing — the caller treats that as "not configured yet," not an error.
 */
export function readAscCredentialsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AscCredentials | null {
  const keyId = env.ASC_KEY_ID?.trim();
  const issuerId = env.ASC_ISSUER_ID?.trim();
  const rawPrivateKey = env.ASC_PRIVATE_KEY?.trim();
  const appId = env.ASC_APP_ID?.trim();
  if (!keyId || !issuerId || !rawPrivateKey || !appId) return null;

  // Some env stores (copy-pasted .env values, certain CI secret UIs)
  // collapse real newlines in a PEM block to the literal two-character
  // sequence `\n` — normalise back to real newlines so `createPrivateKey`
  // can parse it. Vercel's own multi-line env editor does NOT need this,
  // but we accept both shapes defensively.
  const privateKeyPem = rawPrivateKey.includes("-----BEGIN")
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : rawPrivateKey;

  return { keyId, issuerId, privateKeyPem, appId };
}

/**
 * Signs a 20-minute ES256 JWT for the App Store Connect API — identical
 * claims to `scripts/fetch-testflight-feedback.mjs`'s `signJwt`.
 */
export function signAppStoreConnectJwt({
  keyId,
  issuerId,
  privateKeyPem,
}: Pick<AscCredentials, "keyId" | "issuerId" | "privateKeyPem">): string {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };

  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;

  const key = createPrivateKey(privateKeyPem);
  const sign = createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const derSig = sign.sign({ key, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${derSig.toString("base64url")}`;
}

export interface LatestBuildInfo {
  id: string;
  version: string;
  uploadedDate: string;
  expirationDate: string | null;
  expired: boolean;
}

interface AscBuildsResponse {
  data?: Array<{
    id: string;
    attributes: {
      version: string;
      uploadedDate: string;
      expirationDate: string | null;
      expired: boolean;
    };
  }>;
}

/**
 * Fetch the newest TestFlight build for the app (by `uploadedDate` desc).
 * Returns `null` when the app has no builds at all. Throws on a non-2xx
 * response so the caller surfaces a 502.
 */
export async function fetchLatestBuild(
  appId: string,
  jwt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatestBuildInfo | null> {
  const url =
    `${ASC_API_BASE}/builds?filter[app]=${encodeURIComponent(appId)}` +
    `&sort=-uploadedDate&limit=1&fields[builds]=version,uploadedDate,expirationDate,expired`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`App Store Connect builds fetch failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as AscBuildsResponse;
  const build = json.data?.[0];
  if (!build) return null;
  return {
    id: build.id,
    version: build.attributes.version,
    uploadedDate: build.attributes.uploadedDate,
    expirationDate: build.attributes.expirationDate,
    expired: build.attributes.expired,
  };
}

/**
 * Whole days remaining until `expirationDateIso`, relative to `now`.
 * Negative means already expired.
 */
export function daysUntil(expirationDateIso: string, now: Date = new Date()): number {
  const expiry = new Date(expirationDateIso).getTime();
  const diffMs = expiry - now.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Alarm-trigger condition — PRA-015's "<21 days from 90-day expiry".
 * Already-expired (negative `daysRemaining`) also alerts — that's a strictly
 * worse state than "soon", never a reason to stay quiet.
 */
export function shouldAlert(
  daysRemaining: number,
  thresholdDays: number = EXPIRY_ALERT_THRESHOLD_DAYS,
): boolean {
  return daysRemaining < thresholdDays;
}

/**
 * Emit the loud Sentry alert. Fingerprinted per build version so repeated
 * weekly runs against the same still-expiring build group into ONE Sentry
 * issue, not a fresh one every run (mirrors `supabaseAdvisorCheck.ts`'s
 * `cache_key` fingerprinting).
 */
export function emitExpiryAlert(build: LatestBuildInfo, daysRemaining: number): void {
  Sentry.captureMessage(
    `[testflight-expiry] Build ${build.version} expires in ${daysRemaining} day(s) — no install path once it lapses`,
    {
      level: "error",
      fingerprint: ["testflight-expiry", build.version],
      tags: { type: "testflight-expiry", build_version: build.version },
      extra: {
        buildId: build.id,
        uploadedDate: build.uploadedDate,
        expirationDate: build.expirationDate,
        daysRemaining,
        thresholdDays: EXPIRY_ALERT_THRESHOLD_DAYS,
        action:
          "Ship or re-promote a new TestFlight build before this one expires — see docs/operations/founder-safety-net.md §3.",
      },
    },
  );
}

export interface TestflightExpiryCheckDeps {
  fetchLatestBuild?: typeof fetchLatestBuild;
  signJwt?: typeof signAppStoreConnectJwt;
  emitAlert?: typeof emitExpiryAlert;
  /** Overrides `readAscCredentialsFromEnv()`'s default `process.env` read — test-only hook. */
  credentials?: AscCredentials | null;
}

/**
 * Full HTTP handler logic (auth gate + credential resolution + poll +
 * alert), dependency-injected so the route file stays a thin wrapper and
 * tests run without hitting the real App Store Connect API.
 *
 * Mirrors `entitlementReconcileJob.ts`'s deliberate clean-skip: when the
 * `ASC_*` credentials are NOT configured (not yet provisioned — see the
 * module doc comment), this returns a clean 200 `skipped` rather than a
 * 503. A 503 would trip `scheduled-crons.yml`'s failure-alerting
 * (ENG-1400) and open a GitHub issue every week until Grace provisions the
 * ASC API key — a false alarm for an integration that is dark by design
 * until then. A missing/wrong cron secret IS still a 503/401 — that's a
 * real misconfiguration that should always page.
 */
export async function runTestflightExpiryCheckRoute(
  req: Request,
  deps: TestflightExpiryCheckDeps = {},
): Promise<NextResponse> {
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

  const credentials = deps.credentials !== undefined ? deps.credentials : readAscCredentialsFromEnv();
  if (!credentials) {
    console.log(
      JSON.stringify({
        at: "cron.testflight_expiry_check",
        phase: "skipped",
        reason: "app_store_connect_not_configured",
      }),
    );
    return NextResponse.json({ ok: true, skipped: "app_store_connect_not_configured" });
  }

  const signJwt = deps.signJwt ?? signAppStoreConnectJwt;
  const fetchBuild = deps.fetchLatestBuild ?? fetchLatestBuild;
  const emitAlert = deps.emitAlert ?? emitExpiryAlert;

  try {
    const jwt = signJwt(credentials);
    const build = await fetchBuild(credentials.appId, jwt);

    if (!build) {
      // Zero builds is itself worth paging — there is definitely no install
      // path in this state, not merely "soon".
      Sentry.captureMessage(
        "[testflight-expiry] App Store Connect returned zero TestFlight builds for this app",
        { level: "error", fingerprint: ["testflight-expiry", "no_builds"] },
      );
      console.log(
        JSON.stringify({
          at: "cron.testflight_expiry_check",
          phase: "complete",
          ok: true,
          alerted: true,
          reason: "no_builds",
        }),
      );
      return NextResponse.json({ ok: true, alerted: true, reason: "no_builds" });
    }

    if (!build.expirationDate) {
      // Defensive — ASC has always returned this for a processed build in
      // practice, but a missing value must not silently skip the alarm it
      // exists to raise.
      Sentry.captureMessage(
        `[testflight-expiry] Newest build ${build.version} has no expirationDate from App Store Connect — cannot evaluate the 90-day window`,
        { level: "warning", fingerprint: ["testflight-expiry", "missing_expiration_date"] },
      );
      console.log(
        JSON.stringify({
          at: "cron.testflight_expiry_check",
          phase: "complete",
          ok: true,
          alerted: false,
          version: build.version,
          reason: "missing_expiration_date",
        }),
      );
      return NextResponse.json({
        ok: true,
        alerted: false,
        version: build.version,
        reason: "missing_expiration_date",
      });
    }

    const daysRemaining = daysUntil(build.expirationDate);
    const alerted = shouldAlert(daysRemaining);
    if (alerted) {
      emitAlert(build, daysRemaining);
    }

    console.log(
      JSON.stringify({
        at: "cron.testflight_expiry_check",
        phase: "complete",
        ok: true,
        version: build.version,
        expirationDate: build.expirationDate,
        daysRemaining,
        alerted,
      }),
    );

    return NextResponse.json({
      ok: true,
      version: build.version,
      uploadedDate: build.uploadedDate,
      expirationDate: build.expirationDate,
      daysRemaining,
      thresholdDays: EXPIRY_ALERT_THRESHOLD_DAYS,
      alerted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { type: "testflight-expiry", phase: "check_failed" } });
    return NextResponse.json(
      { ok: false, error: "testflight_expiry_check_failed", message },
      { status: 502 },
    );
  }
}
