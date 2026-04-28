/**
 * trustPostureSweepPhase4 — pins the Phase 4 (B3.X, 2026-04-27)
 * trust-posture sweep across the macro-bearing rendering sites.
 *
 * Authority: D-2026-04-27-16 (consistent trust posture on every
 * macro-bearing row, app-wide).
 *
 * Phase 4 ships the per-surface widening that Phase 3 prepared the
 * primitives for. Targets:
 *   - RecipeDetail hero → TrustChip immediately under title.
 *   - RecipeDetail ingredient row → SourceDot 6pt + Verify button
 *     when the row is unverified.
 *   - Library card → TrustChip on every recipe.
 *   - Discover card → TrustChip on every recipe.
 *
 * Tests are file-source pins: they read each touched component and
 * assert the canonical primitives + helpers were threaded through.
 * The actual visual / a11y rendering is covered by the per-primitive
 * unit tests (see `trustPostureSweepPhase3.test.tsx` for primitive
 * coverage).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  mapToTrustVariant,
  aggregateRecipeTrust,
  recipeLevelTrust,
} from "../../src/lib/nutrition/recipeTrust";

const REPO_ROOT = path.resolve(__dirname, "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, relPath), "utf8");
}

describe("recipeTrust mapper — table-driven", () => {
  describe("mapToTrustVariant — single-source", () => {
    it("verified USDA → usda", () => {
      expect(mapToTrustVariant({ source: "USDA", isVerified: true })).toBe("usda");
    });
    it("verified OFF → off-adjusted", () => {
      expect(
        mapToTrustVariant({ source: "Open Food Facts", isVerified: true }),
      ).toBe("off-adjusted");
    });
    it("verified FatSecret → off-adjusted (treated as adjusted)", () => {
      expect(
        mapToTrustVariant({ source: "FatSecret Premier", isVerified: true }),
      ).toBe("off-adjusted");
    });
    it("unverified USDA → estimated (don't claim verified)", () => {
      expect(mapToTrustVariant({ source: "USDA", isVerified: false })).toBe(
        "estimated",
      );
    });
    it("AI source always → estimated regardless of verified flag", () => {
      expect(
        mapToTrustVariant({ source: "AI photo", isVerified: true }),
      ).toBe("estimated");
      expect(
        mapToTrustVariant({ source: "AI voice", isVerified: false }),
      ).toBe("estimated");
    });
    it("Manual + verified → manual", () => {
      expect(mapToTrustVariant({ source: "Manual entry", isVerified: true })).toBe(
        "manual",
      );
    });
    it("null source → manual when verified, estimated when not", () => {
      expect(mapToTrustVariant({ source: null, isVerified: true })).toBe(
        "manual",
      );
      expect(mapToTrustVariant({ source: null, isVerified: false })).toBe(
        "estimated",
      );
    });
  });

  describe("aggregateRecipeTrust — worst-case wins", () => {
    it("any AI row → estimated", () => {
      expect(
        aggregateRecipeTrust([
          { source: "USDA", isVerified: true },
          { source: "AI photo", isVerified: true },
        ]),
      ).toBe("estimated");
    });
    it("all USDA verified → usda", () => {
      expect(
        aggregateRecipeTrust([
          { source: "USDA", isVerified: true },
          { source: "USDA", isVerified: true },
        ]),
      ).toBe("usda");
    });
    it("USDA + OFF (verified) → off-adjusted (the lower bar)", () => {
      expect(
        aggregateRecipeTrust([
          { source: "USDA", isVerified: true },
          { source: "OFF", isVerified: true },
        ]),
      ).toBe("off-adjusted");
    });
    it("any unverified row → estimated", () => {
      expect(
        aggregateRecipeTrust([
          { source: "USDA", isVerified: true },
          { source: "USDA", isVerified: false },
        ]),
      ).toBe("estimated");
    });
    it("empty list → estimated (be honest)", () => {
      expect(aggregateRecipeTrust([])).toBe("estimated");
    });
    it("all manual verified → manual", () => {
      expect(
        aggregateRecipeTrust([
          { source: "Manual", isVerified: true },
          { source: "Manual", isVerified: true },
        ]),
      ).toBe("manual");
    });
  });

  describe("recipeLevelTrust — passthrough sanity", () => {
    it("recipe-level shorthand returns the same shape as mapToTrustVariant", () => {
      expect(recipeLevelTrust({ source: "USDA", isVerified: true })).toBe("usda");
      expect(recipeLevelTrust({ source: null, isVerified: false })).toBe(
        "estimated",
      );
    });
  });
});

describe("Phase 4 trust posture sweep — source pins", () => {
  it("RecipeDetail (web) imports TrustChip + SourceDot + recipe-trust helpers", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}/);
    expect(src).toMatch(/aggregateRecipeTrust/);
    expect(src).toMatch(/mapMealSourceToDot/);
  });

  it("RecipeDetail renders the hero TrustChip with data-testid", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/data-testid="recipe-detail-trust-chip"/);
    // Aggregated variant — uses the helper, not a hardcoded string
    expect(src).toMatch(/aggregateRecipeTrust\(/);
  });

  it("RecipeDetail renders SourceDot per ingredient row at size=6", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
    // Unverified rows expose an inline Verify button
    expect(src).toMatch(/Verify →/);
  });

  it("Library (web) imports TrustChip + recipeLevelTrust", () => {
    const src = read("src/app/components/Library.tsx");
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    expect(src).toMatch(/recipeLevelTrust/);
    // Both desktop grid + mobile list paths render the chip
    const matches = src.match(/<TrustChip\b/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("DiscoverFeed (web) imports TrustChip + recipeLevelTrust", () => {
    const src = read("src/app/components/DiscoverFeed.tsx");
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    expect(src).toMatch(/recipeLevelTrust/);
  });

  it("LogSheet (web) keeps the Phase 3 SourceDot + TrustChip imports", () => {
    // Regression guard — Phase 3 wired these; Phase 4 must not have
    // dropped them while wiring desktop modal mode.
    const src = read("src/app/components/suppr/log-sheet.tsx");
    expect(src).toMatch(/import\s*\{\s*SourceDot/);
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
  });

  it("NutritionTracker passes desktop=isDesktop to LogSheet — B3.Y cleanup", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    expect(src).toMatch(/import\s*\{\s*useIsDesktop\s*\}/);
    expect(src).toMatch(/<LogSheet[\s\S]+?desktop=\{isDesktop\}/);
  });
});
