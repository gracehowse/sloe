/**
 * Motion foundation — pure odometer math (mobile twin) — ENG-812.
 *
 * Mirror of `tests/unit/motion.test.ts` (web). It imports the SAME math two
 * ways:
 *   1. through `@suppr/shared/motion` (the shared source of truth), and
 *   2. through `@/lib/motion` (the mobile wrapper that re-exports it),
 * and asserts both agree — so the mobile Reanimated wrapper can never expose
 * a curve or spring constant that has drifted from the shared web source.
 *
 * Pure math only → runs under the default `node` test environment (no
 * Reanimated / renderer needed for these functions). The hooks (`useOdometer`,
 * `useSheetMorph`) are thin RAF/Reanimated wrappers over this math; their
 * behaviour is exercised in the screen-level redesign tests once consumers
 * land. This file pins the maths + the personality constants.
 */
import { describe, it, expect } from "vitest";

import {
  ODOMETER_MS as SHARED_MS,
  PROGRESSIVE_TEXT_STAGGER_MS,
  SHEET_MORPH_SCALE as SHARED_MORPH,
  odometerProgress as sharedProgress,
  odometerValue as sharedValue,
  progressiveTextDelayMs,
  tokenizeProgressiveText,
} from "@suppr/shared/motion";

import {
  ODOMETER_MS,
  SHEET_MORPH_SCALE,
  SPRING_DEFAULT,
  SPRING_SNAPPY,
  odometerProgress,
  odometerValue,
} from "@/lib/motion";

describe("mobile motion re-exports match the shared source (no drift)", () => {
  it("re-exports the identical odometer math", () => {
    expect(odometerValue).toBe(sharedValue);
    expect(odometerProgress).toBe(sharedProgress);
    expect(ODOMETER_MS).toBe(SHARED_MS);
    expect(SHEET_MORPH_SCALE).toBe(SHARED_MORPH);
  });

  it("wraps the shared spring numbers into Reanimated configs", () => {
    expect(SPRING_DEFAULT).toEqual({ damping: 18, stiffness: 200, mass: 0.7 });
    expect(SPRING_SNAPPY).toEqual({ damping: 22, stiffness: 280, mass: 0.5 });
  });
});

describe("odometerValue (mobile)", () => {
  it("returns the rounded start value at t = 0", () => {
    expect(odometerValue(1200, 1850, 0)).toBe(1200);
  });

  it("lands exactly on target at t = 1", () => {
    expect(odometerValue(0, 1847, 1)).toBe(1847);
    expect(odometerValue(123, 1846.4, 1)).toBe(1846.4);
  });

  it("clamps out-of-range t", () => {
    expect(odometerValue(100, 900, -0.5)).toBe(100);
    expect(odometerValue(100, 900, 1.5)).toBe(900);
  });

  it("is monotonic non-decreasing while counting up", () => {
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const v = odometerValue(0, 2000, i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("uses cubic-out easing (875 of 1000 by the halfway point)", () => {
    expect(odometerValue(0, 1000, 0.5)).toBe(875);
  });
});

describe("odometerProgress (mobile)", () => {
  it("is 0 at start and 1 (clamped) once elapsed", () => {
    expect(odometerProgress(1_000, 1_000, 900)).toBe(0);
    expect(odometerProgress(1_000, 1_900, 900)).toBe(1);
    expect(odometerProgress(1_000, 9_999, 900)).toBe(1);
  });

  it("is the linear fraction mid-tween", () => {
    expect(odometerProgress(1_000, 1_450, 900)).toBeCloseTo(0.5, 5);
  });

  it("defaults to the shared ODOMETER_MS duration", () => {
    expect(odometerProgress(0, ODOMETER_MS / 2)).toBeCloseTo(0.5, 5);
  });
});

describe("progressive text reveal (shared tokenizer + stagger — ENG-720)", () => {
  it("splits a phrase into one token per word, trailing space attached", () => {
    expect(tokenizeProgressiveText("Cook what you love.")).toEqual([
      "Cook ",
      "what ",
      "you ",
      "love.",
    ]);
  });

  it("re-joining the tokens reproduces the source string exactly", () => {
    const source = "Cook what you love. Still reach your goals.";
    expect(tokenizeProgressiveText(source).join("")).toBe(source);
  });

  it("returns an empty list for empty / whitespace-only input", () => {
    expect(tokenizeProgressiveText("")).toEqual([]);
    expect(tokenizeProgressiveText("   ")).toEqual([]);
  });

  it("staggers each token by PROGRESSIVE_TEXT_STAGGER_MS (0-based, never negative)", () => {
    expect(progressiveTextDelayMs(0)).toBe(0);
    expect(progressiveTextDelayMs(2)).toBe(2 * PROGRESSIVE_TEXT_STAGGER_MS);
    expect(progressiveTextDelayMs(-1)).toBe(0);
  });
});
