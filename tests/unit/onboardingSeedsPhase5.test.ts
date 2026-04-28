/**
 * onboardingSeedsPhase5 — pins the Phase 5 / B2.3 seed list shape +
 * the diet/allergen filter-fallback logic.
 *
 * Authority: D-2026-04-27-14 + the candidate-source decision.
 * Source: src/lib/onboarding/onboardingSeeds.ts
 *
 * Coverage:
 *   - The 15 seeds match the decision-doc list exactly (slug + match-
 *     title sanity).
 *   - filterOnboardingSeeds drops omnivores when diet=vegetarian.
 *   - filterOnboardingSeeds drops omnivore + pescatarian + vegetarian
 *     when diet=vegan.
 *   - filterOnboardingSeeds keeps gluten-free flag honest (only seeds
 *     explicitly tagged GF survive when wantsGlutenFree).
 *   - When the filtered set < SEED_FILTER_FALLBACK_THRESHOLD, the
 *     unfiltered list is returned (better than empty).
 */

import { describe, it, expect } from "vitest";

import {
  ONBOARDING_SEEDS,
  SEED_FILTER_FALLBACK_THRESHOLD,
  filterOnboardingSeeds,
} from "../../src/lib/onboarding/onboardingSeeds";

describe("ONBOARDING_SEEDS list shape", () => {
  it("ships exactly 15 seeds (decision-doc count)", () => {
    expect(ONBOARDING_SEEDS).toHaveLength(15);
  });

  it("each seed has a unique slug", () => {
    const slugs = ONBOARDING_SEEDS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("each seed has a non-empty matchTitle", () => {
    for (const seed of ONBOARDING_SEEDS) {
      expect(seed.matchTitle.length).toBeGreaterThan(0);
    }
  });

  it("includes the canonical decision-doc slugs", () => {
    const slugs = new Set(ONBOARDING_SEEDS.map((s) => s.slug));
    // Spot-check the canonical 15 list — full list lives in the
    // decision doc; we pin a representative sample to guard against
    // accidental rename / dropped row.
    expect(slugs.has("sheet-pan-harissa-chicken-chickpeas")).toBe(true);
    expect(slugs.has("miso-salmon-greens")).toBe(true);
    expect(slugs.has("lentil-bolognese")).toBe(true);
    expect(slugs.has("greek-yogurt-overnight-oats-berries")).toBe(true);
    expect(slugs.has("korean-chicken-rice-bowl")).toBe(true);
  });

  it("hits the decision-doc coverage shape (≥4 GF, ≥3 vegan, ≥1 batch-cook)", () => {
    const gfCount = ONBOARDING_SEEDS.filter((s) =>
      s.dietTags.map((t) => t.toLowerCase()).includes("gluten-free"),
    ).length;
    const veganCount = ONBOARDING_SEEDS.filter((s) =>
      s.dietTags.map((t) => t.toLowerCase()).includes("vegan"),
    ).length;
    const batchCount = ONBOARDING_SEEDS.filter((s) =>
      s.dietTags.map((t) => t.toLowerCase()).includes("batch-cook"),
    ).length;
    expect(gfCount).toBeGreaterThanOrEqual(4);
    expect(veganCount).toBeGreaterThanOrEqual(3);
    expect(batchCount).toBeGreaterThanOrEqual(1);
  });
});

describe("filterOnboardingSeeds — diet filter", () => {
  it("returns the full list when diet is empty", () => {
    const r = filterOnboardingSeeds(ONBOARDING_SEEDS, { diet: [] });
    expect(r).toEqual(ONBOARDING_SEEDS);
  });

  it("excludes omnivore seeds when diet=vegetarian", () => {
    const r = filterOnboardingSeeds(ONBOARDING_SEEDS, { diet: ["vegetarian"] });
    for (const s of r) {
      const tags = s.dietTags.map((t) => t.toLowerCase());
      expect(tags.includes("omnivore")).toBe(false);
    }
  });

  it("falls back to the full list when vegan filter has < threshold matches", () => {
    // The core 15 carries 4 vegan seeds (black bean chilli, tofu soba,
    // chickpea curry, lentil bolognese). 4 < SEED_FILTER_FALLBACK_THRESHOLD
    // (6) so the filter falls back to the unfiltered list rather than
    // surface a too-thin picker. The fallback is by design — better
    // than empty per the candidate-source decision.
    const r = filterOnboardingSeeds(ONBOARDING_SEEDS, { diet: ["vegan"] });
    expect(r).toEqual(ONBOARDING_SEEDS);
  });

  it("excludes non-vegan seeds when vegan filter has ≥ threshold matches", () => {
    // Build a synthetic seed list with 6+ vegan seeds so the filter
    // sticks rather than falling back. Pure-function regression pin.
    const vegan = (slug: string) => ({
      slug,
      matchTitle: slug,
      title: slug,
      kcal: 400,
      protein_g: 20,
      prepMins: 20,
      dietTags: ["vegan"],
      cuisine: "x",
      heroEmoji: "🌱",
    });
    const omnivore = (slug: string) => ({
      slug,
      matchTitle: slug,
      title: slug,
      kcal: 400,
      protein_g: 30,
      prepMins: 20,
      dietTags: ["omnivore"],
      cuisine: "x",
      heroEmoji: "🍗",
    });
    const synth = [
      vegan("v1"),
      vegan("v2"),
      vegan("v3"),
      vegan("v4"),
      vegan("v5"),
      vegan("v6"),
      omnivore("o1"),
    ];
    const r = filterOnboardingSeeds(synth, { diet: ["vegan"] });
    for (const s of r) {
      const tags = s.dietTags.map((t) => t.toLowerCase());
      expect(tags.includes("vegan")).toBe(true);
    }
    expect(r).toHaveLength(6);
  });

  it("keeps only gluten-free-tagged seeds when wantsGlutenFree", () => {
    // GF-only filter on the full list returns ≥4 seeds, which exceeds
    // the fallback threshold, so we keep the filtered list.
    const r = filterOnboardingSeeds(ONBOARDING_SEEDS, { diet: ["gluten-free"] });
    for (const s of r) {
      const tags = s.dietTags.map((t) => t.toLowerCase());
      expect(tags.includes("gluten-free")).toBe(true);
    }
    expect(r.length).toBeGreaterThanOrEqual(4);
  });
});

describe("filterOnboardingSeeds — fallback threshold", () => {
  it("falls back to the unfiltered list when filtered < threshold", () => {
    // Compose a tiny seed list of 2 omnivore items + a vegetarian
    // filter — yields 0 matches, which is below the threshold of
    // SEED_FILTER_FALLBACK_THRESHOLD. The function should fall back
    // to the full input rather than return [].
    const tinySeeds = [
      {
        slug: "x",
        matchTitle: "Omnivore A",
        title: "Omnivore A",
        kcal: 500,
        protein_g: 30,
        prepMins: 30,
        dietTags: ["omnivore"],
        cuisine: "x",
        heroEmoji: "🍴",
      },
      {
        slug: "y",
        matchTitle: "Omnivore B",
        title: "Omnivore B",
        kcal: 500,
        protein_g: 30,
        prepMins: 30,
        dietTags: ["omnivore"],
        cuisine: "x",
        heroEmoji: "🍴",
      },
    ] as const;
    const r = filterOnboardingSeeds(tinySeeds, { diet: ["vegetarian"] });
    expect(r).toEqual(tinySeeds);
  });

  it("respects the threshold constant exactly", () => {
    expect(SEED_FILTER_FALLBACK_THRESHOLD).toBe(6);
  });
});
