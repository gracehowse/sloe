import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repo = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(repo, path), "utf8");

describe("ENG-1236 referral invite surface parity", () => {
  it("gates the web and mobile invite cards behind the same flag", () => {
    const web = read("src/app/components/household/HouseholdInviteDialog.tsx");
    const mobile = read("apps/mobile/components/household/HouseholdInviteSheet.tsx");

    expect(web).toContain("REFERRAL_FLAG");
    expect(mobile).toContain("REFERRAL_FLAG");
    expect(web).toContain("ReferralRewardCard");
    expect(mobile).toContain("ReferralRewardCard");
  });

  it("keeps the flag registered default-on on both platforms", () => {
    expect(read("src/lib/analytics/track.ts")).toContain('"referral_invite_loop_v1"');
    expect(read("apps/mobile/lib/analytics.ts")).toContain('"referral_invite_loop_v1"');
  });

  it("stores referral codes from landing into web onboarding redemption", () => {
    expect(read("app/g/[code]/ReferralLandingClient.tsx")).toContain("REFERRAL_STORAGE_KEY");
    expect(read("src/app/components/onboarding/web-flow.tsx")).toContain("redeemPendingReferral");
  });
});
