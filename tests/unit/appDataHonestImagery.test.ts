/**
 * ENG-1287 (launch-blocker) — honest recipe imagery, web data layer.
 *
 * The old `DEFAULT_UPLOADED_RECIPE_IMAGE` fallback substituted the same
 * stock Unsplash salad for every imageless recipe in the Discover +
 * Library mappers, and `RecipeUpload` PERSISTED it into
 * `recipes.image_url` for photo-less creations. These pins guarantee the
 * fabrication can't quietly come back:
 *
 *   - the AppDataContext mappers keep `image: null` when the hero ladder
 *     resolves nothing;
 *   - the retired constant is gone from the constants module;
 *   - RecipeUpload saves `image_url: null` (never a stock cover) and
 *     treats a legacy persisted retired URL as no-image on draft reload;
 *   - the `RecipeCard.image` type is honest (`string | null`).
 *
 * Behavioural coverage of the retired-URL ladder lives in
 * `tests/unit/heroImageFallback.test.ts`; mobile twin pins live in
 * `apps/mobile/tests/unit/recipesHonestImagery.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const APP_DATA = read("src/context/AppDataContext.tsx");
const CONSTANTS = read("src/context/appData/constants.ts");
const UPLOAD = read("src/app/components/RecipeUpload.tsx");
const TYPES = read("src/types/recipe.ts");

describe("web recipe data layer — no fabricated imagery (ENG-1287)", () => {
  it("AppDataContext maps a missing image to null (no stock substitution)", () => {
    expect(APP_DATA).not.toMatch(/DEFAULT_UPLOADED_RECIPE_IMAGE/);
    const nullFallbacks = APP_DATA.match(/\}\) \?\? null,/g) ?? [];
    expect(nullFallbacks.length).toBeGreaterThanOrEqual(2);
  });

  it("the retired stock-photo constant is deleted", () => {
    expect(CONSTANTS).not.toMatch(/images\.unsplash\.com/);
    expect(CONSTANTS).not.toMatch(/export const DEFAULT_UPLOADED_RECIPE_IMAGE/);
  });

  it("RecipeUpload persists image_url: null for photo-less recipes", () => {
    expect(UPLOAD).not.toMatch(/images\.unsplash\.com/);
    expect(UPLOAD).toMatch(/image_url: finalImageUrl \|\| null,/);
    // Legacy drafts that persisted the retired stock cover reload as no-image.
    expect(UPLOAD).toMatch(/isRetiredStockImageUrl/);
  });

  it("RecipeCard.image is typed string | null", () => {
    expect(TYPES).toMatch(/image: string \| null;/);
  });
});
