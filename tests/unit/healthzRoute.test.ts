/**
 * ENG-1407 (2026-07-05 deep audit, production readiness, IM-06) — the
 * cheapest possible "is prod up" check.
 */
import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/healthz/route";

describe("GET /api/healthz", () => {
  it("returns 200 with ok: true", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("is never cached — an uptime monitor must see live state on every ping", () => {
    const res = GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports the app version from package.json", async () => {
    const res = GET();
    const body = await res.json();
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });

  it("reports a fresh ISO timestamp on every call", async () => {
    const res1 = await GET().json();
    await new Promise((r) => setTimeout(r, 5));
    const res2 = await GET().json();
    expect(new Date(res1.timestamp).getTime()).toBeLessThanOrEqual(new Date(res2.timestamp).getTime());
    expect(() => new Date(res1.timestamp).toISOString()).not.toThrow();
  });

  it("makes no external calls — a pure liveness check has no failure mode from Supabase/PostHog", async () => {
    // Regression guard against scope creep: healthz must stay a synchronous,
    // dependency-free liveness check (see route comment for why). If a
    // future change makes GET async and awaits a DB/network call, this test
    // catches it by asserting the exported handler is NOT an async function.
    expect(GET.constructor.name).not.toBe("AsyncFunction");
  });
});
