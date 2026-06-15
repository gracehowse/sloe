import { describe, expect, it, vi, beforeEach } from "vitest";
import { tierRank } from "../../src/lib/tier/tierRank";
import {
  updateProfileTierServiceRole,
  updateProfileTierServiceRoleDetailed,
} from "../../src/lib/stripe/updateProfileTier";

const mockMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: () => ({
        eq: mockUpdateEq,
      }),
    }),
  })),
}));

describe("tierRank", () => {
  it("orders lifetime_pro above pro", () => {
    expect(tierRank("lifetime_pro")).toBeGreaterThan(tierRank("pro"));
    expect(tierRank("pro")).toBeGreaterThan(tierRank("base"));
    expect(tierRank("base")).toBeGreaterThan(tierRank("free"));
  });
});

describe("updateProfileTierServiceRole floor (ENG-49)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("skips downgrade when current tier outranks requested tier", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { user_tier: "lifetime_pro" }, error: null });

    const result = await updateProfileTierServiceRoleDetailed("user-1", "free");
    expect(result).toEqual({
      ok: true,
      outcome: "floor_protected",
      currentTier: "lifetime_pro",
    });
    expect(mockUpdateEq).not.toHaveBeenCalled();
    expect(await updateProfileTierServiceRole("user-1", "free")).toBe(true);
  });

  it("writes when upgrade path is allowed", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { user_tier: "free" }, error: null });

    const result = await updateProfileTierServiceRoleDetailed("user-1", "pro");
    expect(result).toEqual({ ok: true, outcome: "updated" });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("allows pro → free downgrade from webhooks", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { user_tier: "pro" }, error: null });

    const result = await updateProfileTierServiceRoleDetailed("user-1", "free");
    expect(result).toEqual({ ok: true, outcome: "updated" });
    expect(mockUpdateEq).toHaveBeenCalled();
  });

  it("blocks any webhook write when current tier is lifetime_pro", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { user_tier: "lifetime_pro" }, error: null });

    const result = await updateProfileTierServiceRoleDetailed("user-1", "pro");
    expect(result).toEqual({
      ok: true,
      outcome: "floor_protected",
      currentTier: "lifetime_pro",
    });
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });
});
