import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RECIPE_PLACEHOLDER_IDENTITY_FLAG,
  recipeHeroGlyphClampCss,
  resolveRecipeHeroGlyphPx,
} from "../../src/lib/recipe/recipeHeroFallback";

/**
 * ENG-1552 / ENG-1667 — the photo-less hero fallback glyph must scale with its
 * container. ENG-1667 raises the cap on hero slabs when
 * `recipe_placeholder_identity_v1` is on.
 */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ENG-1667 — shared glyph scale resolver", () => {
  it("identity off keeps ENG-1552 thumb caps (112 / 30%)", () => {
    expect(
      resolveRecipeHeroGlyphPx({ iconSize: 28, variant: "thumb", identityV1: false, containerMin: 400 }),
    ).toBe(112);
    expect(recipeHeroGlyphClampCss(28, "thumb", false)).toBe("clamp(28px, 30cqmin, 112px)");
  });

  it("identity on scales hero slabs larger (144 / 38%)", () => {
    expect(
      resolveRecipeHeroGlyphPx({ iconSize: 48, variant: "hero", identityV1: true, containerMin: 400 }),
    ).toBe(144);
    expect(recipeHeroGlyphClampCss(48, "hero", true)).toBe("clamp(48px, 38cqmin, 144px)");
  });

  it("identity on leaves thumb slabs at ENG-1552 caps", () => {
    expect(
      resolveRecipeHeroGlyphPx({ iconSize: 28, variant: "thumb", identityV1: true, containerMin: 400 }),
    ).toBe(112);
  });
});

describe("ENG-1552 / ENG-1667 — hero fallback glyph scales with the container (web + mobile)", () => {
  it("web fallback uses a container-query-scaled glyph", () => {
    const src = read("src/app/components/suppr/RecipeHeroFallback.tsx");
    expect(src).toContain('containerType: "size"');
    expect(src).toContain("recipeHeroGlyphClampCss");
    expect(src).toContain(RECIPE_PLACEHOLDER_IDENTITY_FLAG);
    expect(src).not.toMatch(/<Glyph\s+width=\{iconSize\}/);
  });

  it("mobile fallback measures the slab and scales the glyph from its smaller side", () => {
    const src = read("apps/mobile/components/RecipeHeroFallback.tsx");
    expect(src).toContain("onLayout=");
    expect(src).toContain("resolveRecipeHeroGlyphPx");
    expect(src).toMatch(/<Glyph size=\{glyphSize\}/);
  });
});
