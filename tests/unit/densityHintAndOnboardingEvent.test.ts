/**
 * Polish A.3 + A.4 (2026-04-25 follow-up).
 *
 * A.3 — density hint wiring: pin that the recipe-verify screen
 * consumes `totalGramsForVerifyScaleDetailed` (the version that
 * returns the `densityRefused` flag) and renders the
 * "needs density — switch to g/oz" hint instead of `= 0 g`.
 *
 * A.4 — onboarding_completed event: pin that BOTH onboarding paths
 * (skip + saveAndFinish) fire the analytics event with a `path`
 * discriminator. Mirrors the web web-flow.tsx behaviour from P1-13.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("density-refusal hint on recipe verify screen (P0-2 + polish A.3)", () => {
  it("verify.tsx imports totalGramsForVerifyScaleDetailed", () => {
    const src = read("apps/mobile/app/recipe/verify.tsx");
    expect(src).toMatch(/totalGramsForVerifyScaleDetailed/);
  });

  it("verify.tsx renders the 'needs density' hint and (polish D.8) makes it tappable", () => {
    const src = read("apps/mobile/app/recipe/verify.tsx");
    // Polish D.8 (2026-04-25): the hint is now tappable — tapping it
    // switches the portion to "g" via onPortionChange. Wording: "needs
    // density — tap to switch to g".
    expect(src).toMatch(/needs density\s*—\s*tap to switch to g/);
    // Anchor on the rendered string (not the comment that mentions
    // "needs density" earlier in the file).
    const idx = src.indexOf("needs density — tap to switch to g");
    expect(idx).toBeGreaterThan(0);
    // Wide window — heavy indentation in this file means even ~10
    // lines is ~600+ chars; the Pressable opens roughly 13 lines before
    // the rendered string.
    const window = src.slice(Math.max(0, idx - 1500), idx + 100);
    expect(window).toMatch(/<Pressable/);
    expect(window).toMatch(/onPortionChange\(i,\s*gPortion\)/);
  });

  it("the hint is conditional on detail.densityRefused (so it doesn't show for healthy ml ingredients with resolved density)", () => {
    const src = read("apps/mobile/app/recipe/verify.tsx");
    expect(src).toMatch(/detail\.densityRefused/);
  });

  it("the verify-recipe wrapper re-exports both the legacy and detailed forms (P0-2 contract)", () => {
    const src = read("apps/mobile/lib/verifyRecipe.ts");
    expect(src).toMatch(/export function totalGramsForVerifyScale\b/);
    expect(src).toMatch(/export function totalGramsForVerifyScaleDetailed\b/);
  });

  it("the shared helper exposes the densityRefused signal (refuses rather than guesses)", () => {
    const src = read("src/lib/nutrition/totalGramsForVerifyScale.ts");
    expect(src).toMatch(/densityRefused\?:\s*boolean/);
    expect(src).toMatch(/return\s*\{\s*grams:\s*0,\s*densityRefused:\s*true\s*\}/);
  });
});

describe("onboarding_completed event fires from both platforms (P1-13 + polish A.4)", () => {
  it("the analytics events catalog declares onboarding_completed (shared name across web + mobile)", () => {
    const src = read("src/lib/analytics/events.ts");
    expect(src).toMatch(/onboarding_completed:\s*["']onboarding_completed["']/);
  });

  describe("mobile mobile-flow.tsx", () => {
    // 2026-04-30: legacy `apps/mobile/app/onboarding.tsx` (1102-line
    // form) was deleted as part of the v2 → canonical rename. The
    // entry route is now a thin route mount; the actual completion
    // handler — and the `track(onboarding_completed)` call — lived in
    // `mobile-flow.tsx` until ENG-1507 (2026-07-11) extracted the
    // completion pipeline into `useOnboardingCompletion.ts` (the pins
    // follow the code to its new home). The legacy "skip" path is gone
    // (v2 has a terminal recipes-picker, not a skip-to-paywall
    // short-circuit). What remains is the full-completion path with
    // the three cohort properties.
    const src = read(
      "apps/mobile/components/onboarding/useOnboardingCompletion.ts",
    );

    it("fires the event with the v2 cohort properties (parity with web-flow.tsx)", () => {
      // Property shape was renamed during the v2 → canonical rename
      // (2026-04-30). Old keys: goal_type / plan_pace / nutrition_strategy.
      // New keys: flow / goal / recipes_picked / recipes_resolved /
      // plan_built / weight_skipped — identical to web-flow.tsx's
      // payload so funnels reconcile across platforms.
      expect(src).toMatch(/track\(\s*AnalyticsEvents\.onboarding_completed/);
      expect(src).toMatch(/flow:\s*["']v2["']/);
      expect(src).toMatch(/goal:\s*state\.goal/);
      expect(src).toMatch(/recipes_picked/);
      expect(src).toMatch(/plan_built/);
    });

    it("the authed-completion track call is wrapped in try/catch so analytics SDK errors never block onboarding", () => {
      // There are two track sites in the file: one in the unauthed
      // early-return (line ~106) and the canonical one in the
      // authed-completion handler. The latter is the worst possible
      // failure point for the user (they've finished onboarding —
      // they expect Today, not a stuck button), so it MUST be in a
      // try/catch.
      //
      // Find the SECOND occurrence — that's the authed-completion
      // path. The unauthed early-return does not need wrapping
      // because it returns immediately on track() error.
      const firstIdx = src.indexOf("AnalyticsEvents.onboarding_completed");
      expect(firstIdx).toBeGreaterThan(0);
      const secondIdx = src.indexOf("AnalyticsEvents.onboarding_completed", firstIdx + 1);
      expect(secondIdx).toBeGreaterThan(firstIdx);
      // Window widened from 500 → 1200 after the 2026-04-30 activation
      // hooks audit added the `used_default_seeds` analytics flag with
      // explanatory comments. The block grew past the previous 500-char
      // afterward window. The test still pins what it cares about
      // (try/catch wrapping the canonical authed-completion track)
      // without forcing future audits to keep the analytics block
      // artificially compact.
      const ctx = src.slice(
        Math.max(0, secondIdx - 200),
        secondIdx + 1200,
      );
      expect(ctx).toMatch(/try\s*\{/);
      expect(ctx).toMatch(/\}\s*catch/);
    });
  });

  describe("web equivalent (parity check)", () => {
    it("web web-flow.tsx fires the same event so funnels reconcile across platforms", () => {
      const src = read("src/app/components/onboarding/web-flow.tsx");
      expect(src).toMatch(/track\(\s*AnalyticsEvents\.onboarding_completed/);
    });
  });
});
