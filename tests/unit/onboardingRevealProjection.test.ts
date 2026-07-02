import { describe, expect, it } from "vitest";

import {
  ONBOARDING_PROJECTION_WEEKS,
  computeOnboardingRevealProjection,
} from "../../src/lib/onboarding/revealProjection";

describe("computeOnboardingRevealProjection (ENG-964)", () => {
  const base = {
    weightKg: 80,
    paceKgPerWeek: 0.5,
    weightSkipped: false,
  } as const;

  it("returns null for maintain, skipped weight, or missing pace", () => {
    expect(
      computeOnboardingRevealProjection({ ...base, goal: "maintain" }),
    ).toBeNull();
    expect(
      computeOnboardingRevealProjection({ ...base, goal: "lose", weightSkipped: true }),
    ).toBeNull();
    expect(
      computeOnboardingRevealProjection({ ...base, goal: "lose", paceKgPerWeek: null }),
    ).toBeNull();
  });

  it("projects a 12-week loss milestone for lose/recomp goals", () => {
    const lose = computeOnboardingRevealProjection({ ...base, goal: "lose" });
    expect(lose?.deltaKg).toBe(0.5 * ONBOARDING_PROJECTION_WEEKS);
    expect(lose?.sentence).toMatch(/lose about 6 kg/);
    expect(lose?.sentence).toMatch(/approximately/);

    const recomp = computeOnboardingRevealProjection({ ...base, goal: "recomp" });
    expect(recomp?.deltaKg).toBe(6);
  });

  it("projects a gain milestone for gain goals", () => {
    const gain = computeOnboardingRevealProjection({ ...base, goal: "gain", paceKgPerWeek: 0.25 });
    expect(gain?.deltaKg).toBe(3);
    expect(gain?.sentence).toMatch(/gain about 3 kg/);
  });

  it("includes a formatted date label", () => {
    const result = computeOnboardingRevealProjection({ ...base, goal: "lose" });
    expect(result?.dateLabel).toMatch(/\d{1,2} \w+ \d{4}/);
    expect(result?.sentence).toContain(result!.dateLabel);
  });

  it("includes chart geometry for the reveal trendline (ENG-1233)", () => {
    const result = computeOnboardingRevealProjection({ ...base, goal: "lose" });
    expect(result?.startKg).toBe(80);
    expect(result?.endKg).toBe(74);
    expect(result?.weeks).toBe(ONBOARDING_PROJECTION_WEEKS);
    expect(result?.polylinePoints).toMatch(/^\d/);
    expect(result?.startMarker.x).toBeLessThan(result!.endMarker.x);
  });
});
