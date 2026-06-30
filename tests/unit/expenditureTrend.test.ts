/**
 * ENG-953 — shared Expenditure trend copy (`buildExpenditureTrendCopy`).
 *
 * This is the single source of truth for what the calm Expenditure card says
 * on BOTH web and mobile, so these tests protect the user-observable copy
 * against regression on either platform.
 *
 * The load-bearing guarantees:
 *   - NEVER a false-precision integer — the surfaced figure is rounded to the
 *     nearest 10 and prefixed "about ~".
 *   - Low confidence / no estimate → the "still learning your pattern"
 *     reassurance with NO number.
 *   - A measured (Apple Health) value is preferred over the modelled adaptive
 *     value when present.
 *   - Confidence-chip level is derived correctly and is null in the learning
 *     state with no usable confidence.
 */

import { describe, expect, it } from "vitest";

import { buildExpenditureTrendCopy } from "../../src/lib/progress/expenditureTrend.ts";

const FIXED_NOW = Date.parse("2026-06-30T12:00:00.000Z");
const isoDaysAgo = (n: number) => new Date(FIXED_NOW - n * 86_400_000).toISOString();

describe("buildExpenditureTrendCopy — confident adaptive read", () => {
  it("rounds to the nearest 10 kcal and never shows the raw integer", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2347,
      adaptiveConfidence: "high",
      adaptiveUpdatedAt: isoDaysAgo(0),
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("adaptive");
    expect(copy.roundedKcal).toBe(2350);
    expect(copy.line).toContain("about ~2,350 kcal/day lately");
    // The exact raw integer must never appear — that would read as precision
    // we don't have.
    expect(copy.line).not.toContain("2347");
    expect(copy.line).not.toContain("2,347");
  });

  it("surfaces the medium-confidence chip and the burning-lately framing", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2104,
      adaptiveConfidence: "medium",
      adaptiveUpdatedAt: isoDaysAgo(3),
      now: FIXED_NOW,
    });
    expect(copy.chipLevel).toBe("medium");
    // 2104 rounds down to the nearest 10 → 2,100.
    expect(copy.roundedKcal).toBe(2100);
    expect(copy.line).toContain("You've been burning about ~2,100 kcal/day lately.");
  });

  it("normalises a mixed-case confidence string", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 1990,
      adaptiveConfidence: "HIGH",
      adaptiveUpdatedAt: isoDaysAgo(1),
      now: FIXED_NOW,
    });
    expect(copy.chipLevel).toBe("high");
    expect(copy.source).toBe("adaptive");
  });
});

describe("buildExpenditureTrendCopy — recency phrasing", () => {
  const base = { adaptiveTdee: 2200, adaptiveConfidence: "high" as const, now: FIXED_NOW };

  it("fresh update reads as just-updated", () => {
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: isoDaysAgo(0) }).detail).toBe(
      "Updated from your latest check-in.",
    );
  });

  it("a week-old update reads as last-week-ish", () => {
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: isoDaysAgo(6) }).detail).toBe(
      "Based on the last week or so of logging.",
    );
  });

  it("a stale update is honestly flagged as not refreshed", () => {
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: isoDaysAgo(60) }).detail).toContain(
      "hasn't refreshed in a while",
    );
  });

  it("a missing or unparseable timestamp omits the detail line", () => {
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: null }).detail).toBe("");
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: "not-a-date" }).detail).toBe("");
  });

  it("a future timestamp (clock skew) is not asserted as a real update", () => {
    expect(buildExpenditureTrendCopy({ ...base, adaptiveUpdatedAt: isoDaysAgo(-5) }).detail).toBe("");
  });
});

describe("buildExpenditureTrendCopy — measured (Apple Health) wins", () => {
  it("prefers the measured value over a confident adaptive value", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2200,
      adaptiveConfidence: "high",
      adaptiveUpdatedAt: isoDaysAgo(1),
      measuredTdee: 2476,
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("measured");
    expect(copy.roundedKcal).toBe(2480);
    expect(copy.line).toContain("about ~2,480 kcal/day lately");
    expect(copy.line).toContain("Apple Health");
    expect(copy.chipLevel).toBe("high");
  });

  it("uses measured even when adaptive confidence is low", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 1800,
      adaptiveConfidence: "low",
      adaptiveUpdatedAt: isoDaysAgo(1),
      measuredTdee: 2300,
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("measured");
    expect(copy.roundedKcal).toBe(2300);
  });
});

describe("buildExpenditureTrendCopy — still-learning state", () => {
  it("shows reassurance and NO number when there is no adaptive estimate yet", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: null,
      adaptiveConfidence: null,
      adaptiveUpdatedAt: null,
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("none");
    expect(copy.roundedKcal).toBeNull();
    expect(copy.chipLevel).toBeNull();
    expect(copy.line).toBe("We're still learning your expenditure pattern.");
    expect(copy.detail).toContain("Keep logging");
  });

  it("keeps a low-confidence adaptive value in the learning state with NO number but a low chip", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2100,
      adaptiveConfidence: "low",
      adaptiveUpdatedAt: isoDaysAgo(2),
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("none");
    expect(copy.roundedKcal).toBeNull();
    expect(copy.chipLevel).toBe("low");
    // Critically, no kcal figure leaks into the line at low confidence.
    expect(copy.line).not.toMatch(/\d/);
  });

  it("treats a non-positive or non-finite adaptive value as no estimate", () => {
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      const copy = buildExpenditureTrendCopy({
        adaptiveTdee: bad,
        adaptiveConfidence: "high",
        adaptiveUpdatedAt: isoDaysAgo(1),
        now: FIXED_NOW,
      });
      expect(copy.source, `adaptiveTdee=${bad}`).toBe("none");
      expect(copy.roundedKcal).toBeNull();
    }
  });

  it("ignores a non-positive measured value and falls back to adaptive", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2200,
      adaptiveConfidence: "high",
      adaptiveUpdatedAt: isoDaysAgo(1),
      measuredTdee: 0,
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("adaptive");
    expect(copy.roundedKcal).toBe(2200);
  });
});
