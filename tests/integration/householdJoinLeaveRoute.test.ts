/**
 * Integration tests for household join/leave and GET household — auth
 * gates and service-role misconfiguration (no live Supabase).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  misconfiguredServiceRoleResponse: vi.fn(() => null),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST as POST_JOIN } from "../../app/api/household/join/route";
import { POST as POST_LEAVE } from "../../app/api/household/leave/route";
import { GET as GET_HOUSEHOLD } from "../../app/api/household/route";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockService = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;
const mockMisconfigured = misconfiguredServiceRoleResponse as ReturnType<typeof vi.fn>;

describe("GET /api/household", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMisconfigured.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await GET_HOUSEHOLD(new Request("http://localhost/api/household"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("returns 503 when service role client cannot be created", async () => {
    mockUserId.mockResolvedValue("u1");
    mockService.mockReturnValue(null);
    const res = await GET_HOUSEHOLD(new Request("http://localhost/api/household"));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/household/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMisconfigured.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST_JOIN(
      new Request("http://localhost/api/household/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteCode: "abc" }),
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });
});

describe("POST /api/household/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMisconfigured.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST_LEAVE(new Request("http://localhost/api/household/leave", { method: "POST" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });
});
