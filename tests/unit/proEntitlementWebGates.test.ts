/**
 * ENG (Pro-lockout, web) — pins two entitlement-gate fixes so they can't
 * silently regress:
 *
 *  1. Settings subscription-management card is gated on ENTITLEMENT ONLY
 *     (`userTier !== "free"`), never behind the `web-subscription-card` PostHog
 *     flag. A paying user's ability to manage/cancel must not depend on flag
 *     delivery — if the flag were off (or PostHog failed to load) a Pro user
 *     could not cancel, a billing-trust/legal problem.
 *
 *  2. AppDataContext must NOT clobber a known tier to a bare "free" on a
 *     transient profiles fetch error — that locks a real Pro out of paid
 *     surfaces. The error branch is upgrade-only via tierRank.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const settings = readFileSync(resolve(ROOT, "src/app/components/Settings.tsx"), "utf8");
const appData = readFileSync(resolve(ROOT, "src/context/AppDataContext.tsx"), "utf8");

describe("Settings subscription card gates on entitlement, not a flag", () => {
  it("subscriptionCard is guarded by `userTier !== \"free\"`", () => {
    expect(settings).toMatch(/const subscriptionCard\s*=\s*\n?\s*userTier !== "free" \?/);
  });

  it("does NOT gate the subscription card behind the web-subscription-card flag", () => {
    // The whole access condition must not require the flag as a prerequisite.
    expect(settings).not.toMatch(
      /isFeatureEnabled\("web-subscription-card"\)\s*&&\s*userTier !== "free"/,
    );
  });
});

describe("AppDataContext does not downgrade tier on a fetch error", () => {
  it("only the no-auth branch may default tier to free — the error branch must not", () => {
    // `setProfileTier(local?.userTier ?? "free")` is legitimate exactly once: the
    // `!authedUserId` branch (no signed-in user → free is correct). The post-auth
    // profiles-fetch error branch must NOT use it (that clobbers a real Pro).
    const clobbers = appData.match(/setProfileTier\(local\?\.userTier \?\? "free"\)/g) ?? [];
    expect(clobbers.length).toBeLessThanOrEqual(1);
  });

  it("the error branch is upgrade-only via tierRank", () => {
    expect(appData).toContain("tierRank");
    expect(appData).toMatch(/tierRank\(local\.userTier\)\s*>=\s*tierRank\(prev\)/);
  });
});
