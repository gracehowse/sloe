/**
 * seedRecipesV2 — pin the curated Discover seed contract.
 *
 * The seed populates Discover at the solo-tester stage so users
 * landing on the tab don't see a thin / empty grid. These tests pin
 * the structural contract every entry must satisfy. They do NOT
 * judge content quality — that's curation work.
 *
 * Wave 4 (2026-05-01): the seed expands to 50 recipes across 5
 * clusters (Mediterranean 10, Asian 10, Latin 8, Comfort 10, Healthy
 * bowls 12). Cluster sizes are pinned exactly so a future trim isn't
 * silent.
 */
import { describe, expect, it } from "vitest";
import {
  SEED_CLUSTERS,
  SEED_RECIPES_V2,
  SEED_RECIPE_ID_PREFIX,
  findSeedRecipeById,
  getSeedRecipesByCluster,
  isSeedRecipeId,
  type SeedCuisineCluster,
} from "../../src/lib/recipes/seedRecipesV2";

const ACTIVE_CLUSTERS: ReadonlyArray<SeedCuisineCluster> = [
  "mediterranean",
  "asian",
  "latin",
  "comfort",
  "healthy-bowls",
];

/** Wave-4 cluster size contract. Pinned exactly — adding or removing
 *  entries should be a deliberate edit to this map (which then forces
 *  an update to docs + the matching test). */
const CLUSTER_SIZE_CONTRACT: Record<SeedCuisineCluster, number> = {
  mediterranean: 10,
  asian: 10,
  latin: 8,
  comfort: 10,
  "healthy-bowls": 12,
};

describe("seedRecipesV2", () => {
  it("ships exactly 50 recipes (Wave 4 contract)", () => {
    expect(SEED_RECIPES_V2.length).toBe(50);
  });

  it("declares each active cluster in SEED_CLUSTERS", () => {
    const ids = SEED_CLUSTERS.map((c) => c.id);
    for (const cluster of ACTIVE_CLUSTERS) {
      expect(ids).toContain(cluster);
    }
    expect(ids.length).toBe(ACTIVE_CLUSTERS.length);
  });

  it("SEED_CLUSTERS reading order is fixed (Mediterranean → Asian → Latin → Comfort → Healthy bowls)", () => {
    expect(SEED_CLUSTERS.map((c) => c.id)).toEqual([
      "mediterranean",
      "asian",
      "latin",
      "comfort",
      "healthy-bowls",
    ]);
  });

  it("each cluster carries the contracted number of entries", () => {
    for (const cluster of ACTIVE_CLUSTERS) {
      const items = getSeedRecipesByCluster(cluster);
      expect(items.length, `${cluster} cluster size`).toBe(
        CLUSTER_SIZE_CONTRACT[cluster],
      );
    }
  });

  it("every recipe carries the required fields (no nulls)", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.id, "id").toMatch(/^seed-v2-[a-z-]+-[a-z0-9-]+$/);
      expect(r.title.length, `title for ${r.id}`).toBeGreaterThan(0);
      expect(r.heroImageUrl, `heroImageUrl for ${r.id}`).toMatch(/^https:\/\//);
      expect(r.servings, `servings for ${r.id}`).toBeGreaterThanOrEqual(1);
      expect(r.kcalPerPortion, `kcal for ${r.id}`).toBeGreaterThan(0);
      expect(r.totalTimeMin, `totalTime for ${r.id}`).toBeGreaterThan(0);
      expect(r.shortDescription.length, `shortDescription for ${r.id}`).toBeGreaterThan(0);
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

  it("totalTimeMin equals prepTimeMin + cookTimeMin", () => {
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

  it("hero image URLs are https (never blob:/data:)", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.heroImageUrl, r.id).not.toMatch(/^(blob:|data:)/);
      expect(r.heroImageUrl, r.id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
    }
  });

  it("macro estimates are non-negative and present on every recipe", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.proteinG, `protein for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.carbsG, `carbs for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.fatG, `fat for ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(r.fiberG, `fiber for ${r.id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("isSeedRecipeId / findSeedRecipeById correctly identify seed entries", () => {
    expect(isSeedRecipeId("seed-v2-mediterranean-greek-salad")).toBe(true);
    expect(isSeedRecipeId("not-a-seed")).toBe(false);
    expect(isSeedRecipeId(null)).toBe(false);
    expect(isSeedRecipeId(undefined)).toBe(false);
    expect(findSeedRecipeById("seed-v2-mediterranean-greek-salad")?.cluster).toBe("mediterranean");
    expect(findSeedRecipeById("not-real")).toBeNull();
  });

  it("every seed id starts with the canonical prefix", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.id.startsWith(SEED_RECIPE_ID_PREFIX), `id ${r.id}`).toBe(true);
    }
  });

  it("seed ids embed the cluster slug (regex shape used by the carousel grouper)", () => {
    // Mobile / web Discover both recover the cluster by reading the
    // slug fragment after `seed-v2-`. This test pins the shape so a
    // typo'd id (e.g. `seed-v2-mediteranean-...`) can't ship.
    for (const r of SEED_RECIPES_V2) {
      const after = r.id.slice(SEED_RECIPE_ID_PREFIX.length);
      const matchesCluster = SEED_CLUSTERS.some((c) =>
        after.startsWith(`${c.id}-`),
      );
      expect(matchesCluster, `id ${r.id} should embed its cluster slug`).toBe(true);
    }
  });

  it("optional tags, when present, are non-empty strings", () => {
    for (const r of SEED_RECIPES_V2) {
      if (!r.tags) continue;
      for (const tag of r.tags) {
        expect(tag.length, `tag in ${r.id}`).toBeGreaterThan(0);
      }
    }
  });
});
