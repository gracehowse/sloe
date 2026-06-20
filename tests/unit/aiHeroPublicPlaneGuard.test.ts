import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("ENG-864 AI hero generation public-plane guard", () => {
  it("route skips published recipes before generation or writes", () => {
    const src = read("app/api/recipe-import/image-hero/route.ts");
    expect(src).toMatch(/\.select\("id, title, author_id, image_url, image_source, published"\)/);
    expect(src).toMatch(/published\?: boolean \| null/);
    expect(src).toMatch(/return skipped\("published_no_ai_image"\)/);
    expect(src.indexOf('published_no_ai_image')).toBeLessThan(src.indexOf('result = await generateDishImage'));
    expect(src).toMatch(/image_source: "ai_generated"/);
    expect(src).toMatch(/image_model: FAL_IMAGE_MODEL/);
    expect(src).toMatch(/image_generated_at:/);
  });

  it("web and mobile create flows do not auto-post AI heroes for published recipes", () => {
    expect(read("src/app/components/RecipeUpload.tsx")).toMatch(/if \(!effectivePublished && \(finalImageUrl \|\| DEFAULT_COVER_IMAGE\) === DEFAULT_COVER_IMAGE\)/);
    expect(read("apps/mobile/app/create-recipe.tsx")).toMatch(/if \(!publish && !imgUrl\)/);
    expect(read("apps/mobile/components/recipe/CreateRecipeWizard.tsx")).toMatch(/if \(!publishOnSave && !imgUrl\)/);
  });

  it("backfill only selects private drafts and records ai_generated provenance", () => {
    const src = read("scripts/backfill-images.ts");
    expect(src).toMatch(/\.select\("id, title, image_url, published"\)\s*\.eq\("published", false\)/);
    expect(src).toMatch(/image_source: "ai_generated"/);
    expect(src).toMatch(/image_model: FAL_IMAGE_MODEL/);
  });
});
