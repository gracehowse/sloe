/**
 * ENG-1179 — CI-safe StoreKit lifecycle harness.
 *
 * This cannot exercise Apple's native StoreKit sheet in CI; instead it pins
 * the RevenueCat-facing lifecycle through `lib/purchases.ts` with mocked
 * `react-native-purchases` CustomerInfo shapes. The checked-in `.storekit`
 * file + documented Xcode Manage Transactions flow cover the native layer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-purchases-ui", () => ({
  default: { presentCustomerCenter: vi.fn() },
}));
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

import Purchases, { type CustomerInfo } from "react-native-purchases";
import {
  isProEntitled,
  pollUntilEntitled,
  purchasePackage,
  resolvedTier,
  resolveNextTier,
  restorePurchases,
  syncTierToSupabase,
  type UserTier,
  classifyPackage,
} from "../../lib/purchases";

function makeCustomerInfo(entitlements: string[]): CustomerInfo {
  const active: Record<string, object> = {};
  for (const entitlement of entitlements) active[entitlement] = {};
  return {
    entitlements: { active, all: {} },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: "",
    originalAppUserId: "",
    requestDate: "",
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    customerInfoJSON: "{}",
  } as unknown as CustomerInfo;
}

function makeSupabase(current: UserTier, updateError?: { code?: string; message: string }) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: updateError ?? null }) }));
  const from = vi.fn((table: string) => {
    if (table === "promo_redemptions") {
      return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
    }
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { user_tier: current }, error: null }) })) })),
      update,
    };
  });
  return { client: { from }, update };
}

const mockPurchasePackage = Purchases.purchasePackage as ReturnType<typeof vi.fn>;
const mockRestorePurchases = Purchases.restorePurchases as ReturnType<typeof vi.fn>;
const mockGetCustomerInfo = Purchases.getCustomerInfo as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useRealTimers();
  mockPurchasePackage.mockReset();
  mockRestorePurchases.mockReset();
  mockGetCustomerInfo.mockReset();
});

describe("StoreKit lifecycle harness (ENG-1179)", () => {
  it("maps a successful purchase CustomerInfo to pro and syncs the Supabase tier", async () => {
    const info = makeCustomerInfo(["pro"]);
    mockPurchasePackage.mockResolvedValue({ customerInfo: info });
    const result = await purchasePackage({ identifier: "$rc_monthly", product: { identifier: "pro_monthly_v1" } } as never);
    expect(result.success).toBe(true);
    expect(resolvedTier(result.customerInfo!)).toBe("pro");

    const { client, update } = makeSupabase("free");
    await expect(syncTierToSupabase(info, client as never, "user-1")).resolves.toEqual({
      status: "wrote",
      from: "free",
      to: "pro",
    });
    expect(update).toHaveBeenCalledWith({ user_tier: "pro" });
  });

  it("treats tier-column lockdown as expected after an otherwise-successful purchase", async () => {
    const { client } = makeSupabase("free", { code: "42501", message: "T2: tier column lockdown" });
    await expect(syncTierToSupabase(makeCustomerInfo(["pro"]), client as never, "user-1")).resolves.toEqual({
      status: "lockdown_expected",
      from: "free",
      to: "pro",
    });
  });

  it("returns success:false for a user-cancelled purchase without changing tier", async () => {
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });
    await expect(purchasePackage({ identifier: "$rc_annual", product: { identifier: "pro_annual_v1" } } as never)).resolves.toEqual({ success: false });
  });

  it("restores an entitled purchase as Pro", async () => {
    const info = makeCustomerInfo(["pro"]);
    mockRestorePurchases.mockResolvedValue(info);
    const restored = await restorePurchases();
    expect(isProEntitled(restored)).toBe(true);
  });

  it("blocks client-side downgrade when cancellation empties active entitlements but the stored tier is higher", () => {
    expect(resolvedTier(makeCustomerInfo([]))).toBe("free");
    expect(resolveNextTier({ rc: "free", promo: "free", current: "pro" })).toEqual({
      next: "pro",
      write: false,
      reason: "downgrade-blocked",
    });
  });

  it("polls for delayed entitlement refresh and times out cleanly", async () => {
    vi.useFakeTimers();
    mockGetCustomerInfo
      .mockResolvedValueOnce(makeCustomerInfo([]))
      .mockResolvedValueOnce(makeCustomerInfo(["pro"]));
    const delayed = pollUntilEntitled("pro", 3, 100);
    await vi.runAllTimersAsync();
    await expect(delayed).resolves.not.toBeNull();

    mockGetCustomerInfo.mockReset().mockResolvedValue(makeCustomerInfo([]));
    const timedOut = pollUntilEntitled("pro", 2, 100);
    await vi.runAllTimersAsync();
    await expect(timedOut).resolves.toBeNull();
  });

  it("classifies canonical product and RevenueCat package identifiers", () => {
    expect(classifyPackage({ identifier: "$rc_monthly", packageType: "UNKNOWN", product: { identifier: "pro_monthly_v1" } } as never)).toEqual({ tier: "pro", period: "monthly" });
    expect(classifyPackage({ identifier: "$rc_annual", packageType: "UNKNOWN", product: { identifier: "pro_annual_v1" } } as never)).toEqual({ tier: "pro", period: "annual" });
    expect(classifyPackage({ identifier: "custom", packageType: "MONTHLY", product: { identifier: "pro_monthly_v1" } } as never)).toEqual({ tier: "pro", period: "monthly" });
    expect(classifyPackage({ identifier: "custom", packageType: "ANNUAL", product: { identifier: "pro_annual_v1" } } as never)).toEqual({ tier: "pro", period: "annual" });
  });
});
