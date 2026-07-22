// @vitest-environment jsdom
/**
 * Today tight hero cluster (ENG-1653, flag `today_hero_cluster_v3`).
 *
 * Grace 2026-07-21 ("we need a proper hero section / today page"): the v3
 * prototype composes wordmark → greeting → strip → dial as ONE tight cluster
 * (8/20/4 rhythm) with the north-star "eat next" module directly under the
 * hero — vs the legacy flat 24 scroll gap and the dead Figma's below-macros
 * north-star slot. This guards the structural contract source-side (the
 * decard-test pattern — source-grep, not flag-mocked renders, so transitive
 * analytics imports stay real):
 *   1. TodayScreen builds hero + north-star ONCE and mounts each in exactly
 *      one of two flag-picked slots, with the OFF cluster wrapper mirroring
 *      the scroll gap (layout-neutral).
 *   2. TodayHeroRing drops the orphaned top Coach-chip row on the de-carded
 *      cluster hero and re-homes the Coach entry at the hero foot
 *      (ENG-1293's every-state guarantee), and drops the decard top padding.
 *   3. The fasting context wrapper only mounts WITH content (the unflagged
 *      phantom-24px-seam fix).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("TodayScreen hero cluster (today_hero_cluster_v3)", () => {
  const src = read("app/(tabs)/_today/TodayScreen.tsx");

  it("reads the cluster flag once", () => {
    expect(src).toMatch(/const heroClusterOn = isFeatureEnabled\("today_hero_cluster_v3"\)/);
  });

  it("mounts the hoisted hero block in exactly one of two slots", () => {
    expect(src).toMatch(/\{heroClusterOn \? heroBlock : null\}/); // in-cluster slot
    expect(src).toMatch(/\{heroClusterOn \? null : heroBlock\}/); // legacy slot
  });

  it("mounts the hoisted north-star block in exactly one of two slots", () => {
    expect(src).toMatch(/\{heroClusterOn \? northStarBlock : null\}/); // under the hero (prototype)
    expect(src).toMatch(/\{heroClusterOn \? null : northStarBlock\}/); // legacy below-macros slot
  });

  it("keeps the OFF cluster wrapper layout-neutral (gap mirrors the scroll gap)", () => {
    expect(src).toMatch(/heroClusterOff: \{ gap: Spacing\.xl \}/);
    expect(src).toMatch(/heroClusterTight: \{ gap: Spacing\.xs \}/);
    expect(src).toMatch(/heroClusterGreeting: \{ marginTop: Spacing\.xs \}/);
    expect(src).toMatch(/heroClusterStrip: \{ marginTop: Spacing\.md \}/);
  });

  it("only mounts the fasting context wrapper WITH content (phantom-gap fix)", () => {
    // The always-mounted `<ReAnimated.View style={contextEntrance.style}>`
    // wrapper around a `{activeFastStart ? … : null}` body is the bug shape —
    // an empty View child the scroll gap pays out around on non-fasting days.
    expect(src).not.toMatch(
      /<ReAnimated\.View style=\{contextEntrance\.style\}>\s*\{activeFastStart \?/,
    );
    expect(src).toMatch(/\{activeFastStart \? \(\s*<ReAnimated\.View style=\{contextEntrance\.style\}>/);
  });
});

describe("TodayHeroRing cluster branch (today_hero_cluster_v3)", () => {
  const src = read("components/today/TodayHeroRing.tsx");

  it("computes coachAtFoot from decard × cluster", () => {
    expect(src).toMatch(/const clusterHero = isFeatureEnabled\("today_hero_cluster_v3"\)/);
    expect(src).toMatch(/const coachAtFoot = decard && clusterHero/);
  });

  it("suppresses the orphaned top chip row on the cluster hero", () => {
    expect(src).toMatch(/\(!decard \|\| onPressCoach\) && !coachAtFoot \?/);
  });

  it("re-homes the Coach entry at the hero foot (ENG-1293 every-state guarantee)", () => {
    expect(src).toMatch(/\{coachAtFoot && onPressCoach \? <TodayCoachChip onPress=\{onPressCoach\} \/> : null\}/);
  });

  it("drops the decard top padding so the dial hangs at the bare cluster gap", () => {
    expect(src).toMatch(/paddingTop: clusterHero \? 0 : Spacing\.sm/);
    expect(src).toMatch(/paddingBottom: Spacing\.sm/);
  });
});
