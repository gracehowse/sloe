/**
 * Unit tests for assertOrigin — CSRF Origin-header gate (M2, 2026-04-21).
 *
 * Contract:
 *   - no Origin header → null (allow; server-to-server / native path)
 *   - Origin matches NEXT_PUBLIC_APP_URL → null (allow)
 *   - Origin mismatches → 403 forbidden_origin
 *   - NEXT_PUBLIC_APP_URL unset with Origin present → 503 server_misconfigured
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertOrigin } from "@/lib/api/assertOrigin";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

function req(origin?: string | null): Request {
  const headers: Record<string, string> = {};
  if (origin != null) headers.origin = origin;
  return new Request("http://localhost/api/anything", { method: "POST", headers });
}

describe("assertOrigin", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://suppr.club";
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
  });

  it("allows requests with no Origin header (server-to-server / native)", () => {
    expect(assertOrigin(req(null))).toBeNull();
  });

  it("allows exact-match Origin", () => {
    expect(assertOrigin(req("https://suppr.club"))).toBeNull();
  });

  it("allows match with trailing slash on configured URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://suppr.club/";
    expect(assertOrigin(req("https://suppr.club"))).toBeNull();
  });

  it("rejects cross-origin requests with 403", async () => {
    const res = assertOrigin(req("https://evil.example"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("forbidden_origin");
  });

  it("rejects scheme mismatches (http vs https)", async () => {
    const res = assertOrigin(req("http://suppr.club"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("returns 503 if NEXT_PUBLIC_APP_URL is unset and Origin is present (fail closed)", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const res = assertOrigin(req("https://suppr.club"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  it("allows missing Origin even when NEXT_PUBLIC_APP_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(assertOrigin(req(null))).toBeNull();
  });
});
