/**
 * onboardingDefaultSeedsWiring — pins the activation-hook seeding on the
 * MOBILE flow at the source level.
 *
 * Parity (2026-05-30): the seed-selection logic moved out of an inline
 * mobile-flow ternary into the shared `selectOnboardingSeeds`
 * (@suppr/shared/onboarding/onboardingSeeds) when the Recipes picker was
 * cut, so web + mobile resolve identical seeds from identical inputs.
 * The selector's own behaviour is covered by execution in the web
 * `selectOnboardingSeeds.test.ts`; this test guards that mobile-flow.tsx
 * actually *wires* it (and the flag gate) rather than reverting to the
 * pre-audit empty-library path. Mirror of
 * `tests/unit/onboardingDefaultSeedsWiringWeb.test.ts`.
 *
 * Pins:
 *   - the shared selector is imported + called with the user's
 *     picks/diet/allergens
 *   - the `onboarding_default_seeds` kill switch is read via
 *     `isFeatureDisabled` (fail-safe default-ON — a cold PostHog must
 *     NOT skip seeding)
 *   - the resolver / saver flow still runs against the selected seeds
 *   - the `used_default_seeds` analytics flag is exposed
 *   - the post-onboarding land hands Today the firstRun=1 signal
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// ENG-1507 (2026-07-11): the completion pipeline (incl. the seeding call
// this test pins) was extracted from mobile-flow.tsx into
// `useOnboardingCompletion.ts` — the pins follow the code to its home.
const FLOW_PATH = resolve(
  __dirname,
  "../../components/onboarding/useOnboardingCompletion.ts",
);
const SOURCE = readFileSync(FLOW_PATH, "utf8");

describe("mobile onboarding flow — default-seed fallback wiring", () => {
  it("imports the shared selectOnboardingSeeds from @suppr/shared onboardingSeeds", () => {
    expect(SOURCE).toMatch(/selectOnboardingSeeds/);
    expect(SOURCE).toMatch(
      /import\s*\{[^}]*selectOnboardingSeeds[^}]*\}\s*from\s+["'][^"']*@suppr\/shared\/onboarding\/onboardingSeeds["']/,
    );
  });

  it("calls selectOnboardingSeeds with the user's picks, diet + allergens", () => {
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
      /import\s*\{[^}]*isFeatureDisabled[^}]*\}\s*from\s+["']@\/lib\/analytics["']/,
    );
    expect(SOURCE).toMatch(
      /seedingDisabled:\s*isFeatureDisabled\(\s*["']onboarding_default_seeds["']\s*\)/,
    );
  });

  it("still runs the resolver + saver path on the selected seeds", () => {
    expect(SOURCE).toMatch(
      /resolveSeedsToRecipeIds\(\s*supabase\s*,\s*pickedSeeds/,
    );
    expect(SOURCE).toMatch(/saveResolvedSeeds\(\s*supabase/);
  });

  it("exposes a used_default_seeds analytics flag for activation tracking", () => {
    expect(SOURCE).toMatch(/used_default_seeds:\s*usedDefaults/);
  });

  it("routes post-onboarding to Today with firstRun=1 (parity with notifications-prompt)", () => {
    // Activation hook (leak fix #1) — the post-onboarding land must hand
    // Today the same first-run signal the notifications-prompt does.
    expect(SOURCE).toMatch(/firstRun=1/);
    expect(SOURCE).toMatch(/router\.replace\(`?\/?\(tabs\)/);
  });
});
