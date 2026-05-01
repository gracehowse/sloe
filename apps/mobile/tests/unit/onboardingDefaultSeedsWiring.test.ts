/**
 * onboardingDefaultSeedsWiring — pins the activation-hook fallback
 * (audit 2026-04-30, leak fix #2) at the source level.
 *
 * The mobile onboarding flow's `handleComplete` must seed the user's
 * library with the curated 5 default seeds when
 * `state.pickedRecipeSlugs` is empty. Without this fallback the
 * library starts empty, the north-star block stays in its
 * `library-empty` state forever, and the "What to eat next" promise
 * evaporates.
 *
 * Source-level pins (rather than rendering the full flow) — render-
 * level coverage of the same path lives in
 * `tests/unit/onboardingFinalStepPhase3.test.ts` once
 * `defaultOnboardingSeeds` lands in shared. These pins catch the
 * regressions that matter:
 *   - the import is wired
 *   - the empty-picks branch routes through `defaultOnboardingSeeds`
 *   - the resolver / saver flow still runs against the resolved
 *     defaults (we don't bypass save just because the user didn't
 *     pick anything).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const FLOW_PATH = resolve(
  __dirname,
  "../../components/onboarding/mobile-flow.tsx",
);
const SOURCE = readFileSync(FLOW_PATH, "utf8");

describe("mobile onboarding flow — default-seed fallback wiring", () => {
  it("imports defaultOnboardingSeeds from shared onboardingSeeds", () => {
    expect(SOURCE).toMatch(/defaultOnboardingSeeds/);
    expect(SOURCE).toMatch(
      /from\s+["'][^"']*src\/lib\/onboarding\/onboardingSeeds["']/,
    );
  });

  it("falls back to defaultOnboardingSeeds when pickedRecipeSlugs is empty", () => {
    // The branch must exist — otherwise we revert to the pre-audit
    // `pickedSeeds.length === 0 → skip save` path that left every new
    // user with an empty library.
    expect(SOURCE).toMatch(/state\.pickedRecipeSlugs\.length\s*>\s*0/);
    expect(SOURCE).toMatch(/defaultOnboardingSeeds\(\s*\{/);
  });

  it("passes the user's diet + allergens to defaultOnboardingSeeds", () => {
    // Pin: the fallback honours the user's preferences, not just
    // the canonical 5. A vegan completing without picking must get
    // vegan-safe defaults.
    expect(SOURCE).toMatch(/diet:\s*state\.diet/);
    expect(SOURCE).toMatch(/allergies:\s*state\.allergies/);
  });

  it("still runs the resolver + saver path on the default seeds", () => {
    // Pin: the resolve → save → plan pipeline runs on whatever
    // `pickedSeeds` ends up being — including the curated defaults.
    expect(SOURCE).toMatch(/resolveSeedsToRecipeIds\(\s*supabase\s*,\s*pickedSeeds/);
    expect(SOURCE).toMatch(/saveResolvedSeeds\(\s*supabase/);
  });

  it("exposes a used_default_seeds analytics flag for activation tracking", () => {
    // Pin: we track which users hit the fallback so we can monitor
    // the activation-lift the audit fix is meant to deliver. Removing
    // the flag silently kills the dashboard.
    expect(SOURCE).toMatch(/used_default_seeds/);
  });

  it("routes post-onboarding to Today with firstRun=1 (parity with notifications-prompt)", () => {
    // Activation hook (leak fix #1) — the post-onboarding land must
    // hand Today the same first-run signal the notifications-prompt
    // does. This keeps the post-Reveal flow + the deferred-prompt
    // flow on a single first-run codepath.
    expect(SOURCE).toMatch(/firstRun=1/);
    expect(SOURCE).toMatch(/router\.replace\(`?\/?\(tabs\)/);
  });
});
