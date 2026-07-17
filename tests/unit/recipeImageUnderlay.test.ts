/**
 * ENG-1374 PR 2 — never-white recipe-image underlay, web surface pins.
 *
 * The structural guarantee: EVERY recipe-image container paints an opaque
 * §11.4 cuisine tint (`recipeUnderlayColor`, or `CARD_CREAM` where the
 * container has no recipe identity) on the WRAPPER itself, so no child
 * failure — 404, SVG mount failure, slow network, style clobber (the
 * ENG-1382 class) — can expose page white. The reference implementation is
 * mobile `apps/mobile/components/library/RecipeCardImage.tsx`; these pins
 * hold the sweep across every web surface so a refactor can't quietly drop
 * an underlay or reintroduce a white/grey ground.
 *
 * Behavioural coverage (rendered wrappers, error paths):
 * `tests/unit/discoverRecipeImage.test.tsx` + `recipeHeroFallback.test.ts`
 * (tint opacity pins). Mobile twin: `apps/mobile/tests/unit/recipeImageUnderlay.test.ts`.
 *
 * ENG-1528 — client consumers thread the resolved scheme into the underlay
 * (`recipeUnderlayColor({…}, scheme)` / `fallbackScheme`) so a dark card gets
 * the dark-ramp tint; the async server recipe page delegates to the client
 * `RecipeUnderlaySurface` wrapper (a server component can't call the hook).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("web recipe-image containers — opaque wrapper underlay (ENG-1374 PR 2)", () => {
  it("DiscoverRecipeImage (Discover rail + grid + list rows, featured hero): all four wrappers tinted, bg-muted gone", () => {
    const src = read("src/app/components/suppr/discover-recipe-image.tsx");
    expect(src).toMatch(/recipeUnderlayColor\(\{ id, title \}, scheme, mediaPalette\)/);
    // hero photo + hero fallback + thumb photo + thumb fallback all paint it
    expect(src.match(/backgroundColor: underlay/g)?.length).toBe(4);
    expect(src).not.toMatch(/className="[^"]*bg-muted/);
  });

  it("RecipeDetail hero wrapper is tinted (the critique's ~280pt grey/white void)", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(
      /height: 375, backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}, fallbackScheme\)/,
    );
  });

  it("Library grid card image wrapper is tinted", () => {
    const src = read("src/app/components/Library.tsx");
    expect(src).toMatch(
      /aspectRatio: "1 \/ 1", backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}, fallbackScheme, sparseMediaEnabled \? "plum-duotone" : "legacy-cuisine"\)/,
    );
  });

  it("FeaturedHero (Tonight's pick) photo slot: cuisine tint replaced the cool plum-grey --background-secondary", () => {
    const src = read("src/app/components/library/FeaturedHero.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}, fallbackScheme, mediaPalette\)/);
    expect(src).not.toContain('backgroundColor: "var(--background-secondary)"');
  });

  it("RecipeCardWide photo slot: cuisine tint replaced --background-secondary", () => {
    const src = read("src/app/components/library/RecipeCardWide.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}, fallbackScheme, mediaPalette\)/);
    expect(src).not.toContain('backgroundColor: "var(--background-secondary)"');
  });

  it("EditorialProfileBlock recipe grid tiles are tinted", () => {
    const src = read("src/app/components/profile/EditorialProfileBlock.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}, fallbackScheme\)/);
  });

  it("coach candidate row thumbs are tinted", () => {
    const src = read("src/app/components/suppr/coach-screen.tsx");
    expect(src).toMatch(
      /backgroundColor: recipeUnderlayColor\(\{ id: candidate\.recipeId, title: candidate\.title \}, fallbackScheme\)/,
    );
  });

  it("NorthStar 'what to eat next' thumbs (block + Figma hero) are tinted", () => {
    for (const p of [
      "src/app/components/suppr/north-star-block.tsx",
      "src/app/components/suppr/north-star-figma-hero.tsx",
    ]) {
      expect(read(p)).toMatch(
        /backgroundColor: recipeUnderlayColor\(\{ id: suggestion\.recipeId, title: suggestion\.title \}, fallbackScheme\)/,
      );
    }
  });

  it("CreatorRecipeList rows: all three branches tinted, bg-muted grounds gone from the image slots", () => {
    const src = read("src/app/components/creator/CreatorRecipeList.tsx");
    expect(src.match(/backgroundColor: recipeUnderlayColor\(\{ id: r\.id, title: r\.title \}, fallbackScheme\)/g)?.length).toBe(3);
    expect(src).not.toContain("object-cover bg-muted");
  });

  it("public /recipe/[id] page: hero (both branches) + ingredient tiles are tinted via the client underlay wrapper (ENG-1528 — server component can't call the scheme hook)", () => {
    const src = read("app/recipe/[id]/page.tsx");
    // All three underlays delegate to the client RecipeUnderlaySurface wrapper,
    // which threads the resolved scheme; no inline underlay survives on the page.
    expect(src.match(/<RecipeUnderlaySurface\b/g)?.length).toBe(3);
    expect(src).not.toMatch(/backgroundColor: recipeUnderlayColor\(/);
    expect(src).toMatch(/import \{ RecipeUnderlaySurface \} from ".*RecipeUnderlaySurface/);
  });

  it("pricing paywall hero wrapper is CARD_CREAM (no recipe identity — never a generic warm token)", () => {
    const src = read("app/pricing/PricingHero.tsx");
    expect(src).toContain("backgroundColor: CARD_CREAM");
    expect(src).toMatch(/import \{ CARD_CREAM \} from ".*recipeHeroFallback/);
  });
});
