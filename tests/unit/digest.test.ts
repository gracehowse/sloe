/**
 * Unit tests for the Digest primitive (D3).
 *
 * Covers:
 *   - `resolveDigestHeadline` — §5 rule precedence.
 *   - Nutrition treatment rules from §8: weightDeltaKg null → suppress;
 *     never "+0.0 kg"; maintenance null suppresses; 0 daysLogged falls
 *     to the quiet-week headline.
 */

import { describe, expect, it } from "vitest";

import {
  classifyDigestHeroTone,
  digestHeroTrackFraction,
  resolveDigestHeadline,
} from "../../src/lib/nutrition/digest";

describe("resolveDigestHeadline — §5 precedence", () => {
  it("returns 'Quiet week.' when daysLogged is 0 regardless of other signals", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: -1.2,
        closestToTargetLabel: "Tuesday",
        streakDays: 12,
        daysLogged: 0,
      }),
    ).toBe("Quiet week.");
  });

  it("prefers weight delta when |delta| >= 0.3 kg (down)", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: -0.6,
        closestToTargetLabel: "Tuesday",
        streakDays: 10,
        daysLogged: 7,
      }),
    ).toBe("Last week: down 0.6 kg.");
  });

  it("prefers weight delta when |delta| >= 0.3 kg (up)", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: 0.4,
        closestToTargetLabel: null,
        streakDays: 0,
        daysLogged: 7,
      }),
    ).toBe("Last week: up 0.4 kg.");
  });

  it("falls through to closest-to-target when weight delta is below 0.3 kg", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: 0.2,
        closestToTargetLabel: "Thursday",
        streakDays: 3,
        daysLogged: 5,
      }),
    ).toBe("Closest to target: Thursday.");
  });

  it("falls through to streak when no weight delta and no closest-to-target", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: null,
        closestToTargetLabel: null,
        streakDays: 7,
        daysLogged: 4,
      }),
    ).toBe("Streak held — 7 days.");
  });

  it("does not use streak when below 7 days", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: null,
        closestToTargetLabel: null,
        streakDays: 6,
        daysLogged: 4,
      }),
    ).toBe("Last week, at a glance.");
  });

  it("never renders +0.0 kg — exact 0.0 is below 0.3 kg threshold", () => {
    expect(
      resolveDigestHeadline({
        weightDeltaKg: 0,
        closestToTargetLabel: null,
        streakDays: 3,
        daysLogged: 4,
      }),
    ).toBe("Last week, at a glance.");
  });
});

// ENG-740 — blended Week-Digest hero track helpers.
describe("classifyDigestHeroTone — calorie-ring 3-state", () => {
  it("returns 'under' when the day is meaningfully below target", () => {
    expect(classifyDigestHeroTone(680, 901)).toBe("under");
  });

  it("returns 'over' when the day is meaningfully above target", () => {
    expect(classifyDigestHeroTone(2400, 2000)).toBe("over");
  });

  it("returns 'neutral' inside the ±4% tolerance band", () => {
    // 2000 ± 4% = ±80 kcal. 2050 is within band → neutral.
    expect(classifyDigestHeroTone(2050, 2000)).toBe("neutral");
  });

  it("uses a 40 kcal tolerance floor for small targets", () => {
    // 500 * 4% = 20, but the floor is 40. 530 is 30 over → within 40 → neutral.
    expect(classifyDigestHeroTone(530, 500)).toBe("neutral");
    // 560 is 60 over → beyond the 40 floor → over.
    expect(classifyDigestHeroTone(560, 500)).toBe("over");
  });

  it("returns 'neutral' (never grades) when no target is set", () => {
    expect(classifyDigestHeroTone(1800, 0)).toBe("neutral");
  });
});

describe("digestHeroTrackFraction — dot position", () => {
  it("returns dayCalories/targetCalories within [0,1]", () => {
    expect(digestHeroTrackFraction(680, 901)).toBeCloseTo(680 / 901, 5);
  });

  it("clamps to 1 when over target (dot never escapes the track)", () => {
    expect(digestHeroTrackFraction(3000, 2000)).toBe(1);
  });

  it("clamps to 0 for non-positive day calories", () => {
    expect(digestHeroTrackFraction(0, 2000)).toBe(0);
    expect(digestHeroTrackFraction(-50, 2000)).toBe(0);
  });

  it("returns 0 when no target is set (track is suppressed by the card)", () => {
    expect(digestHeroTrackFraction(1800, 0)).toBe(0);
  });
});
