import { describe, expect, it } from "vitest";
import { didStreakReset } from "../../src/lib/nutrition/streakReset";

/**
 * Unit tests for the L6 G8 streak-reset predicate (2026-04-18).
 *
 * `didStreakReset(prior, current)` returns true iff the protected
 * streak transitioned from a positive value to zero — the exact
 * condition that should fire the `streak_reset` analytics event so
 * D3's "freeze save rate" metric has a denominator.
 */

describe("didStreakReset", () => {
  it("returns false on first render (prior null) even when current is 0", () => {
    // First render seeds the ref with null — a zero-streak user who
    // just opened the app should NOT fire `streak_reset`. The event
    // fires only on a real >=1 → 0 transition.
    expect(didStreakReset(null, 0)).toBe(false);
  });

  it("returns false on first render (prior null) even when current is positive", () => {
    expect(didStreakReset(null, 5)).toBe(false);
  });

  it("returns true on a 1 → 0 transition", () => {
    expect(didStreakReset(1, 0)).toBe(true);
  });

  it("returns true on a 7 → 0 transition", () => {
    // Week-long streak broken.
    expect(didStreakReset(7, 0)).toBe(true);
  });

  it("returns false on repeated zero-reads (0 → 0)", () => {
    // Once the event has fired, subsequent renders with prior=0
    // must NOT re-fire — this is the debounce we need.
    expect(didStreakReset(0, 0)).toBe(false);
  });

  it("returns false on a positive → positive change (e.g. 5 → 6)", () => {
    // Streak grew. Not a reset.
    expect(didStreakReset(5, 6)).toBe(false);
  });

  it("returns false on a positive → positive decrease that stays positive (5 → 3)", () => {
    // Freeze budget shrunk but the streak is still alive — not a
    // reset. (In practice `computeProtectedStreak` shouldn't produce
    // this, but the predicate stays defensive.)
    expect(didStreakReset(5, 3)).toBe(false);
  });

  it("treats NaN inputs as non-transitions", () => {
    expect(didStreakReset(NaN, 0)).toBe(false);
    expect(didStreakReset(5, NaN)).toBe(false);
  });

  it("treats negative numbers as non-transitions (defensive)", () => {
    // `computeProtectedStreak` returns `streakLength >= 0` — but if
    // upstream math ever emits a negative, we don't want to pretend
    // that was a reset. Only `>=1 → 0` fires.
    expect(didStreakReset(-1, 0)).toBe(false);
  });
});
