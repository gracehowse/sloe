/**
 * selectOnboardingSeeds — executing tests for the shared seed-selection
 * decision both onboarding flows call (web-flow.tsx + mobile-flow.tsx).
 *
 * Extracted 2026-05-30 (picker cut) so web + mobile resolve identical
 * seeds from identical inputs instead of duplicating an inline ternary.
 * Source: src/lib/onboarding/onboardingSeeds.ts.
 *
 * The selector encodes the precedence the flows depend on:
 *   1. picks present        → use exactly those seeds (usedDefaults=false)
 *   2. no picks + disabled  → [] (the kill-switch reproduces the
 *                              pre-2026-04-30 empty-library behaviour)
 *   3. no picks + enabled   → curated defaults, diet/allergen-filtered
 *                              (usedDefaults=true)
 *
 * These run the real function (not a source grep) so the activation
 * contract — "a normal completion lands with ≥5 varied recipes unless
 * the kill switch is explicitly thrown" — is pinned by execution.
 */

import { describe, it, expect } from "vitest";

import {
  ONBOARDING_DEFAULT_SEED_SLUGS,
  ONBOARDING_SEEDS,
  selectOnboardingSeeds,
} from "../../src/lib/onboarding/onboardingSeeds";

describe("selectOnboardingSeeds — picks present", () => {
  it("returns exactly the picked seeds in slug order, usedDefaults=false", () => {
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: ["korean-beef-bulgogi", "tuna-poke-bowl"],
      diet: [],
    });
    expect(r.usedDefaults).toBe(false);
    expect(r.seeds.map((s) => s.slug).sort()).toEqual(
      ["korean-beef-bulgogi", "tuna-poke-bowl"].sort(),
    );
  });

  it("ignores the diet/allergen filter when the user hand-picked", () => {
    // A vegan who explicitly picked an omnivore seed keeps it — picks
    // are an explicit commitment and override the curated fallback.
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: ["korean-beef-bulgogi"],
      diet: ["vegan"],
    });
    expect(r.usedDefaults).toBe(false);
    expect(r.seeds).toHaveLength(1);
    expect(r.seeds[0].slug).toBe("korean-beef-bulgogi");
  });

  it("drops unknown slugs rather than inventing seeds", () => {
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: ["korean-beef-bulgogi", "does-not-exist"],
      diet: [],
    });
    expect(r.seeds.map((s) => s.slug)).toEqual(["korean-beef-bulgogi"]);
  });
});

describe("selectOnboardingSeeds — no picks, kill switch thrown", () => {
  it("returns an empty library when seedingDisabled is true", () => {
    // The fail-safe path: only reached when the `onboarding_default_seeds`
    // flag resolves EXPLICITLY off. Reproduces the pre-2026-04-30
    // empty-library behaviour so the unified seeding can roll back
    // without a deploy.
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: [],
      diet: [],
      seedingDisabled: true,
    });
    expect(r.seeds).toEqual([]);
    expect(r.usedDefaults).toBe(false);
  });

  it("still empties even with a diet set (disabled wins over fallback)", () => {
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: [],
      diet: ["vegan"],
      seedingDisabled: true,
    });
    expect(r.seeds).toEqual([]);
    expect(r.usedDefaults).toBe(false);
  });
});

describe("selectOnboardingSeeds — no picks, seeding enabled (default)", () => {
  it("seeds the curated 5 defaults when seedingDisabled is omitted", () => {
    const r = selectOnboardingSeeds({ pickedRecipeSlugs: [], diet: [] });
    expect(r.usedDefaults).toBe(true);
    expect(r.seeds).toHaveLength(ONBOARDING_DEFAULT_SEED_SLUGS.length);
    // Membership, not order — defaults are emitted in canonical
    // ONBOARDING_SEEDS order, which differs from the slug-list order.
    expect(new Set(r.seeds.map((s) => s.slug))).toEqual(
      new Set(ONBOARDING_DEFAULT_SEED_SLUGS),
    );
  });

  it("seeds the curated 5 defaults when seedingDisabled is explicitly false", () => {
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: [],
      diet: [],
      seedingDisabled: false,
    });
    expect(r.usedDefaults).toBe(true);
    expect(r.seeds.length).toBeGreaterThanOrEqual(5);
  });

  it("hits the north-star library minimum (≥5) so the activation block renders", () => {
    const r = selectOnboardingSeeds({ pickedRecipeSlugs: [], diet: [] });
    expect(r.seeds.length).toBeGreaterThanOrEqual(5);
  });

  it("diet-filters the defaults to vegan-safe seeds for a vegan", () => {
    // None of the canonical 5 except the chickpea curry are vegan; the
    // fallback must still return only vegan-tagged seeds, never the
    // empty set, so a vegan lands with a non-empty, on-diet library.
    const r = selectOnboardingSeeds({ pickedRecipeSlugs: [], diet: ["vegan"] });
    expect(r.usedDefaults).toBe(true);
    expect(r.seeds.length).toBeGreaterThan(0);
    for (const seed of r.seeds) {
      expect(seed.dietTags.map((t) => t.toLowerCase())).toContain("vegan");
    }
  });

  it("respects allergens — a salmon allergy drops the salmon default", () => {
    const r = selectOnboardingSeeds({
      pickedRecipeSlugs: [],
      diet: [],
      allergies: ["salmon"],
    });
    expect(r.usedDefaults).toBe(true);
    expect(r.seeds.length).toBeGreaterThan(0);
    for (const seed of r.seeds) {
      expect(seed.matchTitle.toLowerCase()).not.toContain("salmon");
    }
  });

  it("every returned default resolves to a real seed in ONBOARDING_SEEDS", () => {
    const known = new Set(ONBOARDING_SEEDS.map((s) => s.slug));
    const r = selectOnboardingSeeds({ pickedRecipeSlugs: [], diet: [] });
    for (const seed of r.seeds) {
      expect(known.has(seed.slug)).toBe(true);
    }
  });
});
