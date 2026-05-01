/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/dmca-takedown — the public takedown
 * channel surfaced on /dmca. Anonymous endpoint; rate-limited per IP;
 * persists via the service-role client (the dmca_takedowns table is
 * service-role-only per its RLS policy).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insertSpy = vi.fn();

vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      insert: insertSpy,
    }),
  })),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/dmca-takedown/route";
import { rateLimit } from "@/lib/server/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";

const mockRl = rateLimit as ReturnType<typeof vi.fn>;
const mockAdmin = getSupabaseAdminClient as ReturnType<typeof vi.fn>;

function makeReq(body: unknown) {
  return new Request("http://localhost/api/dmca-takedown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/dmca-takedown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertSpy.mockReset();
    insertSpy.mockResolvedValue({ data: null, error: null });
    mockRl.mockResolvedValue({ ok: true, retryAfterSec: 0 });
    mockAdmin.mockReturnValue({
      from: () => ({
        insert: insertSpy,
      }),
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 + records the row on a valid submission", async () => {
    const res = await POST(
      makeReq({
        reporterEmail: "creator@example.com",
        originalPostUrl: "https://www.instagram.com/p/ABC123/",
        supprRecipeId: "https://suppr-club.com/recipe/abc",
        description: "This is my recipe and I'd like it removed.",
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; message?: string };
    expect(data.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_email: "creator@example.com",
        original_post_url: "https://www.instagram.com/p/ABC123/",
        suppr_recipe_id: "https://suppr-club.com/recipe/abc",
        description: "This is my recipe and I'd like it removed.",
      }),
    );
  });

  it("rejects an invalid email", async () => {
    const res = await POST(
      makeReq({
        reporterEmail: "not-an-email",
        originalPostUrl: "https://www.instagram.com/p/ABC/",
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; field: string };
    expect(data.field).toBe("reporterEmail");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects when the original post URL is missing or invalid", async () => {
    const r1 = await POST(makeReq({ reporterEmail: "x@y.z" }));
    expect(r1.status).toBe(400);
    const r2 = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "javascript:alert(1)",
      }),
    );
    expect(r2.status).toBe(400);
    const r3 = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "ftp://example.com/x",
      }),
    );
    expect(r3.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects oversize description payloads", async () => {
    const res = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "https://www.instagram.com/p/ABC/",
        description: "a".repeat(5001),
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { field: string };
    expect(data.field).toBe("description");
  });

  it("returns 429 when rate-limited", async () => {
    mockRl.mockResolvedValueOnce({ ok: false, retryAfterSec: 3600, ip: null });
    const res = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "https://www.instagram.com/p/ABC/",
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  it("returns 503 when SUPABASE_SERVICE_ROLE_KEY is unconfigured", async () => {
    mockAdmin.mockReturnValueOnce(null);
    const res = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "https://www.instagram.com/p/ABC/",
      }),
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("server_misconfigured");
  });

  it("returns 500 when the database insert fails", async () => {
    insertSpy.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await POST(
      makeReq({
        reporterEmail: "x@y.z",
        originalPostUrl: "https://www.instagram.com/p/ABC/",
      }),
    );
    expect(res.status).toBe(500);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(makeReq("not json"));
    expect(res.status).toBe(400);
  });
});
