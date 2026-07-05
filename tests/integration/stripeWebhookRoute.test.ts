/**
 * ENG-1355 — route-level tests for POST /api/stripe/webhook.
 *
 * Complements `tests/integration/stripe-webhook-process.test.ts` (which
 * pins `processStripeWebhookEvent`'s business logic) by covering the
 * HTTP layer the ticket calls out as untested:
 *   - signature verification (missing header → 400, invalid signature
 *     → 400 — this is Stripe's replay-protection primitive: a captured
 *     payload replayed without a fresh, validly-signed header must
 *     never reach the handler)
 *   - config-missing 503s (Stripe / webhook secret / service-role unset)
 *   - handler-thrown errors surface as 500 with captureRouteError,
 *     not an unhandled rejection
 *   - a valid signature happy-path reaches the mocked business logic
 *     exactly once with the constructed event
 *
 * `stripe.webhooks.constructEvent` is mocked at the SDK boundary (per
 * the ticket's "do not test against real Stripe" instruction) — a
 * thrown error from it is Stripe's own signature-mismatch behaviour,
 * which is what the route's invalid-signature branch guards against.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructEventMock = vi.fn();

vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = { constructEvent: (...args: unknown[]) => constructEventMock(...args) };
  },
}));

const processStripeWebhookEventMock = vi.fn();
vi.mock("@/lib/stripe/webhookProcess", () => ({
  processStripeWebhookEvent: (...args: unknown[]) => processStripeWebhookEventMock(...args),
}));

const supabasePublicUrlMock = vi.fn(() => "https://example.supabase.co");
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  supabasePublicUrl: () => supabasePublicUrlMock(),
}));

const captureRouteErrorMock = vi.fn();
vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: (...args: unknown[]) => captureRouteErrorMock(...args),
}));

async function loadRoute() {
  const mod = await import("../../app/api/stripe/webhook/route");
  return mod.POST;
}

function makeReq(opts: { sig?: string | null; body?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.sig !== null) headers["stripe-signature"] = opts.sig ?? "t=1,v1=validsig";
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body: opts.body ?? JSON.stringify({ id: "evt_1", type: "checkout.session.completed" }),
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  constructEventMock.mockReset();
  processStripeWebhookEventMock.mockReset();
  captureRouteErrorMock.mockReset();
  constructEventMock.mockReturnValue({ id: "evt_1", type: "checkout.session.completed" });
  processStripeWebhookEventMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- config gating -----------------------------------------------------------

describe("POST /api/stripe/webhook — config gating", () => {
  it("returns 503 when STRIPE_SECRET_KEY is unset", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("stripe_webhook_not_configured");
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("stripe_webhook_not_configured");
  });

  it("returns 503 when SUPABASE_SERVICE_ROLE_KEY is unset", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("supabase_service_role_missing");
    expect(constructEventMock).not.toHaveBeenCalled();
  });
});

// --- signature verification / replay protection -------------------------------

describe("POST /api/stripe/webhook — signature verification (replay protection)", () => {
  it("400s when the stripe-signature header is missing", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ sig: null }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_signature");
    expect(constructEventMock).not.toHaveBeenCalled();
    expect(processStripeWebhookEventMock).not.toHaveBeenCalled();
  });

  it("400s when Stripe's SDK rejects the signature (tampered/replayed payload)", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Timestamp outside tolerance / signature mismatch");
    });
    const POST = await loadRoute();
    const res = await POST(makeReq({ sig: "t=1,v1=bad" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_signature");
    expect(processStripeWebhookEventMock).not.toHaveBeenCalled();
  });

  it("passes the raw body + signature header + endpoint secret to constructEvent", async () => {
    const POST = await loadRoute();
    const rawBody = JSON.stringify({ id: "evt_raw", type: "checkout.session.completed" });
    await POST(makeReq({ sig: "t=1,v1=validsig", body: rawBody }));
    expect(constructEventMock).toHaveBeenCalledWith(rawBody, "t=1,v1=validsig", "whsec_test");
  });

  it("a validly-signed event reaches processStripeWebhookEvent exactly once", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });
    expect(processStripeWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processStripeWebhookEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "evt_1", type: "checkout.session.completed" }),
    );
  });
});

// --- handler error surfacing ---------------------------------------------------

describe("POST /api/stripe/webhook — handler error handling", () => {
  it("500s and reports to Sentry when processStripeWebhookEvent throws", async () => {
    processStripeWebhookEventMock.mockRejectedValue(new Error("db unreachable"));
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("handler_failed");
    expect(body.message).toBe("db unreachable");
    expect(captureRouteErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      "/api/stripe/webhook",
      expect.objectContaining({ eventType: "checkout.session.completed", eventId: "evt_1" }),
    );
  });

  it("does not throw an unhandled rejection when the handler rejects with a non-Error value", async () => {
    processStripeWebhookEventMock.mockRejectedValue("string rejection");
    const POST = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("webhook_handler_error");
  });
});
