/**
 * F-58 (2026-04-22) — resolveNextTier pure helper pins the merge +
 * downgrade-guard logic used by Plan-tab RC reconcile.
 *
 * TestFlight build-28 feedback `ADpuHU6O…`, `AIryDu7i…`, `AIm3KPwBY…`
 * ("On pro but plans thinks I'm on free"): a misconfigured RC (e.g.
 * anonymous appUserID because app-level configure ran before the
 * Supabase sign-in) returned no entitlements. The merge collapsed to
 * "free" and clobbered the Pro profile. The guard blocks that write.
 *
 * Pure unit test — no RC import, no supabase mock, no native module.
 */
import { describe, expect, it } from "vitest";

// vitest.mock the RC native module so the static import of the
// purchases module doesn't explode at resolve time.
import { vi } from "vitest";

import { beforeAll } from "vitest";

type Mod = typeof import("../../lib/purchases");

// Lazy import via eval-style dynamic import to sidestep RC native
// module resolution. The function is pure so we can destructure it
// off the module exports after vitest has parsed the file.
let resolveNextTier: Mod["resolveNextTier"];
vi.mock("react-native-purchases", () => ({
  default: {
    configure: vi.fn(),
    logIn: vi.fn(),
    getCustomerInfo: vi.fn(),
    getOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    setLogLevel: vi.fn(),
  },
  LOG_LEVEL: { DEBUG: "DEBUG" },
}));
vi.mock("react-native-purchases-ui", () => ({
  default: { presentCustomerCenter: vi.fn() },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

beforeAll(async () => {
  const mod = (await import("../../lib/purchases")) as Mod;
  resolveNextTier = mod.resolveNextTier;
});

describe("resolveNextTier — F-58 downgrade guard", () => {
  it("blocks pro → free when RC returns empty entitlements and no promo", () => {
    const r = resolveNextTier({ rc: "free", promo: "free", current: "pro" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("downgrade-blocked");
    expect(r.next).toBe("pro");
  });

  it("blocks base → free", () => {
    const r = resolveNextTier({ rc: "free", promo: "free", current: "base" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("downgrade-blocked");
    expect(r.next).toBe("base");
  });

  it("allows upgrade free → pro on RC pro entitlement", () => {
    const r = resolveNextTier({ rc: "pro", promo: "free", current: "free" });
    expect(r.write).toBe(true);
    expect(r.next).toBe("pro");
  });

  it("allows upgrade free → base on RC base entitlement", () => {
    const r = resolveNextTier({ rc: "base", promo: "free", current: "free" });
    expect(r.write).toBe(true);
    expect(r.next).toBe("base");
  });

  it("upgrades base → pro via promo even if RC is free", () => {
    const r = resolveNextTier({ rc: "free", promo: "pro", current: "base" });
    expect(r.write).toBe(true);
    expect(r.next).toBe("pro");
  });

  it("no-op when computed equals current", () => {
    const r = resolveNextTier({ rc: "pro", promo: "free", current: "pro" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("no-change");
  });

  it("picks max of RC vs promo for upgrade", () => {
    const r = resolveNextTier({ rc: "base", promo: "pro", current: "free" });
    expect(r.next).toBe("pro");
    expect(r.write).toBe(true);
  });
});

describe("resolveNextTier — ENG-1043 lifetime_pro founding-cohort floor", () => {
  it("never downgrades a held lifetime_pro to pro on an RC pro sync", () => {
    // A founding member buys / restores nothing, but an RC reconcile resolves
    // to `pro`. lifetime_pro outranks pro, so the comp is preserved.
    const r = resolveNextTier({ rc: "pro", promo: "free", current: "lifetime_pro" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("downgrade-blocked");
    expect(r.next).toBe("lifetime_pro");
  });

  it("never downgrades a held lifetime_pro to free on an empty/misconfigured RC response", () => {
    const r = resolveNextTier({ rc: "free", promo: "free", current: "lifetime_pro" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("downgrade-blocked");
    expect(r.next).toBe("lifetime_pro");
  });

  it("upgrades free → lifetime_pro when a lifetime_pro promo is redeemed", () => {
    const r = resolveNextTier({ rc: "free", promo: "lifetime_pro", current: "free" });
    expect(r.write).toBe(true);
    expect(r.next).toBe("lifetime_pro");
  });

  it("no-op when already lifetime_pro and the promo re-resolves lifetime_pro", () => {
    const r = resolveNextTier({ rc: "free", promo: "lifetime_pro", current: "lifetime_pro" });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("no-change");
    expect(r.next).toBe("lifetime_pro");
  });
});
