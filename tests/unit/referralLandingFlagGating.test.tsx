/**
 * ENG-1541 — referral_invite_loop_v1 is DEFAULT-OFF (2026-07-12): no
 * entitlement-grant path exists for the "30 Pro days" promise yet (needs
 * the purchase rail — see ENG-1487). The household invite cards
 * (`HouseholdInviteDialog` / `HouseholdInviteSheet`) were already gated
 * behind the flag, but the PUBLIC `/g/<code>` landing page
 * (`ReferralLandingClient`) and the onboarding-side capture/redemption
 * pipeline (`src/lib/referrals/pendingReferral.ts`) were not — the page
 * unconditionally advertised the promise to any visitor and unconditionally
 * captured + redeemed the code, regardless of the flag. This is exactly the
 * "public default-ON landing page" problem the ticket describes.
 *
 * These tests guard the flag-off path end-to-end so it stays a clean kill
 * switch, not a broken half-state: no promise copy, no localStorage
 * capture, no redeem RPC call — and confirm the flag-on path is unchanged.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

void React;

const isFeatureEnabledMock = vi.fn(() => false);

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (...args: unknown[]) => isFeatureEnabledMock(...args),
}));

import { ReferralLandingClient } from "../../app/g/[code]/ReferralLandingClient";
import {
  redeemPendingReferral,
  storePendingReferralFromLocation,
} from "../../src/lib/referrals/pendingReferral";
import { REFERRAL_STORAGE_KEY } from "../../src/lib/referrals/referralClient";

describe("ENG-1541 — /g/<code> landing page respects referral_invite_loop_v1 off", () => {
  beforeEach(() => {
    isFeatureEnabledMock.mockReturnValue(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not render the '30 Pro days' promise when the flag is off", () => {
    render(<ReferralLandingClient code="ABCD1234" />);
    expect(screen.queryByText(/30 Pro reward days/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/30-day Sloe Pro reward/i)).not.toBeInTheDocument();
    expect(screen.getByText(/You.ve been invited to Sloe/i)).toBeInTheDocument();
  });

  it("does not capture the referral code into localStorage when the flag is off", () => {
    render(<ReferralLandingClient code="ABCD1234" />);
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("forwards Continue straight to onboarding with no ?ref param when off", () => {
    render(<ReferralLandingClient code="ABCD1234" />);
    const link = screen.getByRole("link", { name: /continue/i });
    expect(link.getAttribute("href")).toBe("/onboarding");
  });

  it("renders the promise, captures the code, and links with ?ref when the flag is on", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    render(<ReferralLandingClient code="ABCD1234" />);
    expect(screen.getByText(/30 Pro reward days/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("ABCD1234");
    const link = screen.getByRole("link", { name: /continue/i });
    expect(link.getAttribute("href")).toBe("/onboarding?ref=ABCD1234");
  });
});

describe("ENG-1541 — pending-referral capture/redemption is a clean no-op when off", () => {
  beforeEach(() => {
    isFeatureEnabledMock.mockReturnValue(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("storePendingReferralFromLocation does not write to localStorage when off", () => {
    storePendingReferralFromLocation("?ref=ABCD1234");
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("redeemPendingReferral never calls the RPC when off, even with a stale stored code", async () => {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, "ABCD1234");
    const rpc = vi.fn();

    const result = await redeemPendingReferral({ rpc });

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ redeemed: false, error: null });
    // A stale code from before the flag flipped off is left in place rather
    // than silently discarded — it's inert, not lost, if the flag re-enables.
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("ABCD1234");
  });

  it("storePendingReferralFromLocation and redeemPendingReferral work normally when on", async () => {
    isFeatureEnabledMock.mockReturnValue(true);
    storePendingReferralFromLocation("?ref=ABCD1234");
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("ABCD1234");

    const rpc = vi.fn(async () => ({
      data: { status: "redeemed", referrer_days: 30, referee_days: 30 },
      error: null,
    }));
    const result = await redeemPendingReferral({ rpc });

    expect(rpc).toHaveBeenCalledWith("redeem_referral_code", { p_code: "ABCD1234" });
    expect(result).toEqual({ redeemed: true, error: null });
  });
});
