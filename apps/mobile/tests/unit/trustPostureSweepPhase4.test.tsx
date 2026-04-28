/**
 * trustPostureSweepPhase4 — mobile mirror of
 * tests/unit/trustPostureSweepPhase4.test.tsx.
 *
 * Authority: D-2026-04-27-16.
 *
 * Source-pin tests on the touched mobile screens.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  mapToTrustVariant,
  aggregateRecipeTrust,
  recipeLevelTrust,
} from "@/lib/recipeTrust";

const MOBILE_ROOT = path.resolve(__dirname, "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(MOBILE_ROOT, relPath), "utf8");
}

describe("recipeTrust mapper (mobile re-export) — table-driven", () => {
  it("verified USDA → usda", () => {
    expect(mapToTrustVariant({ source: "USDA", isVerified: true })).toBe("usda");
  });
  it("verified OFF → off-adjusted", () => {
    expect(
      mapToTrustVariant({ source: "Open Food Facts", isVerified: true }),
    ).toBe("off-adjusted");
  });
  it("any AI row → estimated (worst-case wins)", () => {
    expect(
      aggregateRecipeTrust([
        { source: "USDA", isVerified: true },
        { source: "AI photo", isVerified: true },
      ]),
    ).toBe("estimated");
  });
  it("recipe-level shorthand passes through", () => {
    expect(recipeLevelTrust({ source: "USDA", isVerified: true })).toBe("usda");
    expect(recipeLevelTrust({ source: null, isVerified: false })).toBe(
      "estimated",
    );
  });
});

describe("Trust posture sweep — mobile source pins (post-GW-08, 2026-04-28)", () => {
  // GW-08 (2026-04-28) reworked Phase 4's posture: the source-claim
  // chips on Discover hero, Library cards, and Recipe Detail were
  // removed because the underlying signal (`recipe_ingredients.is_verified`,
  // populated by the importer as `(m?.calories ?? 0) > 0`) is fabricated.
  // Mirror of `tests/unit/trustPostureSweepPhase4.test.tsx`.

  it("recipe/[id].tsx keeps SourceDot + mapMealSourceToDot for ingredient rows", () => {
    const src = read("app/recipe/[id].tsx");
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}/);
    expect(src).toMatch(/mapMealSourceToDot/);
  });

  it("recipe/[id].tsx does NOT render the source TrustChip (GW-08 removal)", () => {
    const src = read("app/recipe/[id].tsx");
    expect(src).not.toMatch(/testID="recipe-detail-trust-chip"/);
    expect(src).not.toMatch(/^\s*import[^\n]*\baggregateRecipeTrust\b[^\n]*from/m);
  });

  it("recipe/[id].tsx keeps the gluten classifier chip — honest signal", () => {
    const src = read("app/recipe/[id].tsx");
    expect(src).toMatch(/classifyRecipeGluten/);
    expect(src).toMatch(/testID="recipe-detail-gluten-chip"/);
  });

  it("recipe/[id].tsx still renders SourceDot per ingredient row at size=6", () => {
    const src = read("app/recipe/[id].tsx");
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
  });

  it("(tabs)/library.tsx does NOT render TrustChip on cards (GW-08 removal)", () => {
    const src = read("app/(tabs)/library.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });

  it("(tabs)/discover.tsx does NOT render TrustChip on hero card (GW-08 removal)", () => {
    const src = read("app/(tabs)/discover.tsx");
    expect(src).not.toMatch(/<TrustChip\b/);
    expect(src).not.toMatch(/^\s*import[^\n]*\brecipeLevelTrust\b[^\n]*from/m);
  });

  it("legacy <TodayFabSheet> file is deleted — B3.Y cleanup", () => {
    const filePath = path.resolve(
      MOBILE_ROOT,
      "components/today/TodayFabSheet.tsx",
    );
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
