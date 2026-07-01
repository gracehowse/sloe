import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { GET } from "../../app/api/progress/body-composition-trends/route";
import {
  createSupabaseServiceRoleClient,
  getUserIdFromRequest,
  getUserTier,
} from "@/lib/supabase/serverAnonClient";

describe("GET /api/progress/body-composition-trends", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserTier).mockReset();
    vi.mocked(createSupabaseServiceRoleClient).mockReset();
  });

  it("returns 403 for non-pro users", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getUserTier).mockResolvedValue("free");

    const res = await GET(new Request("http://localhost/api/progress/body-composition-trends"));
    expect(res.status).toBe(403);
  });

  it("returns trends for pro users", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getUserTier).mockResolvedValue("pro");
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                body_fat_pct: 24,
                body_fat_pct_by_day: { "2026-07-01": 24 },
                weight_kg_by_day: { "2026-07-01": 70 },
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/progress/body-composition-trends"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trends.bodyFat.current).toBe(24);
  });
});
