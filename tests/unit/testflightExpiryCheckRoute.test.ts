/**
 * `app/api/cron/testflight-expiry-check` — Alarm 10 route tests
 * (PRA-015/IM-16, ENG-1414).
 *
 * Pins:
 *   1. The auth gate (503 unset secret, 401 wrong secret) — shared shape
 *      with every other scheduled cron.
 *   2. The deliberate clean-skip (200, not 503) when the `ASC_*`
 *      credentials aren't configured — mirrors
 *      `entitlementReconcileJob.ts`'s Stripe-not-configured precedent so a
 *      not-yet-provisioned integration never trips the scheduled-crons.yml
 *      failure-alerting.
 *   3. The day-math: `daysUntil` / `shouldAlert`'s <21-day threshold,
 *      including the already-expired (negative days) case.
 *   4. The Sentry alert fires (fingerprinted per build version) exactly
 *      when the threshold is crossed, not otherwise.
 *   5. The zero-builds and missing-`expirationDate` edge cases both alert
 *      rather than silently reporting a healthy state.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import {
  safeCompare,
  daysUntil,
  shouldAlert,
  readAscCredentialsFromEnv,
  runTestflightExpiryCheckRoute,
  EXPIRY_ALERT_THRESHOLD_DAYS,
  type LatestBuildInfo,
} from "../../src/lib/server/testflightExpiryCheck";

const ORIGINAL_ENV = { ...process.env };

function buildReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/testflight-expiry-check", {
    method: "POST",
    headers,
  });
}

function build(overrides: Partial<LatestBuildInfo> = {}): LatestBuildInfo {
  return {
    id: "build-1",
    version: "1.2.3",
    uploadedDate: "2026-06-01T00:00:00Z",
    expirationDate: "2026-08-30T00:00:00Z",
    expired: false,
    ...overrides,
  };
}

describe("testflight-expiry-check — pure day-math", () => {
  it("daysUntil computes whole days remaining", () => {
    const now = new Date("2026-07-20T00:00:00Z");
    expect(daysUntil("2026-08-10T00:00:00Z", now)).toBe(21);
    expect(daysUntil("2026-07-25T00:00:00Z", now)).toBe(5);
  });

  it("daysUntil is negative once the build has already expired", () => {
    const now = new Date("2026-07-20T00:00:00Z");
    expect(daysUntil("2026-07-10T00:00:00Z", now)).toBe(-10);
  });

  it("shouldAlert trips under the 21-day threshold, not at/above it", () => {
    expect(shouldAlert(22)).toBe(false);
    expect(shouldAlert(21)).toBe(false);
    expect(shouldAlert(20)).toBe(true);
    expect(shouldAlert(0)).toBe(true);
    expect(shouldAlert(-1)).toBe(true); // already expired — strictly worse, still alerts
  });

  it("EXPIRY_ALERT_THRESHOLD_DAYS is the audit-specified 21", () => {
    expect(EXPIRY_ALERT_THRESHOLD_DAYS).toBe(21);
  });

  it("safeCompare is constant-shape (equal only on exact match)", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "ab")).toBe(false);
  });
});

describe("testflight-expiry-check — readAscCredentialsFromEnv", () => {
  it("returns null when any of the four ASC_* vars is missing", () => {
    expect(readAscCredentialsFromEnv({})).toBeNull();
    expect(
      readAscCredentialsFromEnv({
        ASC_KEY_ID: "kid",
        ASC_ISSUER_ID: "iss",
        ASC_PRIVATE_KEY: "pem",
        // ASC_APP_ID missing
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("returns the trimmed credentials when all four are set", () => {
    const creds = readAscCredentialsFromEnv({
      ASC_KEY_ID: " kid ",
      ASC_ISSUER_ID: " iss ",
      ASC_PRIVATE_KEY: "-----BEGIN TEST-FIXTURE-----\nabc\n-----END TEST-FIXTURE-----",
      ASC_APP_ID: " 12345 ",
    } as NodeJS.ProcessEnv);
    expect(creds).toEqual({
      keyId: "kid",
      issuerId: "iss",
      privateKeyPem: "-----BEGIN TEST-FIXTURE-----\nabc\n-----END TEST-FIXTURE-----",
      appId: "12345",
    });
  });

  it("normalises literal \\n sequences in a PEM value back to real newlines", () => {
    const creds = readAscCredentialsFromEnv({
      ASC_KEY_ID: "kid",
      ASC_ISSUER_ID: "iss",
      ASC_PRIVATE_KEY: "-----BEGIN TEST-FIXTURE-----\\nabc\\n-----END TEST-FIXTURE-----",
      ASC_APP_ID: "12345",
    } as NodeJS.ProcessEnv);
    expect(creds?.privateKeyPem).toBe("-----BEGIN TEST-FIXTURE-----\nabc\n-----END TEST-FIXTURE-----");
  });
});

describe("testflight-expiry-check — route auth gate", () => {
  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    delete process.env.SUPPR_CRON_SECRET;
    vi.clearAllMocks();
  });

  it("503 when SUPPR_CRON_SECRET is unset", async () => {
    const res = await runTestflightExpiryCheckRoute(buildReq());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("server_misconfigured");
    expect(json.message).toMatch(/SUPPR_CRON_SECRET/);
  });

  it("401 when secret is wrong", async () => {
    process.env.SUPPR_CRON_SECRET = "expected-secret";
    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
  });
});

describe("testflight-expiry-check — clean skip when ASC not configured", () => {
  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    vi.clearAllMocks();
  });

  it("returns a clean 200 skip, not a 503, when ASC_* credentials are unset", async () => {
    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: null,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, skipped: "app_store_connect_not_configured" });
    // Never pages for a not-yet-provisioned integration.
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("testflight-expiry-check — happy path against injected ASC deps", () => {
  const CREDS = { keyId: "kid", issuerId: "iss", privateKeyPem: "pem", appId: "12345" };
  // `signAppStoreConnectJwt` needs a real PEM to sign against — every test
  // in this block injects `fetchLatestBuild` instead of hitting the real
  // ASC API, so the JWT itself is never actually verified; stub it out.
  const stubSignJwt = () => vi.fn().mockReturnValue("fake.jwt.token");

  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    vi.clearAllMocks();
  });

  it("does not alert when the newest build has well over 21 days left", async () => {
    const fetchLatestBuild = vi.fn().mockResolvedValue(build({ expirationDate: "2026-12-01T00:00:00Z" }));
    const signJwt = vi.fn().mockReturnValue("fake.jwt.token");

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt,
      fetchLatestBuild,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alerted).toBe(false);
    expect(json.version).toBe("1.2.3");
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(fetchLatestBuild).toHaveBeenCalledWith("12345", "fake.jwt.token");
  });

  it("alerts to Sentry (level error, fingerprinted by version) when under the threshold", async () => {
    const now = Date.now();
    const soon = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days out
    const fetchLatestBuild = vi.fn().mockResolvedValue(build({ version: "9.9.9", expirationDate: soon }));

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt: stubSignJwt(),
      fetchLatestBuild,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alerted).toBe(true);
    expect(json.daysRemaining).toBeLessThanOrEqual(5);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = (Sentry.captureMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toMatch(/9\.9\.9/);
    expect(opts.level).toBe("error");
    expect(opts.fingerprint).toEqual(["testflight-expiry", "9.9.9"]);
  });

  it("alerts when the build is already expired (negative days remaining)", async () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fetchLatestBuild = vi.fn().mockResolvedValue(build({ expirationDate: past, expired: true }));

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt: stubSignJwt(),
      fetchLatestBuild,
    });

    const json = await res.json();
    expect(json.alerted).toBe(true);
    expect(json.daysRemaining).toBeLessThan(0);
  });

  it("alerts when App Store Connect returns zero builds", async () => {
    const fetchLatestBuild = vi.fn().mockResolvedValue(null);

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt: stubSignJwt(),
      fetchLatestBuild,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alerted).toBe(true);
    expect(json.reason).toBe("no_builds");
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("warns but does not crash when the newest build has no expirationDate", async () => {
    const fetchLatestBuild = vi.fn().mockResolvedValue(build({ expirationDate: null }));

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt: stubSignJwt(),
      fetchLatestBuild,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alerted).toBe(false);
    expect(json.reason).toBe("missing_expiration_date");
    const [, opts] = (Sentry.captureMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.level).toBe("warning");
  });

  it("502 when the App Store Connect fetch throws", async () => {
    const fetchLatestBuild = vi.fn().mockRejectedValue(new Error("ASC 401 unauthorized"));

    const res = await runTestflightExpiryCheckRoute(buildReq({ "x-cron-secret": "ok-secret" }), {
      credentials: CREDS,
      signJwt: stubSignJwt(),
      fetchLatestBuild,
    });

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("testflight_expiry_check_failed");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
