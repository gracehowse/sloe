/**
 * Unit tests for pollUntilEntitled (ENG-684).
 *
 * Verifies bounded-poll behaviour: returns CustomerInfo when entitlement
 * appears within the polling window, null when it never does, and handles
 * RC fetch failures without crashing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native-purchases", () => ({
  default: {
    getCustomerInfo: vi.fn(),
  },
}));

import Purchases from "react-native-purchases";
import { pollUntilEntitled } from "@/lib/purchases";

function makeCustomerInfo(entitlements: string[]): Awaited<ReturnType<typeof Purchases.getCustomerInfo>> {
  const active: Record<string, object> = {};
  for (const e of entitlements) active[e] = {};
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
  } as unknown as Awaited<ReturnType<typeof Purchases.getCustomerInfo>>;
}

const mockGetCustomerInfo = Purchases.getCustomerInfo as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGetCustomerInfo.mockReset();
  vi.useFakeTimers();
});

describe("pollUntilEntitled (ENG-684)", () => {
  it("returns CustomerInfo immediately when already entitled on first attempt", async () => {
    mockGetCustomerInfo.mockResolvedValue(makeCustomerInfo(["pro"]));
    const result = pollUntilEntitled("pro", 3, 1000);
    await vi.runAllTimersAsync();
    expect(await result).not.toBeNull();
    expect(mockGetCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it("returns CustomerInfo when entitlement appears on a later attempt", async () => {
    mockGetCustomerInfo
      .mockResolvedValueOnce(makeCustomerInfo([]))
      .mockResolvedValueOnce(makeCustomerInfo([]))
      .mockResolvedValue(makeCustomerInfo(["pro"]));
    const result = pollUntilEntitled("pro", 5, 100);
    await vi.runAllTimersAsync();
    expect(await result).not.toBeNull();
    expect(mockGetCustomerInfo).toHaveBeenCalledTimes(3);
  });

  it("returns null when entitlement never appears within maxAttempts", async () => {
    mockGetCustomerInfo.mockResolvedValue(makeCustomerInfo([]));
    const result = pollUntilEntitled("pro", 3, 100);
    await vi.runAllTimersAsync();
    expect(await result).toBeNull();
    expect(mockGetCustomerInfo).toHaveBeenCalledTimes(3);
  });

  it("continues polling after an RC fetch failure (fail-open for this use case)", async () => {
    mockGetCustomerInfo
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue(makeCustomerInfo(["pro"]));
    const result = pollUntilEntitled("pro", 3, 100);
    await vi.runAllTimersAsync();
    expect(await result).not.toBeNull();
    expect(mockGetCustomerInfo).toHaveBeenCalledTimes(2);
  });

  it("matches base entitlement via 'base' or 'pro' active entitlement", async () => {
    mockGetCustomerInfo.mockResolvedValue(makeCustomerInfo(["base"]));
    const result = pollUntilEntitled("base", 1, 100);
    await vi.runAllTimersAsync();
    expect(await result).not.toBeNull();
  });
});
