/**
 * ENG-953 — the mobile `ExpenditureTrendCard` consumes the SAME
 * `buildExpenditureTrendCopy` helper as web, via the `@suppr/shared` alias.
 * This test resolves the helper through that exact mobile import path and
 * re-asserts the load-bearing guarantees so mobile copy can't silently drift
 * from web (which is covered by `tests/unit/expenditureTrend.test.ts`).
 */

import { describe, it, expect } from "vitest";

import { buildExpenditureTrendCopy } from "@suppr/shared/progress/expenditureTrend";

const FIXED_NOW = Date.parse("2026-06-30T12:00:00.000Z");
const isoDaysAgo = (n: number) => new Date(FIXED_NOW - n * 86_400_000).toISOString();

describe("buildExpenditureTrendCopy (mobile @suppr/shared resolution)", () => {
  it("a confident adaptive value rounds to the nearest 10 and never leaks the raw integer", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2347,
      adaptiveConfidence: "high",
      adaptiveUpdatedAt: isoDaysAgo(0),
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("adaptive");
    expect(copy.roundedKcal).toBe(2350);
    expect(copy.line).toContain("about ~2,350 kcal/day lately");
    expect(copy.line).not.toContain("2347");
  });

  it("a low-confidence value stays in the still-learning state with NO number", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2100,
      adaptiveConfidence: "low",
      adaptiveUpdatedAt: isoDaysAgo(2),
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("none");
    expect(copy.chipLevel).toBe("low");
    expect(copy.line).not.toMatch(/\d/);
  });

  it("prefers a measured Apple Health value over adaptive", () => {
    const copy = buildExpenditureTrendCopy({
      adaptiveTdee: 2200,
      adaptiveConfidence: "high",
      adaptiveUpdatedAt: isoDaysAgo(1),
      measuredTdee: 2476,
      now: FIXED_NOW,
    });
    expect(copy.source).toBe("measured");
    expect(copy.roundedKcal).toBe(2480);
    expect(copy.line).toContain("Apple Health");
  });
});
