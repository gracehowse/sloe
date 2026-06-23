/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/recipe-report — the durable, logged queue for
 * non-copyright recipe reports (ENG-1225 #19). Rate-limited per IP; persists via
 * the service-role client (recipe_reports is service-role-only per its RLS).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn();

vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: vi.fn(() => ({ from: () => ({ insert: insertSpy }) })),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/recipe-report/route";
import { rateLimit } from "@/lib/server/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";

const mockRl = rateLimit as ReturnType<typeof vi.fn>;
const mockAdmin = getSupabaseAdminClient as ReturnType<typeof vi.fn>;

function makeReq(body: unknown) {
  return new Request("http://localhost/api/recipe-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
