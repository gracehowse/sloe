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

import { resolveDigestHeadline } from "../../src/lib/nutrition/digest";

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
