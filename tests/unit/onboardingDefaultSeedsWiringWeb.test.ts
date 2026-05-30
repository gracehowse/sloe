/**
 * onboardingDefaultSeedsWiringWeb — pins the activation-hook seeding on
 * the WEB flow at the source level.
 *
 * Web parity (2026-05-30): the seed-selection logic moved out of an
 * inline web-flow ternary into the shared `selectOnboardingSeeds`
 * (src/lib/onboarding/onboardingSeeds.ts) when the Recipes picker was
 * cut, so web + mobile resolve identical seeds from identical inputs.
 * The selector's own behaviour is covered by execution in
 * `selectOnboardingSeeds.test.ts`; this test guards that web-flow.tsx
 * actually *wires* it (and the flag gate) rather than reverting to the
 * pre-parity empty-library path. Mirror of
 * `apps/mobile/tests/unit/onboardingDefaultSeedsWiring.test.ts`.
 *
 * Pins:
 *   - the shared selector is imported + called with the user's
 *     picks/diet/allergens
 *   - the `onboarding_default_seeds` kill switch is read via
 *     `isFeatureDisabled` (fail-safe default-ON — a cold PostHog must
 *     NOT skip seeding)
 *   - the resolver / saver flow still runs against the selected seeds
 *   - the `used_default_seeds` analytics flag is exposed
 *   - the completed user lands on /home
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const FLOW_PATH = resolve(
  __dirname,
  "../../src/app/components/onboarding/web-flow.tsx",
);
const SOURCE = readFileSync(FLOW_PATH, "utf8");

describe("web onboarding flow — default-seed fallback wiring", () => {
  it("imports the shared selectOnboardingSeeds from @/lib/onboarding/onboardingSeeds", () => {
    expect(SOURCE).toMatch(/selectOnboardingSeeds/);
    expect(SOURCE).toMatch(
      /import\s*\{[^}]*selectOnboardingSeeds[^}]*\}\s*from\s+["'][^"']*@\/lib\/onboarding\/onboardingSeeds["']/,
    );
  });

  it("calls selectOnboardingSeeds with the user's picks, diet + allergens", () => {
    // The selector decides picks-vs-defaults; web-flow must hand it the
    // real onboarding state so a vegan completing without picking still
    // gets vegan-safe defaults.
    expect(SOURCE).toMatch(/selectOnboardingSeeds\(\s*\{/);
    expect(SOURCE).toMatch(/pickedRecipeSlugs:\s*state\.pickedRecipeSlugs/);
    expect(SOURCE).toMatch(/diet:\s*state\.diet/);
    expect(SOURCE).toMatch(/allergies:\s*state\.allergies/);
  });

  it("gates seeding behind the onboarding_default_seeds kill switch via isFeatureDisabled", () => {
    // Must be `isFeatureDisabled` (fail-safe default-ON), NOT
    // `!isFeatureEnabled` — a cold PostHog during onboarding completion
    // would otherwise skip seeding and empty the library.
    expect(SOURCE).toMatch(
      /import\s*\{[^}]*isFeatureDisabled[^}]*\}\s*from\s+["'][^"']*@\/lib\/analytics\/track["']/,
    );
    expect(SOURCE).toMatch(
      /seedingDisabled:\s*isFeatureDisabled\(\s*["']onboarding_default_seeds["']\s*\)/,
    );
  });

  it("still runs the resolver + saver path on the selected seeds", () => {
    // Pin: the resolve → save → plan pipeline runs on whatever
    // `pickedSeeds` the selector returns — picks or curated defaults.
    expect(SOURCE).toMatch(
      /resolveSeedsToRecipeIds\(\s*supabase\s*,\s*pickedSeeds/,
    );
    expect(SOURCE).toMatch(/saveResolvedSeeds\(\s*supabase/);
  });

  it("exposes a used_default_seeds analytics flag for activation tracking", () => {
    // Pin: we track which users hit the fallback so the activation-lift
    // dashboards read the same on web + mobile. Removing the flag
    // silently kills the web side of that dashboard.
    expect(SOURCE).toMatch(/used_default_seeds:\s*usedDefaults/);
  });

  it("lands the completed user on /home (web parity of the Today first-run hand-off)", () => {
    // Web routes to /home on completion; mobile routes to (tabs) with
    // firstRun=1. Different surface, same intent — pin the web land so a
    // refactor can't silently drop the post-completion navigation.
    expect(SOURCE).toMatch(/\/home/);
  });
});
