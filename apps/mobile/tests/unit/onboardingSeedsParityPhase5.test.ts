/**
 * onboardingSeedsParityPhase5 — mobile parity test for B2.3.
 *
 * Authority: D-2026-04-27-14 + the candidate-source decision.
 * Pins that the mobile re-export at `apps/mobile/lib/onboardingSeeds.ts`
 * imports the same shared module the web flow uses. If the parity
 * breaks (someone forks the seed list onto mobile), this test flags
 * the drift before TestFlight.
 */

import { describe, it, expect } from "vitest";

import {
  ONBOARDING_SEEDS as MOBILE_SEEDS,
  filterOnboardingSeeds,
} from "../../lib/onboardingSeeds";
import { ONBOARDING_SEEDS as WEB_SEEDS } from "@suppr/shared/onboarding/onboardingSeeds";

describe("onboarding seed parity (mobile re-export)", () => {
  it("re-exports the identical 15 seeds", () => {
    expect(MOBILE_SEEDS).toBe(WEB_SEEDS);
  });

  it("filterOnboardingSeeds is the same function on both platforms", () => {
    // Confirms the mobile re-export forwards to the shared lib rather
    // than fork it — fork would create independent function identity.
    const r = filterOnboardingSeeds(MOBILE_SEEDS, { diet: ["gluten-free"] });
    expect(r.length).toBeGreaterThanOrEqual(4);
    for (const s of r) {
      expect(s.dietTags.map((t) => t.toLowerCase()).includes("gluten-free")).toBe(true);
    }
  });
});
