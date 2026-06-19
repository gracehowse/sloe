import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("ENG-863 runtime Sloe image generation", () => {
  it("web detail gates the author-only gradient CTA, preview approval, label, caption, and removal", () => {
    const src = read("src/app/components/RecipeDetail.tsx");

    expect(src).toContain('isFeatureEnabled("recipe_runtime_image_generation_v1")');
    expect(src).toContain("sloeImageRuntimeEnabled && isMyRecipe && !heroSrc");
    expect(src).toContain("Generate an image");
    expect(src).toContain("preview: true");
    expect(src).toContain("Approve");
    expect(src).toContain("Sloe image");
    expect(src).toContain("Nutrition is");
    expect(src).toContain("Remove Sloe image");
    expect(src).toContain("remove: true");
  });

  it("mobile detail mirrors the Sloe image label, caption, CTA, and removal affordance", () => {
    const screen = read("apps/mobile/app/recipe/[id].tsx");
    const hero = read("apps/mobile/components/recipe/RecipeDetailHero.tsx");

    expect(screen).toContain('isFeatureEnabled("recipe_runtime_image_generation_v1")');
    expect(screen).toContain("canGenerateSloeHero");
    expect(screen).toContain("Generate an image");
    expect(screen).toContain("preview: true");
    expect(screen).toContain("Remove Sloe image");
    expect(screen).toContain("Nutrition is");
    expect(screen).toContain("showSloeImageLabel={isAiGeneratedHero}");
    expect(hero).toContain("showSloeImageLabel");
    expect(hero).toContain("Sloe image");
  });

  it("the image route supports preview-before-save, provenance writes, and removal nulling", () => {
    const route = read("app/api/recipe-import/image-hero/route.ts");

    expect(route).toContain("preview?: unknown");
    expect(route).toContain("remove?: unknown");
    expect(route).toContain("preview: true");
    expect(route).toContain('image_source: "ai_generated"');
    expect(route).toContain("image_model");
    expect(route).toContain("image_generated_at");
    expect(route).toContain("image_url: null");
    expect(route).toContain("image_source: null");
  });

  it("fal storage embeds Sloe provenance metadata before upload", () => {
    const src = read("src/lib/server/falImageGenerator.ts");

    expect(src).toContain("withXmp");
    expect(src).toContain("Sloe image — AI-generated");
    expect(src).toContain("CreditLine>Sloe image");
    expect(src).toContain("embedSloeImageMetadata(bytes, contentType)");
  });
});
