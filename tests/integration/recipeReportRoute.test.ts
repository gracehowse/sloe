/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/recipe-report — the durable, logged queue for
 * non-copyright recipe reports (ENG-1225 #19). Authenticated-only (ENG-1226):
 * a valid Supabase session is required (401 otherwise) and the rate limit is
 * keyed per (user, trusted IP). Persists via the service-role client
 * (recipe_reports is service-role-only per its RLS).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn();

vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: vi.fn(() => ({ from: () => ({ insert: insertSpy }) })),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

// ENG-1226: the route now requires an authenticated session. Default to a
// signed-in user; the unauthenticated case overrides this per-test.
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user_123"),
}));

import { POST } from "../../app/api/recipe-report/route";
import { rateLimit } from "@/lib/server/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

const mockRl = rateLimit as ReturnType<typeof vi.fn>;
const mockAdmin = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;

function makeReq(body: unknown, extraHeaders?: Record<string, string>) {
  return new Request("http://localhost/api/recipe-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/recipe-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertSpy.mockReset();
    insertSpy.mockResolvedValue({ data: null, error: null });
    mockRl.mockResolvedValue({ ok: true, retryAfterSec: 0 });
    mockAdmin.mockReturnValue({ from: () => ({ insert: insertSpy }) });
    mockUserId.mockResolvedValue("user_123");
  });

  // ENG-1226 — auth gate.
  it("rejects an unauthenticated request with 401 and persists nothing", async () => {
    mockUserId.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "unsafe" }));
    expect(res.status).toBe(401);
    expect((await res.json()) as { error: string }).toMatchObject({ error: "unauthorized" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("does not consume the rate-limit budget when unauthenticated", async () => {
    // The 401 must short-circuit BEFORE rateLimit so anonymous probes can't be
    // used to drain a victim's bucket or even reach the limiter.
    mockUserId.mockResolvedValueOnce(null);
    await POST(makeReq({ recipeId: "r_abc", reason: "unsafe" }));
    expect(mockRl).not.toHaveBeenCalled();
  });

  it("allows an authenticated request and keys the rate limit by user id", async () => {
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "unsafe" }));
    expect(res.status).toBe(200);
    // ENG-1226: the second factor — userId is passed so the bucket composes as
    // `…:user:<id>:<ip>`, not IP-only.
    expect(mockRl).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: "api:recipe-report", userId: "user_123" }),
    );
  });

  it("records a valid report (200) with reason + description + recipe", async () => {
    const res = await POST(
      makeReq({ recipeId: "r_abc", reason: "unsafe", description: "raw chicken step" }),
    );
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        suppr_recipe_id: "r_abc",
        reason: "unsafe",
        description: "raw chicken step",
      }),
    );
  });

  it("accepts a report with no description", async () => {
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "incorrect" }));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  // ENG-1226 — the persisted audit IP must be the trusted, edge-injected value,
  // never the client-forgeable leftmost x-forwarded-for hop.
  it("stores the trusted client IP (ignoring a forged x-forwarded-for leftmost)", async () => {
    const res = await POST(
      makeReq(
        { recipeId: "r_abc", reason: "unsafe" },
        {
          "x-forwarded-for": "6.6.6.6, 10.0.0.1", // attacker-forged leftmost
          "x-real-ip": "203.0.113.9", // edge-injected, trusted
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_ip: "203.0.113.9" }),
    );
  });

  it("rejects an unknown reason (no copyright via this route)", async () => {
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "copyright" }));
    expect(res.status).toBe(400);
    expect((await res.json() as { field: string }).field).toBe("reason");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing recipe id", async () => {
    const res = await POST(makeReq({ reason: "other" }));
    expect(res.status).toBe(400);
    expect((await res.json() as { field: string }).field).toBe("recipeId");
  });

  it("rejects oversize description payloads", async () => {
    const res = await POST(
      makeReq({ recipeId: "r_abc", reason: "other", description: "a".repeat(5001) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { field: string }).field).toBe("description");
  });

  it("returns 429 when rate-limited", async () => {
    mockRl.mockResolvedValueOnce({ ok: false, retryAfterSec: 3600, ip: null });
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "other" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  it("returns 503 when the service-role key is unconfigured", async () => {
    mockAdmin.mockReturnValueOnce(null);
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "other" }));
    expect(res.status).toBe(503);
  });

  it("returns 500 when the insert fails", async () => {
    insertSpy.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await POST(makeReq({ recipeId: "r_abc", reason: "other" }));
    expect(res.status).toBe(500);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(makeReq("not json"));
    expect(res.status).toBe(400);
  });
});
