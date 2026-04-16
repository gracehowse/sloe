/**
 * Integration tests for DELETE /api/account/delete.
 * Tests the auth gate and service key gate — the actual deletion
 * logic is tested indirectly since full Supabase mocking is complex.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { DELETE } from "../../app/api/account/delete/route";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;

function mockRequest(): Request {
  return new Request("http://localhost/api/account/delete", { method: "DELETE" });
}

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 503 when service role key is not configured", async () => {
    mockGetUserId.mockResolvedValue("user-123");
    mockCreateServiceClient.mockReturnValue(null);
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
