/**
 * ENG-1441 (2026-07-21) — `GET /api/stripe/tax-status`. Surfaces
 * `STRIPE_TAX_ENABLED` to client components with no Server Component
 * ancestor to pass it down as a prop (the upgrade dialog — see the
 * route's doc comment for why).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/stripe/tax-status/route";

describe("GET /api/stripe/tax-status", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns stripeTaxEnabled: true when STRIPE_TAX_ENABLED=true", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, stripeTaxEnabled: true });
  });

  it("returns stripeTaxEnabled: false when STRIPE_TAX_ENABLED is unset (the real default)", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "");
    const res = GET();
    const body = await res.json();
    expect(body).toEqual({ ok: true, stripeTaxEnabled: false });
  });

  it("only the literal string 'true' enables the flag — no truthy-string footgun", async () => {
    for (const v of ["1", "TRUE", "yes", "True"]) {
      vi.stubEnv("STRIPE_TAX_ENABLED", v);
      const body = await GET().json();
      expect(body.stripeTaxEnabled, `value=${v}`).toBe(false);
    }
  });

  it("is unauthenticated — no Authorization header required", async () => {
    // No request/headers threaded through GET at all; the route takes
    // no arguments. Documents the deliberate choice (see route comment)
    // rather than relying on an absence-of-behaviour to prove it.
    const res = GET();
    expect(res.status).toBe(200);
  });
});
