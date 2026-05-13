/**
 * progressDataContract — pins the three Progress empty-state floors
 * + their fail-closed posture.
 *
 * Authority: ENG-97 +
 * `docs/decisions/2026-05-13-progress-empty-state-contract.md`.
 */

import { describe, expect, it } from "vitest";
import {
  MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE,
  MIN_LOGGING_DAYS_FOR_STORY,
  MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE,
  MIN_WEIGH_INS_FOR_TREND,
  hasEnoughDataForAdaptiveTDEE,
  hasEnoughDataForStory,
  hasEnoughWeighInsForTrend,
} from "../../src/lib/nutrition/progressDataContract";

describe("progressDataContract — threshold values", () => {
  it("pins the story floor at 3 days", () => {
    expect(MIN_LOGGING_DAYS_FOR_STORY).toBe(3);
  });

  it("pins the adaptive-TDEE floor at 7 logging days / 3 weigh-ins", () => {
    expect(MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE).toBe(7);
    expect(MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE).toBe(3);
  });

  it("pins the trend-line floor at 2 weigh-ins", () => {
    expect(MIN_WEIGH_INS_FOR_TREND).toBe(2);
  });
});

describe("hasEnoughDataForStory", () => {
  it("returns false below the floor", () => {
    expect(hasEnoughDataForStory(0)).toBe(false);
    expect(hasEnoughDataForStory(1)).toBe(false);
    expect(hasEnoughDataForStory(2)).toBe(false);
  });

  it("returns true at and above the floor", () => {
    expect(hasEnoughDataForStory(3)).toBe(true);
    expect(hasEnoughDataForStory(28)).toBe(true);
  });

  it("fails closed on non-finite / negative input", () => {
    expect(hasEnoughDataForStory(NaN)).toBe(false);
    expect(hasEnoughDataForStory(Infinity)).toBe(false);
    expect(hasEnoughDataForStory(-Infinity)).toBe(false);
    expect(hasEnoughDataForStory(-5)).toBe(false);
  });
});

describe("hasEnoughDataForAdaptiveTDEE", () => {
  it("returns false when below either floor", () => {
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 6, weighInCount: 3 })).toBe(false);
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 7, weighInCount: 2 })).toBe(false);
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 0, weighInCount: 0 })).toBe(false);
  });

  it("returns true when both floors are met", () => {
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 7, weighInCount: 3 })).toBe(true);
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 28, weighInCount: 7 })).toBe(true);
  });

  it("fails closed on non-finite input", () => {
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: NaN, weighInCount: 3 })).toBe(false);
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: 7, weighInCount: NaN })).toBe(false);
    expect(hasEnoughDataForAdaptiveTDEE({ loggingDays: Infinity, weighInCount: Infinity })).toBe(false);
  });
});

describe("hasEnoughWeighInsForTrend", () => {
  it("returns false below 2", () => {
    expect(hasEnoughWeighInsForTrend(0)).toBe(false);
    expect(hasEnoughWeighInsForTrend(1)).toBe(false);
  });

  it("returns true at and above 2", () => {
    expect(hasEnoughWeighInsForTrend(2)).toBe(true);
    expect(hasEnoughWeighInsForTrend(50)).toBe(true);
  });

  it("fails closed on non-finite input", () => {
    expect(hasEnoughWeighInsForTrend(NaN)).toBe(false);
    expect(hasEnoughWeighInsForTrend(-1)).toBe(false);
  });
});
