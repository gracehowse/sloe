/**
 * ENG-603 — premium_motion_v1 flag helper (web).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics/track", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

import { isFeatureEnabled } from "@/lib/analytics/track";
import { isPremiumMotionV1Enabled } from "@/lib/preferences/premiumMotionWeb";
import { PREMIUM_MOTION_V1_FLAG } from "@/lib/preferences/premiumMotion";

describe("isPremiumMotionV1Enabled", () => {
  beforeEach(() => {
    vi.mocked(isFeatureEnabled).mockReset();
  });

  it("reads the premium_motion_v1 PostHog flag", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    expect(isPremiumMotionV1Enabled()).toBe(true);
    expect(isFeatureEnabled).toHaveBeenCalledWith(PREMIUM_MOTION_V1_FLAG);
  });

  it("returns false when flag is off", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    expect(isPremiumMotionV1Enabled()).toBe(false);
  });
});
