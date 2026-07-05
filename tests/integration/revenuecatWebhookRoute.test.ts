/**
 * ENG-1355 — route-level tests for POST /api/revenuecat/webhook.
 *
 * Complements `tests/integration/revenuecat-webhook-process.test.ts`
 * (which pins the business logic in `processRevenueCatEvent`) by
 * covering the HTTP layer the ticket calls out as untested:
 *   - bearer-secret auth (missing / wrong / bare vs "Bearer "-prefixed)
 *   - config-missing 503s (webhook secret unset, service-role unset)
 *   - malformed JSON / missing required event fields
 *   - stale-event rejection (ENG-681 replay protection — events older
 *     than 26h are rejected with 400 event_too_old)
 *   - the `{ event: {...} }` wrapper vs a flat event body
 *   - handler-thrown errors surface as 500, not an unhandled rejection
 *
 * `processRevenueCatEvent` itself is mocked here — its outcomes are
 * already exhaustively tested elsewhere; this file only exercises what
 * the route does BEFORE and AROUND that call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processRevenueCatEventMock = vi.fn();

vi.mock("@/lib/revenuecat/webhookProcess", () => ({
  processRevenueCatEvent: (event: unknown) => processRevenueCatEventMock(event),
}));

const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

const captureRouteErrorMock = vi.fn();
vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: (...args: unknown[]) => captureRouteErrorMock(...args),
}));

async function loadRoute() {
  const mod = await import("../../app/api/revenuecat/webhook/route");
  return mod.POST;
}

function makeReq(
  body: unknown,
  opts: { auth?: string | null; rawBody?: string } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== null) headers.authorization = opts.auth ?? "Bearer test-secret";
  return new Request("http://localhost/api/revenuecat/webhook", {
    method: "POST",
    headers,
    body: opts.rawBody ?? JSON.stringify(body),
  });
}

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "INITIAL_PURCHASE",
    app_user_id: "11111111-1111-4111-8111-111111111111",
    entitlement_ids: ["pro"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", "test-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  processRevenueCatEventMock.mockReset();
  captureMessageMock.mockReset();
  captureRouteErrorMock.mockReset();
  processRevenueCatEventMock.mockResolvedValue({ ok: true, outcome: "tier_updated", userId: "u1", tier: "pro" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- config gating -----------------------------------------------------------

describe("POST /api/revenuecat/webhook — config gating", () => {
  it("returns 503 when REVENUECAT_WEBHOOK_AUTH is unset", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", "");
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("revenuecat_webhook_not_configured");
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 503 when SUPABASE_SERVICE_ROLE_KEY is unset", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("supabase_service_role_missing");
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
  });
});

// --- auth ---------------------------------------------------------------------

describe("POST /api/revenuecat/webhook — bearer auth", () => {
  it("401s when Authorization header is missing", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent(), { auth: null }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("auth failure"),
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("401s when the bearer secret is wrong", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent(), { auth: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("accepts a bare (non-'Bearer '-prefixed) Authorization value", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent(), { auth: "test-secret" }));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a 'Bearer '-prefixed Authorization value", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent(), { auth: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledTimes(1);
  });

  it("401s on an empty-string bearer even though REVENUECAT_WEBHOOK_AUTH is set", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent(), { auth: "" }));
    expect(res.status).toBe(401);
  });
});

// --- payload parsing -----------------------------------------------------------

describe("POST /api/revenuecat/webhook — payload parsing", () => {
  it("400s on invalid JSON", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(undefined, { rawBody: "{not json" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_json");
  });

  it("400s when required event fields are missing (no id)", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ type: "INITIAL_PURCHASE", app_user_id: "u1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_event_fields");
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("400s when app_user_id is missing", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ id: "evt_1", type: "INITIAL_PURCHASE" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_event_fields");
  });

  it("accepts the RC v1 wrapped shape ({ event: {...} })", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ event: validEvent() }));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_1", type: "INITIAL_PURCHASE" }),
    );
  });

  it("accepts a flat (unwrapped) event body", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_1" }),
    );
  });
});

// --- replay / staleness protection (ENG-681) ------------------------------------

describe("POST /api/revenuecat/webhook — stale-event rejection (ENG-681)", () => {
  it("rejects an event older than 26 hours with 400 event_too_old", async () => {
    const POST = await loadRoute();
    const twentySevenHoursAgo = Date.now() - 27 * 60 * 60 * 1000;
    const res = await POST(
      makeReq(validEvent({ event_timestamp_ms: twentySevenHoursAgo })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("event_too_old");
    expect(processRevenueCatEventMock).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("stale event rejected"),
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("accepts an event within the 26h freshness window", async () => {
    const POST = await loadRoute();
    const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000;
    const res = await POST(makeReq(validEvent({ event_timestamp_ms: oneHourAgo })));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledTimes(1);
  });

  it("does not reject when event_timestamp_ms is absent (older/test payloads)", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(200);
    expect(processRevenueCatEventMock).toHaveBeenCalledTimes(1);
  });
});

// --- downstream outcome + error handling -----------------------------------------

describe("POST /api/revenuecat/webhook — processRevenueCatEvent outcome handling", () => {
  it("200s with the outcome from a successful process result", async () => {
    processRevenueCatEventMock.mockResolvedValue({ ok: true, outcome: "skipped_duplicate" });
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, outcome: "skipped_duplicate" });
  });

  it("500s when processRevenueCatEvent returns ok:false", async () => {
    processRevenueCatEventMock.mockResolvedValue({
      ok: false,
      reason: "persist_failed",
      error: "boom",
    });
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("persist_failed");
    expect(body.message).toBe("boom");
  });

  it("500s and reports to Sentry when processRevenueCatEvent throws", async () => {
    processRevenueCatEventMock.mockRejectedValue(new Error("unexpected"));
    const POST = await loadRoute();
    const res = await POST(makeReq(validEvent()));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("handler_failed");
    expect(body.message).toBe("unexpected");
    expect(captureRouteErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      "/api/revenuecat/webhook",
    );
  });
});
