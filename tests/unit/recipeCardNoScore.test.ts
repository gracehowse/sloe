/**
 * Recipe cards must not reference any macro-fit score — F-11
 * (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19). Tester reported
 * "Score seems irrelevant. Make it a relevant score or remove it."
 *
 * Removal path (not redesign):
 *   - `FitBadge` + `FitLevel` stripped from the recipe card surfaces
 *     on both platforms (web `DiscoverFeed.tsx`, mobile
 *     `app/(tabs)/discover.tsx`).
 *   - The `suppr/fit-badge.tsx` component file is deleted and no longer
 *     exported from the suppr barrel.
 *   - Mobile's `RecipeCard.fit` union field is dropped from the type
 *     — the value was never populated so the badge always read "Good".
 *   - No ranking consumed the score (confirmed by audit), so no sort
 *     fallback is required.
 *
 * If this test fails because someone added a new score widget, route
 * back to the F-11 ticket rather than bypassing — the decision was
 * explicit and product-signed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const WEB_LIBRARY_PATH = resolve(ROOT, "src/app/components/Library.tsx");
const WEB_RECIPE_DETAIL_PATH = resolve(ROOT, "src/app/components/RecipeDetail.tsx");
const WEB_BARREL_PATH = resolve(ROOT, "src/app/components/suppr/index.ts");
const WEB_FIT_BADGE_PATH = resolve(ROOT, "src/app/components/suppr/fit-badge.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");
const MOBILE_LIBRARY_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/library.tsx");
const MOBILE_RECIPE_DETAIL_PATH = resolve(ROOT, "apps/mobile/app/recipe/[id].tsx");
const MOBILE_TYPES_PATH = resolve(ROOT, "apps/mobile/lib/types.ts");
const WEB_TYPES_PATH = resolve(ROOT, "src/types/recipe.ts");

const WEB_DISCOVER_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const WEB_LIBRARY_SRC = readFileSync(WEB_LIBRARY_PATH, "utf8");
const WEB_RECIPE_DETAIL_SRC = readFileSync(WEB_RECIPE_DETAIL_PATH, "utf8");
const WEB_BARREL_SRC = readFileSync(WEB_BARREL_PATH, "utf8");
const MOBILE_DISCOVER_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");
const MOBILE_LIBRARY_SRC = readFileSync(MOBILE_LIBRARY_PATH, "utf8");
const MOBILE_RECIPE_DETAIL_SRC = readFileSync(MOBILE_RECIPE_DETAIL_PATH, "utf8");
const MOBILE_TYPES_SRC = readFileSync(MOBILE_TYPES_PATH, "utf8");
const WEB_TYPES_SRC = readFileSync(WEB_TYPES_PATH, "utf8");

describe("F-11 recipe card removes the macro-fit score", () => {
  it("web DiscoverFeed no longer imports or uses FitBadge / FitLevel / computeFitLevel", () => {
    // No imports.
    expect(WEB_DISCOVER_SRC).not.toMatch(/from\s+["'][^"']*fit-badge["']/);
    expect(WEB_DISCOVER_SRC).not.toMatch(/\bimport\s+.*\bFitBadge\b/);
    // No JSX usage.
    expect(WEB_DISCOVER_SRC).not.toMatch(/<FitBadge\b/);
    // No score computation.
    expect(WEB_DISCOVER_SRC).not.toMatch(/function computeFitLevel\(/);
    expect(WEB_DISCOVER_SRC).not.toMatch(/computeFitLevel\(/);
  });

  it("mobile Discover no longer defines or renders a FitBadge component", () => {
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/function FitBadge\b/);
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/<FitBadge\b/);
    // `fitColor` helper was tied to the badge — removed with it.
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/const fitColor = /);
    // item.fit lookup is gone.
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/item\.fit\s*\?\?/);
  });

  it("Library / RecipeDetail never referenced a fit score — pin so they stay clean", () => {
    // Web library + detail.
    expect(WEB_LIBRARY_SRC).not.toMatch(/\bFitBadge\b/);
    expect(WEB_LIBRARY_SRC).not.toMatch(/\bFitLevel\b/);
    expect(WEB_RECIPE_DETAIL_SRC).not.toMatch(/\bFitBadge\b/);
    expect(WEB_RECIPE_DETAIL_SRC).not.toMatch(/\bFitLevel\b/);
    // Mobile library + detail.
    expect(MOBILE_LIBRARY_SRC).not.toMatch(/\bFitBadge\b/);
    expect(MOBILE_RECIPE_DETAIL_SRC).not.toMatch(/\bFitBadge\b/);
  });

  it("suppr barrel does not re-export FitBadge / FitLevel", () => {
    expect(WEB_BARREL_SRC).not.toMatch(/export\s*\{\s*FitBadge\b/);
    expect(WEB_BARREL_SRC).not.toMatch(/export\s*\{[^}]*\bFitLevel\b/);
  });

  it("the suppr/fit-badge.tsx component file itself was removed", () => {
    expect(existsSync(WEB_FIT_BADGE_PATH)).toBe(false);
  });

  it("mobile RecipeCard type drops the `fit` field that was only used by the badge", () => {
    // The field previously read `fit?: "great" | "good" | "warn";`.
    expect(MOBILE_TYPES_SRC).not.toMatch(
      /fit\?\s*:\s*["']great["']\s*\|\s*["']good["']\s*\|\s*["']warn["']/,
    );
  });

  it("web RecipeCard type (which never carried a fit field) still does not", () => {
    // Sanity — make sure nobody adds one to the web type to compensate.
    expect(WEB_TYPES_SRC).not.toMatch(/^\s*fit\?:/m);
    expect(WEB_TYPES_SRC).not.toMatch(/recipeScore|qualityScore|nutritionScore/);
  });

  it("neither surface imports a score/grade/rating field called `recipeScore` or similar", () => {
    for (const src of [WEB_DISCOVER_SRC, MOBILE_DISCOVER_SRC, WEB_LIBRARY_SRC, MOBILE_LIBRARY_SRC, WEB_RECIPE_DETAIL_SRC, MOBILE_RECIPE_DETAIL_SRC]) {
      expect(src).not.toMatch(/\brecipeScore\b/);
      expect(src).not.toMatch(/\bqualityScore\b/);
      expect(src).not.toMatch(/\bnutritionScore\b/);
    }
  });
});
