/**
 * Onboarding inclusion-defaults pin (2026-04-19 D&I audit P1s).
 *
 * Three structural invariants that, if silently regressed, quietly harm
 * trans / non-binary users and screen-reader users:
 *
 *   1. `INITIAL_DATA.sex` is `"unspecified"`, not `"female"`. A skipper
 *      must not be silently assigned a biological sex before they see
 *      the field. The BMR floor falls back to the midpoint for
 *      unspecified (see `src/lib/nutrition/tdee.ts:budgetSafety`).
 *
 *   2. The `skip` path (user taps "Skip" on the top bar) calls
 *      `calculateTDEE("unspecified", …)`, not `calculateTDEE("female",
 *      …)`. Same reason.
 *
 *   3. The onboarding back button has `accessibilityLabel="Back"`.
 *      Icon-only chevrons without a label read as nothing to
 *      screen-reader users.
 *
 * Source-level regex pin, same style as `keyboardSafeViewAdoption`.
 * Full RNTL render of a 1000-line onboarding flow is unnecessary and
 * slow for these three assertions.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ONBOARDING = resolve(__dirname, "../../app/onboarding.tsx");

describe("onboarding inclusion defaults — D&I audit 2026-04-19", () => {
  const src = readFileSync(ONBOARDING, "utf8");

  it("INITIAL_DATA.sex defaults to 'unspecified' (not 'female')", () => {
    // Assert the literal key/value inside the INITIAL_DATA object.
    // A regression to `sex: "female"` would silently assign a sex to
    // any user who skips the Basic Info step.
    const hasUnspecifiedDefault = /INITIAL_DATA[\s\S]*?sex:\s*"unspecified"/.test(src);
    const hasFemaleDefault = /INITIAL_DATA[\s\S]*?sex:\s*"female"/.test(src);
    expect(hasUnspecifiedDefault).toBe(true);
    expect(hasFemaleDefault).toBe(false);
  });

  it("skip-path TDEE uses sex='unspecified', not sex='female'", () => {
    // The skip-handler computes a default budget before routing to the
    // paywall. Must not pass "female" — that's the bug we just fixed.
    const hasUnspecifiedSkip = /calculateTDEE\(\s*"unspecified"/.test(src);
    const hasFemaleSkip = /calculateTDEE\(\s*"female"/.test(src);
    expect(hasUnspecifiedSkip).toBe(true);
    expect(hasFemaleSkip).toBe(false);
  });

  it("back button has an accessibilityLabel (not icon-only)", () => {
    // The chevron-back Ionicon on the top bar is icon-only; without
    // an accessibilityLabel, a VoiceOver user hears nothing useful.
    const hasBackLabel = /accessibilityLabel=["']Back["']/.test(src);
    expect(hasBackLabel).toBe(true);
  });

  it("animateTransition respects reduce-motion", () => {
    // If the user has Reduce Motion on, the onboarding fade sequence
    // must early-exit instead of running the 120/200ms timing.
    const hasReduceMotionRef = /reduceMotionRef\.current/.test(src);
    const usesAccessibilityInfo = /AccessibilityInfo\.isReduceMotionEnabled\(\)/.test(src);
    expect(hasReduceMotionRef).toBe(true);
    expect(usesAccessibilityInfo).toBe(true);
  });
});
