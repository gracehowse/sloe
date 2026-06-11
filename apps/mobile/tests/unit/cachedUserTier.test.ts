/**
 * ENG-1043 — `cachedUserTier` normalises the founding-cohort `lifetime_pro`
 * comp to the `pro` gate tier.
 *
 * The cache drives the synchronous Plan-tab gate read on mount (avoids the
 * upgrade-gate flash for paid users). A founding member's `lifetime_pro` must
 * collapse to `pro` so they never see the Free gate — and a legacy cache that
 * somehow holds the raw `lifetime_pro` string must still read as `pro`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { normaliseCachedTier } from "@/lib/cachedUserTier";

async function freshModule() {
  vi.resetModules();
  const mod = await import("@/lib/cachedUserTier");
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return { ...mod, AsyncStorage };
}

afterEach(() => {
  vi.resetModules();
});

describe("normaliseCachedTier", () => {
  it("maps lifetime_pro to pro", () => {
    expect(normaliseCachedTier("lifetime_pro")).toBe("pro");
  });

  it("passes through pro / base / free", () => {
    expect(normaliseCachedTier("pro")).toBe("pro");
    expect(normaliseCachedTier("base")).toBe("base");
    expect(normaliseCachedTier("free")).toBe("free");
  });

  it("defaults null / undefined / unknown to free", () => {
    expect(normaliseCachedTier(null)).toBe("free");
    expect(normaliseCachedTier(undefined)).toBe("free");
    expect(normaliseCachedTier("enterprise")).toBe("free");
  });
});

describe("cachedUserTier round-trip", () => {
  it("saveCachedUserTier(lifetime_pro) is read back as pro", async () => {
    const { saveCachedUserTier, loadCachedUserTier } = await freshModule();
    await saveCachedUserTier("lifetime_pro");
    expect(await loadCachedUserTier()).toBe("pro");
  });

  it("a legacy raw lifetime_pro cache value loads as pro", async () => {
    const { loadCachedUserTier, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("suppr.cached_user_tier", "lifetime_pro");
    expect(await loadCachedUserTier()).toBe("pro");
  });

  it("defaults to free with no cache", async () => {
    const { loadCachedUserTier } = await freshModule();
    expect(await loadCachedUserTier()).toBe("free");
  });
});
