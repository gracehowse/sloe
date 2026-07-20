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

  // ENG-1541 — the referral card + landing page publicly promise "30 days of
  // Pro" but no entitlement-grant path exists yet (needs a purchase rail).
  // The flag was flipped DEFAULT-OFF to hide the unkeepable promise until the
  // grant is wired. It must be registered on both platforms (for the
  // KNOWN_DEFAULT_OFF_FLAGS parity check) but NOT in REDESIGN_DEFAULT_ON.
  it("registers the flag DEFAULT-OFF on both platforms (ENG-1541)", () => {
    const parseBlock = (src: string, marker: string, close: string) => {
      const start = src.indexOf(marker);
      expect(start, `${marker} block`).toBeGreaterThanOrEqual(0);
      const end = src.indexOf(close, start);
      expect(end, `${marker} close`).toBeGreaterThan(start);
      const flags = new Set<string>();
      for (const m of src.slice(start + marker.length, end).matchAll(/"([a-z0-9_-]+)"/g)) {
        flags.add(m[1]);
      }
      return flags;
    };
    for (const path of ["src/lib/analytics/track.ts", "apps/mobile/lib/analytics.ts"]) {
      const src = read(path);
      const on = parseBlock(src, "REDESIGN_DEFAULT_ON = new Set<string>([", "]);");
      const off = parseBlock(src, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");
      expect(on.has("referral_invite_loop_v1"), `${path} REDESIGN_DEFAULT_ON`).toBe(false);
      expect(off.has("referral_invite_loop_v1"), `${path} KNOWN_DEFAULT_OFF_FLAGS`).toBe(true);
    }
  });

  it("stores referral codes from landing into web onboarding redemption", () => {
    expect(read("app/g/[code]/ReferralLandingClient.tsx")).toContain("REFERRAL_STORAGE_KEY");
    expect(read("src/app/components/onboarding/web-flow.tsx")).toContain("redeemPendingReferral");
  });

  // ENG-1541 follow-up — the flag flip alone didn't gate the PUBLIC
  // `/g/<code>` landing page or the capture/redemption pipeline behind it;
  // both advertised/captured unconditionally regardless of the flag. Full
  // render-level behavioural coverage lives in
  // `referralLandingFlagGating.test.tsx`; this just guards the static wiring
  // doesn't regress back to an unguarded call site.
  it("gates the public landing page and the capture/redemption pipeline behind the flag (ENG-1541)", () => {
    const landing = read("app/g/[code]/ReferralLandingClient.tsx");
    expect(landing).toContain("REFERRAL_FLAG");
    expect(landing).toContain("isFeatureEnabled");

    const pending = read("src/lib/referrals/pendingReferral.ts");
    expect(pending).toContain("REFERRAL_FLAG");
    expect(pending).toContain("isFeatureEnabled");
  });
});
