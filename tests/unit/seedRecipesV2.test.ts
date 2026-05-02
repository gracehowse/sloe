/**
 * seedRecipesV2 — pin the curated Discover seed contract.
 *
 * The seed populates Discover at the solo-tester stage so users
 * landing on the tab don't see a thin / empty grid. These tests pin
 * the structural contract every entry must satisfy. They do NOT
 * judge content quality — that's curation work.
 *
 * NB: this is the smaller-scoped initial seed (15 recipes / 3 clusters).
 * The expansion to 50 / 5 is documented as a follow-up at the top of
 * the source file. When that lands, bump the size assertions here.
 */
import { describe, expect, it } from "vitest";
import {
  SEED_CLUSTERS,
  SEED_RECIPES_V2,
  getSeedRecipesByCluster,
  type SeedCuisineCluster,
} from "../../src/lib/recipes/seedRecipesV2";

const ACTIVE_CLUSTERS: ReadonlyArray<SeedCuisineCluster> = [
  "mediterranean",
  "asian",
  "healthy-bowls",
];

describe("seedRecipesV2", () => {
  it("ships at least 15 recipes (initial seed minimum)", () => {
    expect(SEED_RECIPES_V2.length).toBeGreaterThanOrEqual(15);
  });

  it("declares each active cluster in SEED_CLUSTERS", () => {
    const ids = SEED_CLUSTERS.map((c) => c.id);
    for (const cluster of ACTIVE_CLUSTERS) {
      expect(ids).toContain(cluster);
    }
  });

  it("has at least 5 entries in every active cluster", () => {
    for (const cluster of ACTIVE_CLUSTERS) {
      const items = getSeedRecipesByCluster(cluster);
      expect(items.length, `${cluster} should have ≥ 5`).toBeGreaterThanOrEqual(5);
    }
  });

  it("every recipe carries the required fields", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.id, "id").toMatch(/^seed-v2-[a-z-]+-[a-z0-9-]+$/);
      expect(r.title.length, `title for ${r.id}`).toBeGreaterThan(0);
      expect(r.heroImageUrl, `heroImageUrl for ${r.id}`).toMatch(/^https:\/\//);
      expect(r.servings, `servings for ${r.id}`).toBeGreaterThanOrEqual(1);
      expect(r.kcalPerPortion, `kcal for ${r.id}`).toBeGreaterThan(0);
      expect(r.totalTimeMin, `totalTime for ${r.id}`).toBeGreaterThan(0);
      expect(ACTIVE_CLUSTERS).toContain(r.cluster);
    }
  });

  it("every recipe has 6-12 ingredients with positive grams", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.ingredients.length, `ingredient count for ${r.id}`).toBeGreaterThanOrEqual(6);
      expect(r.ingredients.length, `ingredient count for ${r.id}`).toBeLessThanOrEqual(12);
      for (const ing of r.ingredients) {
        expect(ing.name.length, `ingredient name in ${r.id}`).toBeGreaterThan(0);
        expect(ing.grams, `ingredient grams for ${ing.name} in ${r.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("every recipe has 4-8 instruction steps", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.steps.length, `steps for ${r.id}`).toBeGreaterThanOrEqual(4);
      expect(r.steps.length, `steps for ${r.id}`).toBeLessThanOrEqual(8);
      for (const s of r.steps) {
        expect(s.length, `step in ${r.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("recipe ids are unique", () => {
    const ids = SEED_RECIPES_V2.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("totalTimeMin equals prepTimeMin + cookTimeMin (or close — UI-honest)", () => {
    // This catches typos where prep+cook wouldn't add up to total — a
    // common hand-edit mistake. Allow zero cook time (raw recipes).
    for (const r of SEED_RECIPES_V2) {
      expect(
        r.prepTimeMin + r.cookTimeMin,
        `total != prep+cook for ${r.id}`,
      ).toBe(r.totalTimeMin);
    }
  });

  it("getSeedRecipesByCluster returns only entries in that cluster", () => {
    for (const cluster of ACTIVE_CLUSTERS) {
      const items = getSeedRecipesByCluster(cluster);
      for (const r of items) {
        expect(r.cluster).toBe(cluster);
      }
    }
  });

  it("hero image URLs are unsplash.com (or other CDN — never blob:/data:)", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.heroImageUrl, r.id).not.toMatch(/^(blob:|data:)/);
      expect(r.heroImageUrl, r.id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
    }
  });

  it("macro estimates are non-negative", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.proteinG, `protein for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.carbsG, `carbs for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.fatG, `fat for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.fiberG, `fiber for ${r.id}`).toBeGreaterThanOrEqual(0);
    }
  });
});
