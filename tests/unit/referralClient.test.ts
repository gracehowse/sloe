import { describe, expect, it } from "vitest";

import {
  buildReferralUrl,
  normaliseReferralCode,
  redeemReferralCode,
} from "@/lib/referrals/referralClient";

describe("referral client helpers", () => {
  it("normalises referral codes for URLs and RPC calls", () => {
    expect(normaliseReferralCode(" ab-cd 12!! ")).toBe("ABCD12");
    expect(normaliseReferralCode(null)).toBe("");
  });

  it("builds canonical /g invite URLs", () => {
    expect(buildReferralUrl("ab-cd", "https://getsloe.com/")).toBe("https://getsloe.com/g/ABCD");
  });

  it("maps redemption success into reward-day payload", async () => {
    const result = await redeemReferralCode(
      {
        rpc: async () => ({
          data: { status: "redeemed", referrer_days: 30, referee_days: 30 },
          error: null,
        }),
      },
      "abc123",
    );

    expect(result).toEqual({
      ok: true,
      code: "ABC123",
      referrerDays: 30,
      refereeDays: 30,
    });
  });

  it("keeps database domain errors explicit", async () => {
    const result = await redeemReferralCode(
      {
        rpc: async () => ({
          data: { status: "cannot_refer_self" },
          error: null,
        }),
      },
      "abc123",
    );

    expect(result).toEqual({ ok: false, error: "cannot_refer_self" });
  });
});
