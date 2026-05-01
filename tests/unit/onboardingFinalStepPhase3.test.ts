/**
 * onboardingFinalStepPhase3 — pins the Phase 3 (B2.3, 2026-04-27)
 * onboarding "Pick 5 recipes" final-step selection logic.
 *
 * Authority: D-2026-04-27-14 (onboarding produces first plan).
 * Source: src/lib/onboarding/finalStep.ts
 *
 * What's pinned:
 *   - togglePick adds / removes ids without mutating the input.
 *   - derivePickerState returns canSubmit=false below threshold,
 *     true at or above.
 *   - The CTA label switches from "Pick N more to continue" to
 *     "Build my first week" exactly at threshold.
 *   - Counter copy caps at the threshold (no "12 of 5" output).
 *   - ONBOARDING_PICK_MIN === NORTH_STAR_LIBRARY_MIN (single source
 *     of truth — the two surfaces can't drift).
 */

import { describe, it, expect } from "vitest";

import {
  togglePick,
  derivePickerState,
  pickCounterLabel,
  ONBOARDING_PICK_MIN,
} from "../../src/lib/onboarding/finalStep";
import { NORTH_STAR_LIBRARY_MIN } from "../../src/lib/nutrition/northStarSuggestion";

describe("togglePick", () => {
  it("adds an id when not present", () => {
    const before = new Set<string>(["a"]);
    const after = togglePick(before, "b");
    expect(after.has("b")).toBe(true);
    expect(after.size).toBe(2);
  });

  it("removes an id when already present", () => {
    const before = new Set<string>(["a", "b"]);
    const after = togglePick(before, "a");
    expect(after.has("a")).toBe(false);
    expect(after.size).toBe(1);
  });

  it("returns a new Set instance (does not mutate input)", () => {
    const before = new Set<string>(["a"]);
    const after = togglePick(before, "b");
    expect(after).not.toBe(before);
    expect(before.size).toBe(1);
  });
});

describe("derivePickerState — CTA threshold gating", () => {
  it("canSubmit=false when picked.size === 0", () => {
    const s = derivePickerState(new Set());
    expect(s.canSubmit).toBe(false);
    expect(s.remaining).toBe(ONBOARDING_PICK_MIN);
    expect(s.ctaLabel).toBe(`Pick ${ONBOARDING_PICK_MIN} more to continue`);
  });

  it("canSubmit=false at picked.size === threshold-1", () => {
    const ids = Array.from({ length: ONBOARDING_PICK_MIN - 1 }, (_, i) => `r${i}`);
    const s = derivePickerState(new Set(ids));
    expect(s.canSubmit).toBe(false);
    expect(s.remaining).toBe(1);
    expect(s.ctaLabel).toBe("Pick 1 more to continue");
  });

  it("canSubmit=true exactly at threshold", () => {
    const ids = Array.from({ length: ONBOARDING_PICK_MIN }, (_, i) => `r${i}`);
    const s = derivePickerState(new Set(ids));
    expect(s.canSubmit).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.ctaLabel).toBe("Build my first week");
  });

  it("canSubmit=true above threshold (oversubscription is fine)", () => {
    const ids = Array.from({ length: ONBOARDING_PICK_MIN + 4 }, (_, i) => `r${i}`);
    const s = derivePickerState(new Set(ids));
    expect(s.canSubmit).toBe(true);
    expect(s.ctaLabel).toBe("Build my first week");
  });
});

describe("pickCounterLabel — UI copy", () => {
  it("renders '0 of N picked' at start", () => {
    expect(pickCounterLabel(new Set())).toBe(`0 of ${ONBOARDING_PICK_MIN} picked`);
  });

  it("renders '4 of 5 picked' at threshold-1 (when threshold=5)", () => {
    if (ONBOARDING_PICK_MIN !== 5) return; // skip — threshold may shift via flag
    const ids = ["a", "b", "c", "d"];
    expect(pickCounterLabel(new Set(ids))).toBe("4 of 5 picked");
  });

  it("caps at threshold even when over-picked", () => {
    const ids = Array.from({ length: ONBOARDING_PICK_MIN + 7 }, (_, i) => `r${i}`);
    expect(pickCounterLabel(new Set(ids))).toBe(
      `${ONBOARDING_PICK_MIN} of ${ONBOARDING_PICK_MIN} picked`,
    );
  });
});

describe("threshold parity with the north-star library minimum", () => {
  it("ONBOARDING_PICK_MIN === NORTH_STAR_LIBRARY_MIN (single source of truth)", () => {
    // The onboarding final step's threshold IS the north-star
    // block's library threshold. Picking 5 in onboarding is what
    // makes the north-star block render meaningful suggestions on
    // first launch — they're inherently the same number. If a
    // future flag binds this to 3 or 1, both surfaces shift in
    // lockstep.
    expect(ONBOARDING_PICK_MIN).toBe(NORTH_STAR_LIBRARY_MIN);
  });
});
