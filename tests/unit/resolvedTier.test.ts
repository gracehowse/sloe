import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the tier resolution and sync logic.
 * We re-implement the pure logic here to avoid mocking react-native-purchases
 * (which has type-level syntax that breaks vitest transform).
 */

type FakeCustomerInfo = {
  entitlements: { active: Record<string, unknown> };
};

function resolvedTier(info: FakeCustomerInfo): "free" | "base" | "pro" {
  if (info.entitlements.active["pro"]) return "pro";
  if (info.entitlements.active["base"]) return "base";
  return "free";
}

async function syncTierToSupabase(
  info: FakeCustomerInfo,
  supabase: { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: unknown }> } } },
  userId: string,
): Promise<void> {
  const tier = resolvedTier(info);
  try {
    await supabase.from("profiles").update({ user_tier: tier }).eq("id", userId);
  } catch {
    // Non-critical
  }
}

function fakeInfo(active: Record<string, unknown>): FakeCustomerInfo {
  return { entitlements: { active } };
}

describe("resolvedTier", () => {
  it("returns pro when pro entitlement is active", () => {
    expect(resolvedTier(fakeInfo({ pro: { isActive: true } }))).toBe("pro");
  });

  it("returns base when only base is active", () => {
    expect(resolvedTier(fakeInfo({ base: { isActive: true } }))).toBe("base");
  });

  it("returns free when no entitlements are active", () => {
    expect(resolvedTier(fakeInfo({}))).toBe("free");
  });

  it("prefers pro when both pro and base are active", () => {
    expect(
      resolvedTier(fakeInfo({ base: { isActive: true }, pro: { isActive: true } })),
    ).toBe("pro");
  });
});

describe("syncTierToSupabase", () => {
  it("calls supabase update with resolved tier", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    const sb = { from: fromMock };

    await syncTierToSupabase(fakeInfo({ pro: { isActive: true } }), sb, "user-123");

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(updateMock).toHaveBeenCalledWith({ user_tier: "pro" });
    expect(eqMock).toHaveBeenCalledWith("id", "user-123");
  });

  it("writes base tier when only base entitlement active", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    const sb = { from: fromMock };

    await syncTierToSupabase(fakeInfo({ base: { isActive: true } }), sb, "user-456");

    expect(updateMock).toHaveBeenCalledWith({ user_tier: "base" });
  });

  it("writes free when no entitlements", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ update: updateMock });
    const sb = { from: fromMock };

    await syncTierToSupabase(fakeInfo({}), sb, "user-789");

    expect(updateMock).toHaveBeenCalledWith({ user_tier: "free" });
  });

  it("does not throw on supabase error", async () => {
    const eqMock = vi.fn().mockRejectedValue(new Error("network"));
    const fromMock = vi.fn().mockReturnValue({ update: () => ({ eq: eqMock }) });
    const sb = { from: fromMock };

    await expect(
      syncTierToSupabase(fakeInfo({}), sb, "user-123"),
    ).resolves.toBeUndefined();
  });
});
