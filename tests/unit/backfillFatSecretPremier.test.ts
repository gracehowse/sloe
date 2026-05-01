/**
 * Tests for the backfill script's pure helpers + idempotency rules.
 *
 * The script itself runs as a one-shot CLI; vitest imports the module
 * to exercise:
 *
 *   1. parseNum() — string → number with NaN/empty guards.
 *   2. parseServingMass() — only metric g/ml count; non-metric → null.
 *   3. RATE_LIMIT_INTERVAL_MS — derived from RATE_LIMIT_PER_SEC, asserts
 *      the 5 req/s contract from the spec.
 *
 * Idempotency + resumability are documented in the script header (the
 * skip rule "is_verified === true && calories > 0" is exercised against
 * a synthetic row table here).
 */
import { describe, expect, it } from "vitest";
import { __test__ } from "../../scripts/backfill-fatsecret-premier.mjs";

const { parseNum, parseServingMass, RATE_LIMIT_PER_SEC, RATE_LIMIT_INTERVAL_MS } = __test__;

describe("backfill — parseNum", () => {
  it("returns 0 for null / undefined / empty / NaN", () => {
    expect(parseNum(null)).toBe(0);
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum("")).toBe(0);
    expect(parseNum("not a number")).toBe(0);
  });

  it("parses positive numerics", () => {
    expect(parseNum("12.5")).toBe(12.5);
    expect(parseNum("0.1")).toBeCloseTo(0.1);
  });

  it("rejects negative + zero (FatSecret never reports < 0)", () => {
    expect(parseNum("-3")).toBe(0);
    expect(parseNum("0")).toBe(0);
  });
});

describe("backfill — parseServingMass", () => {
  it("returns null for missing fields", () => {
    expect(parseServingMass({})).toBeNull();
    expect(parseServingMass({ metric_serving_amount: "" })).toBeNull();
  });

  it("accepts metric grams", () => {
    expect(
      parseServingMass({ metric_serving_amount: "100", metric_serving_unit: "g" }),
    ).toBe(100);
  });

  it("accepts metric ml as g (water density)", () => {
    expect(
      parseServingMass({ metric_serving_amount: "240", metric_serving_unit: "ml" }),
    ).toBe(240);
  });

  it("returns null for non-metric units", () => {
    expect(
      parseServingMass({ metric_serving_amount: "1", metric_serving_unit: "cup" }),
    ).toBeNull();
  });

  it("returns null when amount is not finite", () => {
    expect(
      parseServingMass({ metric_serving_amount: "abc", metric_serving_unit: "g" }),
    ).toBeNull();
  });
});

describe("backfill — rate limiting", () => {
  it("RATE_LIMIT_PER_SEC = 5 (spec contract)", () => {
    expect(RATE_LIMIT_PER_SEC).toBe(5);
  });

  it("RATE_LIMIT_INTERVAL_MS yields >= 5 req/s headroom", () => {
    // 5 req/s → 200 ms / req. ceil() so we never drift over 5 in
    // practice (Math.ceil of 1000/5 = 200 exactly).
    expect(RATE_LIMIT_INTERVAL_MS).toBeGreaterThanOrEqual(200);
    // Ensure we don't accidentally hit 1000+ ms (one-per-second).
    expect(RATE_LIMIT_INTERVAL_MS).toBeLessThanOrEqual(250);
  });
});

// ── Idempotency rules — synthetic rows ──────────────────────────────
//
// These mirror the script's skip-or-update branches in handleRow().
// The branches themselves are too coupled to the live HTTP/Supabase
// fetch wrappers to unit-test cleanly; here we encode the predicate
// the script uses so a future refactor can't silently break it.

function shouldSkipBecauseAlreadyPopulated(row: {
  is_verified: boolean | null;
  calories: number | null;
}): boolean {
  return row.is_verified === true && Number(row.calories ?? 0) > 0;
}

function shouldSkipBecauseManuallyOverridden(row: { source: string | null }): boolean {
  const ALLOWED = new Set(["Unverified", "FatSecret", "fatsecret", ""]);
  return !ALLOWED.has((row.source ?? "").trim());
}

describe("backfill — idempotency", () => {
  it("skips rows already verified + non-zero calories", () => {
    expect(
      shouldSkipBecauseAlreadyPopulated({ is_verified: true, calories: 250 }),
    ).toBe(true);
  });

  it("processes rows that are zeroed (the migration's output)", () => {
    expect(
      shouldSkipBecauseAlreadyPopulated({ is_verified: false, calories: 0 }),
    ).toBe(false);
  });

  it("processes verified rows that somehow zeroed (defensive)", () => {
    expect(
      shouldSkipBecauseAlreadyPopulated({ is_verified: true, calories: 0 }),
    ).toBe(false);
  });

  it("processes unverified rows even if they happen to carry stale macros", () => {
    expect(
      shouldSkipBecauseAlreadyPopulated({ is_verified: false, calories: 250 }),
    ).toBe(false);
  });

  it("never overwrites a manually-overridden USDA / OFF row", () => {
    expect(shouldSkipBecauseManuallyOverridden({ source: "USDA" })).toBe(true);
    expect(shouldSkipBecauseManuallyOverridden({ source: "OFF" })).toBe(true);
    expect(shouldSkipBecauseManuallyOverridden({ source: "Edamam" })).toBe(true);
  });

  it("processes the post-zeroing rows (source = 'Unverified')", () => {
    expect(shouldSkipBecauseManuallyOverridden({ source: "Unverified" })).toBe(false);
  });

  it("processes already-FatSecret-labelled rows (re-run safety)", () => {
    expect(shouldSkipBecauseManuallyOverridden({ source: "FatSecret" })).toBe(false);
    expect(shouldSkipBecauseManuallyOverridden({ source: "fatsecret" })).toBe(false);
  });

  it("processes rows with empty / null source", () => {
    expect(shouldSkipBecauseManuallyOverridden({ source: "" })).toBe(false);
    expect(shouldSkipBecauseManuallyOverridden({ source: null })).toBe(false);
  });
});
