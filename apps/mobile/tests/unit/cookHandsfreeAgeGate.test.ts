/**
 * Cook handsfree v2 — age-gate behaviour (legal P0, 2026-05-02).
 *
 * Pins the contract that the toggle is disabled with an explanatory
 * tooltip when the user is below the minimum age OR when their age
 * is unknown to the build. This is the legal review's hardest
 * constraint — the privacy policy + consent UX make claims about
 * audio capture that we cannot make to a 13-year-old.
 *
 * If you ship a regression that lowers the age gate, this file
 * fails. If you remove the gate entirely, the v2 PR review process
 * fails — that change requires a fresh legal sign-off, not a code
 * fix. See `docs/decisions/2026-05-01-cook-voice-handsfree.md`.
 */
import { describe, expect, it } from "vitest";

import {
  COOK_HANDSFREE_MIN_AGE,
  ageGateTooltip,
  resolveHandsfreeAgeGate,
} from "../../lib/cookHandsfree";

describe("cook handsfree age gate (legal P0)", () => {
  it("blocks ages below the minimum (e.g. 14)", () => {
    const result = resolveHandsfreeAgeGate(14);
    expect(result).toBe("blocked_too_young");
    expect(ageGateTooltip(result)).toBe(
      "Voice control is available for users 16 and older.",
    );
  });

  it("blocks the boundary minus one", () => {
    const result = resolveHandsfreeAgeGate(COOK_HANDSFREE_MIN_AGE - 1);
    expect(result).toBe("blocked_too_young");
  });

  it("allows the boundary age (16)", () => {
    const result = resolveHandsfreeAgeGate(16);
    expect(result).toBe("allowed");
    expect(ageGateTooltip(result)).toBeNull();
  });

  it("allows ages above the minimum", () => {
    expect(resolveHandsfreeAgeGate(25)).toBe("allowed");
    expect(resolveHandsfreeAgeGate(70)).toBe("allowed");
  });

  it("blocks when age is unknown (null / undefined)", () => {
    expect(resolveHandsfreeAgeGate(null)).toBe("blocked_unknown");
    expect(resolveHandsfreeAgeGate(undefined)).toBe("blocked_unknown");
  });

  it("blocks when age is non-finite (NaN, Infinity)", () => {
    expect(resolveHandsfreeAgeGate(Number.NaN)).toBe("blocked_unknown");
    expect(resolveHandsfreeAgeGate(Number.POSITIVE_INFINITY)).toBe(
      "blocked_unknown",
    );
  });

  it("uses the same user-facing tooltip for too-young and unknown", () => {
    // Deliberate: we don't tell the unknown-age user that we don't
    // know their age — they can't act on that information without
    // finishing onboarding, and surfacing it here would feel like
    // a bug to a fully-onboarded user whose `profiles.age` momentarily
    // failed to load.
    expect(ageGateTooltip("blocked_too_young")).toBe(
      "Voice control is available for users 16 and older.",
    );
    expect(ageGateTooltip("blocked_unknown")).toBe(
      "Voice control is available for users 16 and older.",
    );
  });

  it("pins the minimum age constant at 16", () => {
    // If you lower this, the legal review must be re-run. If you raise
    // it, the consent-sheet copy ("...users 16 and older") must update
    // in lockstep.
    expect(COOK_HANDSFREE_MIN_AGE).toBe(16);
  });
});
