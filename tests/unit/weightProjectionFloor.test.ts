/**
 * Action 13 Item #8 (2026-04-19) — pin the minimum-days floor before
 * the daily projection block renders.
 *
 * Bug: the "On track for X kg in N weeks" line fired off a 7-day
 * average even when the user had only 2 days of food logged. Two
 * days isn't enough signal to honestly project a 5-week trajectory —
 * a single high or low day skewed the average by ±700 kcal.
 *
 * Fix: the projection block is gated on
 * `shouldRenderDailyProjection(daysWithFood)`, which returns true only
 * at ≥`MIN_DAYS_FOR_PROJECTION` (5). Below the floor the dashboard
 * suppresses the line entirely (no placeholder copy — silence is
 * honest).
 */
import { describe, expect, it } from "vitest";

import {
  MIN_DAYS_FOR_PROJECTION,
  shouldRenderDailyProjection,
} from "../../src/lib/weightProjection";

describe("shouldRenderDailyProjection (Item #8)", () => {
  it("MIN_DAYS_FOR_PROJECTION is 5", () => {
    expect(MIN_DAYS_FOR_PROJECTION).toBe(5);
  });

  it("returns false at 2 days (suppressed)", () => {
    expect(shouldRenderDailyProjection(2)).toBe(false);
  });

  it("returns false at 4 days (suppressed)", () => {
    expect(shouldRenderDailyProjection(4)).toBe(false);
  });

  it("returns true at 5 days (renders)", () => {
    expect(shouldRenderDailyProjection(5)).toBe(true);
  });

  it("returns true at 7 days (renders)", () => {
    expect(shouldRenderDailyProjection(7)).toBe(true);
  });

  it("returns false at 0 days", () => {
    expect(shouldRenderDailyProjection(0)).toBe(false);
  });

  it("treats non-finite input as not eligible", () => {
    // Both NaN and Infinity fail `Number.isFinite`, so neither passes
    // the gate — degenerate inputs from upstream bugs (e.g. dividing
    // by zero on a future code path) should never accidentally render
    // the projection block.
    expect(shouldRenderDailyProjection(Number.NaN)).toBe(false);
    expect(shouldRenderDailyProjection(Number.POSITIVE_INFINITY)).toBe(false);
    expect(shouldRenderDailyProjection(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});
