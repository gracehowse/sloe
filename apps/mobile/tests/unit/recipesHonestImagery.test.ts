/**
 * ENG-1287 (launch-blocker) — honest recipe imagery, mobile data layer.
 *
 * The old `pickDefaultImage` rotated a 6-photo Unsplash pool keyed by
 * recipe id, so an imageless recipe rendered someone else's dish as if it
 * were its real photo ("Protein banana bread" → stir-fry). These pins
 * guarantee the fabrication can't quietly come back:
 *
 *   - no stock-photo pool / unsplash literals in the recipe mappers;
 *   - a recipe with no image keeps `image: null` (`pickHeroImageUrl(...)
 *     ?? null`) on BOTH the Discover and the saved-Library mappers;
 *   - offline-cache reads strip the retired pool URLs written by pre-fix
 *     builds (`sanitizeCachedCardImages` on both cache paths);
 *   - the `RecipeCard.image` type is honest (`string | null`).
 *
 * Behavioural coverage of the retired-URL ladder lives in the shared
 * `tests/unit/heroImageFallback.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RECIPES_SRC = readFileSync(
  resolve(__dirname, "../../lib/recipes.ts"),
  "utf8",
);
const TYPES_SRC = readFileSync(resolve(__dirname, "../../lib/types.ts"), "utf8");

describe("mobile recipes lib — no fabricated imagery (ENG-1287)", () => {
  it("carries no stock-photo pool or unsplash literals", () => {
    expect(RECIPES_SRC).not.toMatch(/images\.unsplash\.com/);
    expect(RECIPES_SRC).not.toMatch(/pickDefaultImage/);
    expect(RECIPES_SRC).not.toMatch(/DEFAULT_IMAGE_POOL/);
  });

  it("maps a missing image to null on both the Discover and Library mappers", () => {
    const nullFallbacks = RECIPES_SRC.match(/\}\) \?\? null,/g) ?? [];
    expect(nullFallbacks.length).toBeGreaterThanOrEqual(2);
    expect(RECIPES_SRC).toMatch(/pickHeroImageUrl/);
  });

  it("sanitises retired stock URLs out of offline-cache reads (both hooks)", () => {
    expect(RECIPES_SRC).toMatch(/isRetiredStockImageUrl/);
    const sanitiseCalls =
      RECIPES_SRC.match(/sanitizeCachedCardImages\(/g) ?? [];
    // 1 definition + 2 call sites (discover cache path, saved warm cache).
    expect(sanitiseCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("RecipeCard.image is typed string | null", () => {
    expect(TYPES_SRC).toMatch(/image: string \| null;/);
  });
});
