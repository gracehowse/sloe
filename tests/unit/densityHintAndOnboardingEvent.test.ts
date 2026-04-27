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

describe("onboarding_completed event fires from both mobile paths (P1-13 + polish A.4)", () => {
  it("the analytics events catalog declares onboarding_completed (shared name across web + mobile)", () => {
    const src = read("src/lib/analytics/events.ts");
    expect(src).toMatch(/onboarding_completed:\s*["']onboarding_completed["']/);
  });

  describe("mobile onboarding.tsx", () => {
    const src = read("apps/mobile/app/onboarding.tsx");

    it("fires the event from the skip path with `path: \"skip\"`", () => {
      // Skip path fires before navigating to /paywall?from=onboarding.
      // Pattern: track(AnalyticsEvents.onboarding_completed, { path: "skip" })
      expect(src).toMatch(
        /track\(\s*AnalyticsEvents\.onboarding_completed\s*,\s*\{[^}]*path:\s*["']skip["']/,
      );
    });

    it("fires the event from the saveAndFinish path with `path: \"full\"` plus three onboarding-decision properties", () => {
      // Full path includes goal_type, plan_pace, nutrition_strategy for cohort analysis.
      expect(src).toMatch(/path:\s*["']full["']/);
      expect(src).toMatch(/goal_type:\s*data\.goalType/);
      expect(src).toMatch(/plan_pace:\s*data\.planPace/);
      expect(src).toMatch(/nutrition_strategy:\s*data\.strategy/);
    });

    it("the event fire is wrapped in try/catch so analytics SDK errors never block onboarding completion", () => {
      // Both onboarding paths must wrap the track() call in try/catch
      // because a thrown PostHog error during onboarding would be the
      // worst possible UX moment for the user.
      const skipMatchIdx = src.indexOf('path: "skip"');
      const fullMatchIdx = src.indexOf('path: "full"');
      expect(skipMatchIdx).toBeGreaterThan(0);
      expect(fullMatchIdx).toBeGreaterThan(0);

      // 500-char window on each side. The full-completion path's
      // try/catch wraps a multi-property payload so the closing
      // `} catch` lands ~270 chars after `path: "full"`.
      const skipCtx = src.slice(Math.max(0, skipMatchIdx - 500), skipMatchIdx + 500);
      const fullCtx = src.slice(Math.max(0, fullMatchIdx - 500), fullMatchIdx + 500);
      expect(skipCtx).toMatch(/try\s*\{/);
      expect(skipCtx).toMatch(/\}\s*catch/);
      expect(fullCtx).toMatch(/try\s*\{/);
      expect(fullCtx).toMatch(/\}\s*catch/);
    });
  });

  describe("web equivalent (parity check)", () => {
    it("web web-flow.tsx fires the same event so funnels reconcile across platforms", () => {
      const src = read("src/app/components/onboarding-v2/web-flow.tsx");
      expect(src).toMatch(/track\(\s*AnalyticsEvents\.onboarding_completed/);
    });
  });
});
