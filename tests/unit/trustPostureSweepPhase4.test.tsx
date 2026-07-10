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

describe("Trust posture sweep — source pins (post-GW-08, 2026-04-28)", () => {
  // GW-08 (2026-04-28) reworked Phase 4's posture: the source-claim
  // chips on Discover hero, Library cards, and Recipe Detail were
  // removed because the underlying signal (`recipe_ingredients.is_verified`,
  // populated by the importer as `(m?.calories ?? 0) > 0`) is fabricated.
  // The chips claim "USDA verified" on LLM-extracted recipes — a
  // canonical violation of the "do not guess" rule. They stay gone
  // until per-recipe match-source data is plumbed end-to-end. The
  // gluten classifier chip remains because it's an honest ingredient-
  // keyword scan.

  it("RecipeDetail (web) keeps SourceDot + mapMealSourceToDot for ingredient rows", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}/);
    expect(src).toMatch(/mapMealSourceToDot/);
  });

  it("RecipeDetail (web) does NOT render the source TrustChip (GW-08 removal)", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).not.toMatch(/data-testid="recipe-detail-trust-chip"/);
    // The aggregator is no longer called or imported from this surface.
    // Match `aggregateRecipeTrust(` *not* in a comment (`//` immediately
    // preceded), or any `import { ... aggregateRecipeTrust` line.
    expect(src).not.toMatch(/^\s*import[^\n]*\baggregateRecipeTrust\b[^\n]*from/m);
  });

  it("RecipeDetail (web) keeps the gluten classifier chip — honest signal", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/classifyRecipeGluten/);
    expect(src).toMatch(/data-testid="recipe-detail-gluten-chip"/);
  });

  // ENG-748 (legal-reviewer P0): a persistent disclaimer caption must
  // sit directly beneath the gluten chip on the web hero whenever it
  // renders — not a tooltip / tap / global ToS.
  it("RecipeDetail (web) renders the persistent gluten disclaimer caption (ENG-748)", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/data-testid="recipe-detail-gluten-disclaimer"/);
    expect(src).toMatch(/Estimated from ingredient names — not a guarantee\./);
    expect(src).toMatch(/Always[\s\S]{0,40}check labels and packaging if you avoid gluten for medical/);
    // It must live in the SAME conditional as the chip (rendered only
    // when a gluten variant resolves), so chip + caption appear together.
    expect(src).toMatch(
      /if \(!glutenResult\.variant\) return null;[\s\S]*recipe-detail-gluten-disclaimer/,
    );
  });

  it("RecipeDetail renders SourceDot per ingredient row at size=6", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
    // Unverified rows expose an inline Verify button
    expect(src).toMatch(/Verify →/);
  });

  it("Library (web) does NOT render any TrustChip on recipe cards (GW-08 removal)", () => {
    const src = read("src/app/components/Library.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    // Match any non-comment `import { ... recipeLevelTrust ... }` statement.
    // (Comment-only mentions in the file's GW-08 explanation comments
    // are tolerated — what matters is the function isn't imported.)
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });

  it("DiscoverFeed (web) does NOT render TrustChip on the hero card (GW-08 removal)", () => {
    const src = read("src/app/components/DiscoverFeed.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    // Match any non-comment `import { ... recipeLevelTrust ... }` statement.
    // (Comment-only mentions in the file's GW-08 explanation comments
    // are tolerated — what matters is the function isn't imported.)
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });

  it("LogSheet (web) keeps the Phase 3 SourceDot + TrustChip trust surfaces", () => {
    // Regression guard — LogSheet's TrustChip use is on individual
    // food-search rows where the row carries a real source label
    // ("USDA Foundation" / "Open Food Facts" / etc.), so it remains
    // honest. Only the recipe-level surfaces were stripped. ENG-1484 — the
    // S13 LoggedConfirmation (the SourceDot consumer) was extracted to its
    // own file per the screen-budget ratchet; the SourceDot pin follows it.
    const src = read("src/app/components/suppr/log-sheet.tsx");
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    const confirmation = read("src/app/components/suppr/log-sheet-confirmation.tsx");
    expect(confirmation).toMatch(/import\s*\{\s*SourceDot\s*\}/);
  });

  it("NutritionTracker passes desktop=isDesktop to LogSheet — B3.Y cleanup", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    expect(src).toMatch(/import\s*\{\s*useIsDesktop\s*\}/);
    expect(src).toMatch(/<LogSheet[\s\S]+?desktop=\{isDesktop\}/);
  });

  it("Mobile recipe detail screen does NOT render the source TrustChip (GW-08 removal)", () => {
    const src = read("apps/mobile/app/recipe/[id].tsx");
    expect(src).not.toMatch(/testID="recipe-detail-trust-chip"/);
    expect(src).not.toMatch(/^\s*import[^\n]*\baggregateRecipeTrust\b[^\n]*from/m);
  });

  it("Mobile recipe detail screen keeps the gluten classifier chip", () => {
    const src = read("apps/mobile/app/recipe/[id].tsx");
    expect(src).toMatch(/classifyRecipeGluten/);
    expect(src).toMatch(/testID="recipe-detail-gluten-chip"/);
  });

  // ENG-748 (legal-reviewer P0): the mobile hero mirrors the web
  // persistent disclaimer caption beneath the gluten chip.
  it("Mobile recipe detail renders the persistent gluten disclaimer caption (ENG-748)", () => {
    const src = read("apps/mobile/app/recipe/[id].tsx");
    expect(src).toMatch(/testID="recipe-detail-gluten-disclaimer"/);
    expect(src).toMatch(/Estimated from ingredient names — not a guarantee\./);
    // The JSX source wraps the line between "packaging" and "if" with
    // indentation whitespace — allow [\s\S]{0,30} to bridge the newline.
    expect(src).toMatch(/Always[\s\S]{0,40}check labels and packaging[\s\S]{0,30}if you avoid gluten for medical/);
    // Same conditional as the chip (rendered only when a variant resolves).
    expect(src).toMatch(
      /if \(!gluten\.variant\) return null;[\s\S]*recipe-detail-gluten-disclaimer/,
    );
  });

  // ENG-748: the gluten-high-conf TrustChip variant must use the
  // Sparkles ("estimated") glyph, not Check ("verified"), on a coeliac
  // surface — pinned at the primitive on BOTH platforms so the swap
  // can't silently revert.
  it("TrustChip gluten-high-conf maps to the Sparkles glyph (web + mobile) — ENG-748", () => {
    for (const rel of [
      "src/app/components/ui/trust-chip.tsx",
      "apps/mobile/components/ui/TrustChip.tsx",
    ]) {
      const src = read(rel);
      // Isolate the gluten-high-conf config block and assert its glyph.
      const block = src.match(
        /"gluten-high-conf":\s*\{[\s\S]*?\bglyph:\s*"([a-z]+)"/,
      );
      expect(block, `${rel} must define a gluten-high-conf glyph`).toBeTruthy();
      expect(block?.[1]).toBe("sparkles");
    }
  });

  it("Mobile Discover hero does NOT render TrustChip (GW-08 removal)", () => {
    const src = read("apps/mobile/app/(tabs)/discover.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    // Match any non-comment `import { ... recipeLevelTrust ... }` statement.
    // (Comment-only mentions in the file's GW-08 explanation comments
    // are tolerated — what matters is the function isn't imported.)
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });

  it("Mobile Library card does NOT render TrustChip (GW-08 removal)", () => {
    const src = read("apps/mobile/app/(tabs)/library.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    // Match any non-comment `import { ... recipeLevelTrust ... }` statement.
    // (Comment-only mentions in the file's GW-08 explanation comments
    // are tolerated — what matters is the function isn't imported.)
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });
});
