/**
 * ENG-1623 — recipe-image alt-text accessibility contract, web surfaces.
 *
 * Problem: recipe photos load correctly but the alt attribute is either
 * always empty (silences a lone hero photo with no other name) or always
 * the title (duplicates the announcement on a card that already names
 * itself via visible text / `aria-label`). The fix is a documented,
 * per-call-site decision — not a blanket default — so this file locks in
 * BOTH halves of that decision across every web recipe-image surface:
 *
 *   - The shared `DiscoverRecipeImage` primitive's `decorative` switch and
 *     its "Alt-text contract" doc block (behavioural coverage for the
 *     switch itself lives in `discoverRecipeImage.test.tsx`).
 *   - The two genuine INFORMATIVE hero/detail placements (`RecipeDetail`'s
 *     full-bleed hero + the public `/recipe/[id]` share page), which have
 *     no adjacent title text and so must expose `alt={recipe.title}`.
 *   - Every ad hoc DECORATIVE card thumbnail implementation (Library,
 *     FeaturedHero, RecipeCardWide, CreatorRecipeList, EditorialProfileBlock,
 *     coach-screen, NorthStar), which stay `alt=""` because they always sit
 *     beside a visible title or a labelled control — pinned so a future
 *     edit can't silently drop the reasoning (or flip the decision without
 *     noticing it was deliberate).
 *
 * `RecipeDetail.tsx` is a ~2k-line component wired to context/router/Supabase
 * (mounting it for an isolated assertion would be a sandbox of mocks — same
 * rationale as `recipeDetailLayoutWeb.test.tsx` and `recipeImageUnderlay.test.ts`),
 * so this file follows their source-string-pin idiom rather than a full RTL
 * render.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ENG-1623 — hero/detail images expose the recipe name (informative alt)", () => {
  it("RecipeDetail full-bleed hero: alt={recipe.title}, documented as the INFORMATIVE case", () => {
    const src = read("src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/<RecipeHeroImage\s*\n\s*src=\{heroSrc\}\s*\n\s*alt=\{recipe\.title\}/);
    // The trailing comment on the alt line names the rule + why (kept on the
    // same line — RecipeDetail.tsx is pinned at its check:screen-budget
    // ceiling, so the doc lives inline rather than as a leading block).
    expect(src).toMatch(/ENG-1623[\s\S]{0,300}INFORMATIVE[\s\S]{0,300}sole namer of the recipe/);
  });

  it("public /recipe/[id] share page hero: alt={recipe.title}, documented as the INFORMATIVE case", () => {
    const src = read("app/recipe/[id]/page.tsx");
    expect(src).toMatch(/<img\s*\n\s*src=\{recipe\.image\}\s*\n\s*alt=\{recipe\.title\}/);
    expect(src).toMatch(/ENG-1623[\s\S]{0,300}sole namer of the recipe/);
  });
});

describe("ENG-1623 — the shared DiscoverRecipeImage primitive documents the decorative-vs-informative rule", () => {
  const src = read("src/app/components/suppr/discover-recipe-image.tsx");

  it("exposes a `decorative` prop (default true) that callers can flip for informative alt text", () => {
    expect(src).toMatch(/decorative\?\s*:\s*boolean/);
    expect(src).toMatch(/decorative\s*=\s*true,?\s*\n/);
    expect(src).toMatch(/const alt = decorative \? "" : title;/);
  });

  it("threads the computed alt onto both the hero and thumb <Image> renders (not a hardcoded alt=\"\")", () => {
    expect(src.match(/alt=\{alt\}/g)?.length).toBe(2);
    // No standalone JSX `alt=""` attribute survives (the doc comment above
    // legitimately mentions `alt=""` in prose while explaining the rule).
    expect(src).not.toMatch(/^\s*alt=""\s*$/m);
  });

  it("documents the full decorative-vs-informative rule directly on the component", () => {
    expect(src).toContain("## Alt-text contract (ENG-1623)");
    expect(src).toMatch(/Decorative.*alt=""/);
    expect(src).toMatch(/Informative.*alt=\{title\}/);
    // Points at the reference informative implementation so a future
    // reader can see the other half of the contract in practice.
    expect(src).toContain("RecipeHeroImage");
  });

  it("the RecipeHeroFallback shown for broken/missing photos stays aria-hidden — it never speaks for itself", () => {
    const fallbackSrc = read("src/app/components/suppr/RecipeHeroFallback.tsx");
    expect(fallbackSrc).toMatch(/aria-hidden="true"/);
  });
});

describe("ENG-1623 — decorative card thumbnails document why alt=\"\" is intentional (not a gap)", () => {
  // Every one of these sits beside a visible title or inside a control whose
  // aria-label already carries the recipe name — verified per-file against
  // the actual render tree when this ticket was implemented. Each carries an
  // ENG-1623 comment explaining the specific adjacent name so a future editor
  // doesn't "fix" the empty alt into a duplicate announcement.
  const decorativeSurfaces: Array<[label: string, path: string]> = [
    ["Library.tsx grid card (RecipeCardImage)", "src/app/components/Library.tsx"],
    ["library/FeaturedHero.tsx (Tonight's pick)", "src/app/components/library/FeaturedHero.tsx"],
    ["library/RecipeCardWide.tsx (editorial shelf)", "src/app/components/library/RecipeCardWide.tsx"],
    ["creator/CreatorRecipeList.tsx row thumb", "src/app/components/creator/CreatorRecipeList.tsx"],
    ["profile/EditorialProfileBlock.tsx grid tile", "src/app/components/profile/EditorialProfileBlock.tsx"],
    ["suppr/coach-screen.tsx candidate row", "src/app/components/suppr/coach-screen.tsx"],
    ["suppr/north-star-block.tsx thumb", "src/app/components/suppr/north-star-block.tsx"],
    ["suppr/north-star-figma-hero.tsx thumb", "src/app/components/suppr/north-star-figma-hero.tsx"],
  ];

  it.each(decorativeSurfaces)("%s: still renders alt=\"\" AND documents the ENG-1623 decorative reasoning", (_label, path) => {
    const src = read(path);
    expect(src).toMatch(/alt=""/);
    expect(src).toContain("ENG-1623");
    // Every file names its decorative/DECORATIVE choice and points back at
    // the primitive that owns the full contract. Wording is condensed to a
    // single line on the two files pinned at their check:screen-budget
    // ceiling (Library.tsx), so match case-insensitively rather than
    // requiring one exact contiguous phrase.
    expect(src).toMatch(/decorative/i);
    expect(src).toContain("discover-recipe-image.tsx");
  });
});
