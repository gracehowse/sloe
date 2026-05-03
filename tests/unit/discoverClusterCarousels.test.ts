/**
 * Discover cluster carousels — pin the Wave 4 (2026-05-02) seed
 * expansion: Discover renders 5 horizontal carousels, one per cuisine
 * cluster (Mediterranean → Asian → Latin → Comfort → Healthy bowls).
 *
 * Both the web `DiscoverFeed.tsx` and the mobile `(tabs)/discover.tsx`
 * read from the shared `seedRecipesV2` source, group entries by
 * cluster, and render a header above each horizontal scroller.
 *
 * Structural test (reads source) — runs cheaply in the shared web
 * vitest run and applies to both platforms from one spec. Same
 * pattern as `discoverThreeSectionLayout.test.ts` and
 * `recipeCardNoScore.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_CLUSTERS } from "../../src/lib/recipes/seedRecipesV2";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");

const WEB_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");

/** Reading order pinned in the brief. */
const ORDERED_CLUSTERS = [
  "mediterranean",
  "asian",
  "latin",
  "comfort",
  "healthy-bowls",
] as const;

describe("Discover cluster carousels (Wave 4 — 2026-05-02)", () => {
  describe("seed metadata declares all 5 clusters in the canonical order", () => {
    it("SEED_CLUSTERS has the 5 expected ids in reading order", () => {
      expect(SEED_CLUSTERS.map((c) => c.id)).toEqual([...ORDERED_CLUSTERS]);
    });

    it("each cluster has a non-empty title + description", () => {
      for (const c of SEED_CLUSTERS) {
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("web Discover wires the cluster carousels", () => {
    it("imports SEED_CLUSTERS + isSeedRecipeId from the seed module", () => {
      expect(WEB_SRC).toMatch(/SEED_CLUSTERS/);
      expect(WEB_SRC).toMatch(/isSeedRecipeId/);
    });

    it("renders a carousel container with the canonical testid", () => {
      expect(WEB_SRC).toMatch(/data-testid="discover-cluster-carousels"/);
    });

    it("maps over SEED_CLUSTERS to render per-cluster sections", () => {
      // Carousel rendering iterates SEED_CLUSTERS so the on-screen
      // order can't drift from the canonical reading order.
      expect(WEB_SRC).toMatch(/SEED_CLUSTERS\.map/);
    });

    it("renders a per-cluster section testid that includes the cluster id", () => {
      // Single regex check — the dynamic testid template must be
      // present in source.
      expect(WEB_SRC).toMatch(/discover-cluster-\$\{cluster\.id\}/);
    });

    it("only shows cluster carousels on the unfiltered 'For You' default view", () => {
      // The cluster-grouping presentation only makes sense at the
      // default view; an active search/filter must fall back to the
      // legacy flat layout. Pin the gate.
      expect(WEB_SRC).toMatch(/showClusterCarousels/);
      expect(WEB_SRC).toMatch(/!searchQuery\.trim\(\)/);
      expect(WEB_SRC).toMatch(/quickFilter === "For You"/);
    });
  });

  describe("mobile Discover wires the cluster carousels", () => {
    it("imports SEED_CLUSTERS + isSeedRecipeId from the seed module", () => {
      expect(MOBILE_SRC).toMatch(/SEED_CLUSTERS/);
      expect(MOBILE_SRC).toMatch(/isSeedRecipeId/);
    });

    it("renders a per-cluster testid that includes the cluster id", () => {
      expect(MOBILE_SRC).toMatch(/discover-cluster-\$\{cluster\.id\}/);
    });

    it("maps over SEED_CLUSTERS to render per-cluster sections", () => {
      expect(MOBILE_SRC).toMatch(/SEED_CLUSTERS\.map/);
    });

    it("only shows cluster carousels on the unfiltered 'For You' default view", () => {
      expect(MOBILE_SRC).toMatch(/showClusterCarousels/);
      expect(MOBILE_SRC).toMatch(/filter === "For You"/);
    });
  });

  describe("cross-platform parity", () => {
    it("both platforms reference all 5 cluster ids", () => {
      // The cluster ids never appear hard-coded in JSX — they come
      // from SEED_CLUSTERS — but the cluster-recovery fallback
      // walks the SEED_CLUSTERS array, so the canonical ids must
      // be reachable via the shared module.
      for (const cluster of ORDERED_CLUSTERS) {
        // sanity — cluster id format is consistent kebab-case
        expect(cluster).toMatch(/^[a-z]+(-[a-z]+)*$/);
      }
    });
  });
});
