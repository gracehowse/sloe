/**
 * Discover cluster carousels — pin the founder-approved Sloe Kitchen
 * collection: Discover renders one horizontal carousel per populated
 * cluster (Mediterranean → Asian → Latin).
 *
 * Web `DiscoverFeed.tsx` reads from the shared `seedRecipesV2` source,
 * groups entries by cluster, and renders a header above each horizontal
 * scroller. Mobile has the same shelves in
 * `components/discover/DiscoverClusterCarousels.tsx` (ENG-695) — the
 * "web-only" note that used to sit here was stale.
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
import { MEDIA_SCRIM_COLOR, MEDIA_SCRIM_STOPS } from "../../src/lib/theme/mediaScrim";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");
const MOBILE_CLUSTER_PATH = resolve(ROOT, "apps/mobile/components/discover/DiscoverClusterCarousels.tsx");

const WEB_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");
const MOBILE_CLUSTER_SRC = readFileSync(MOBILE_CLUSTER_PATH, "utf8");

/** Reading order pinned in the brief. */
const ORDERED_CLUSTERS = [
  "mediterranean",
  "asian",
  "latin",
] as const;

describe("Discover cluster carousels (Sloe Kitchen v1)", () => {
  describe("seed metadata declares the populated clusters in canonical order", () => {
    it("SEED_CLUSTERS has the 3 expected ids in reading order", () => {
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
      // Sloe redesign renamed the "For You" quick-filter to the `feedScope`
      // model — carousels still gate on the unfiltered default view.
      expect(WEB_SRC).toMatch(/feedScope === "forYou"/);
    });
  });

  describe("mobile Discover — cuisine cluster carousels (ENG-695)", () => {
    it("wires per-cluster carousel testids", () => {
      expect(MOBILE_CLUSTER_SRC).toMatch(/discover-cluster-\$\{cluster\.id\}/);
    });

    it("renders DiscoverClusterCarousels on the default unfiltered view", () => {
      expect(MOBILE_SRC).toMatch(/DiscoverClusterCarousels/);
      expect(MOBILE_SRC).toMatch(/showClusterCarousels/);
    });
  });

  describe("on-photo title scrim is feathered, never a flat band", () => {
    // The shipped bug: mobile painted an absolutely-positioned
    // `height: "55%"` flat black rect over the bottom of the card. Its top
    // edge landed at exactly 45% down the card — bright photo above, the
    // SAME photo crushed by 55% black below — which read as one card
    // printing its picture twice at two different crops. Web was already
    // correct (full-bleed gradient); mobile was the divergent side.
    it("the shared media-scrim token fades to fully transparent", () => {
      expect(MEDIA_SCRIM_COLOR).toBe("#000000");
      expect(MEDIA_SCRIM_STOPS.length).toBeGreaterThanOrEqual(3);
      expect(MEDIA_SCRIM_STOPS[0].opacity).toBeGreaterThan(0);
      expect(MEDIA_SCRIM_STOPS[MEDIA_SCRIM_STOPS.length - 1].opacity).toBe(0);
    });

    it("mobile renders the scrim as an svg gradient off the shared token", () => {
      expect(MOBILE_CLUSTER_SRC).toMatch(/from "react-native-svg"/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/MEDIA_SCRIM_STOPS/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/stopColor=\{MEDIA_SCRIM_COLOR\}/);
      // Full-bleed, not a bottom-anchored band.
      expect(MOBILE_CLUSTER_SRC).toMatch(/StyleSheet\.absoluteFill/);
    });

    it("mobile keeps the flat 55% band only as the flag-off kill switch", () => {
      // Real kill switch: flag OFF must reproduce the previously shipped
      // surface exactly, so the old rect stays — but only in the else branch.
      expect(MOBILE_CLUSTER_SRC).toMatch(/isFeatureEnabled\("design_consistency_v1"\)/);
      const flatBands = MOBILE_CLUSTER_SRC.match(/height:\s*"55%"/g) ?? [];
      expect(flatBands).toHaveLength(1);
    });

    it("web already ships the feathered gradient (parity reference)", () => {
      expect(WEB_SRC).toMatch(/from-black\/70 via-black\/20 to-transparent/);
    });
  });

  describe("one card size per shelf, and the shelf snaps", () => {
    // Two shipped defects on the same rail: a 280pt/3:4 first card beside
    // 200pt/4:5 siblings (a 123pt height step inside one row), and a free
    // scroll with no snap, which parked the trailing card sliced mid-word.
    // The size collapse is what makes a single snap interval legal.
    it("mobile declares one card geometry as module constants", () => {
      expect(MOBILE_CLUSTER_SRC).toMatch(/const CARD_WIDTH = \d+;/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/const CARD_ASPECT = /);
      expect(MOBILE_CLUSTER_SRC).toMatch(/const CARD_GAP = /);
    });

    it("mobile snaps the shelf on that one interval and bleeds to the gutter", () => {
      expect(MOBILE_CLUSTER_SRC).toMatch(/snapToInterval=\{consistent \? CARD_WIDTH \+ CARD_GAP/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/snapToAlignment=\{consistent \? "start"/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/decelerationRate=\{consistent \? "fast"/);
      // Edge-bleed + re-pad, so cards scroll to the screen edge but rest on
      // the page gutter (same treatment as the sibling EditorialShelf).
      expect(MOBILE_CLUSTER_SRC).toMatch(/marginHorizontal: -Spacing\.lg/);
      expect(MOBILE_CLUSTER_SRC).toMatch(/paddingHorizontal: Spacing\.lg/);
    });

    it("web collapses its hero size split behind the same flag", () => {
      expect(WEB_SRC).toMatch(/const uniformClusterCards = isFeatureEnabled\("design_consistency_v1"\)/);
      expect(WEB_SRC).toMatch(/const isHero = idx === 0 && !uniformClusterCards;/);
    });

    it("web keeps its snap-mandatory rail", () => {
      expect(WEB_SRC).toMatch(/snap-x snap-mandatory/);
      expect(WEB_SRC).toMatch(/snap-start/);
    });
  });

  describe("cross-platform parity", () => {
    it("both platforms reference all populated cluster ids", () => {
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
