/**
 * recipe-card macro row + warm fallback — the 2026-06-08 pass that
 * fixed "Library/Discover/Plan cards show empty pale-lilac boxes and no
 * macros, reading as unloaded/broken".
 *
 * Two durable guarantees, pinned structurally (source-grep) on BOTH
 * platforms so a future edit can't silently regress either:
 *
 *   1. Macro row on the cards. The Library + Discover cards render a
 *      MacroIconRow / kcal·protein·carbs·fat row that reaches for the
 *      immutable macro colours. (The planner inline meal-row is
 *      intentionally macro-light per Grace 2026-05-22 — full macros on
 *      tap-through — so it is NOT asserted here.)
 *
 *   2. Warm fallback, never a flat lilac/grey block. The card image
 *      surfaces route a missing/broken image through RecipeHeroFallback
 *      (the sage→cream §11.4 tile), and the Library card image wrap base
 *      fill is the warm card cream, NOT the lilac `colors.border`
 *      hairline that read as the "empty box".
 *
 * If any of these greps fail, the card is at risk of reading broken
 * again — route back to the recipe-card redesign brief, don't loosen.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const MOBILE_LIBRARY = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/library.tsx"), "utf8");
const MOBILE_DISCOVER = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx"), "utf8");
const MOBILE_PLANNER = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"), "utf8");
const WEB_LIBRARY = readFileSync(resolve(ROOT, "src/app/components/Library.tsx"), "utf8");
const WEB_DISCOVER = readFileSync(resolve(ROOT, "src/app/components/DiscoverFeed.tsx"), "utf8");

describe("Library card — macro row (recipes.md §3.1)", () => {
  it("mobile Library renders a MacroIconRow on the card with protein emphasised", () => {
    expect(MOBILE_LIBRARY).toMatch(/<MacroIconRow/);
    expect(MOBILE_LIBRARY).toMatch(/emphasiseProtein/);
  });

  it("mobile Library suppresses kcal at ≤0 so an un-computed recipe never shows '0 kcal'", () => {
    expect(MOBILE_LIBRARY).toMatch(/item\.calories > 0 \? item\.calories : null/);
  });

  it("web Library desktop + mobile-web cards reference all four macro colour vars", () => {
    for (const v of ["--macro-calories", "--macro-protein", "--macro-carbs", "--macro-fat"]) {
      expect(WEB_LIBRARY, `web Library missing ${v}`).toContain(v);
    }
  });

  it("web Library suppresses kcal at ≤0 on the cards", () => {
    expect(WEB_LIBRARY).toMatch(/kcal > 0 \?/);
  });
});

describe("Discover card — macro row + stale-brand byline calm", () => {
  it("mobile Discover hero card renders the shared MacroIconRow", () => {
    expect(MOBILE_DISCOVER).toMatch(/<MacroIconRow/);
  });

  it("web Discover card renders carbs + fat values (added for parity with mobile)", () => {
    // The web Discover card overlays its macro chips on the photo, so the
    // icons are white-for-contrast rather than the macro CSS vars (an
    // existing intentional white-on-photo treatment). What the §3.1 pass
    // added is the carbs + fat VALUES alongside the existing kcal +
    // protein, plus the macro Icons.carbs / Icons.fat glyphs.
    expect(WEB_DISCOVER).toMatch(/<Icons\.carbs\b/);
    expect(WEB_DISCOVER).toMatch(/<Icons\.fat\b/);
    expect(WEB_DISCOVER).toMatch(/\{carbs\}g/);
    expect(WEB_DISCOVER).toMatch(/\{fat\}g/);
  });

  it("both platforms route the byline through displayAttribution (calms the stale seed brand)", () => {
    expect(MOBILE_DISCOVER).toMatch(/displayAttribution\(/);
    expect(WEB_DISCOVER).toMatch(/displayAttribution\(/);
  });

  it("no card renders the stale brand byline as a literal JSX/string value", () => {
    // The byline must come from `displayAttribution`, never a hardcoded
    // literal. We allow the brand to appear in a code comment (the remap
    // is documented there), so target the rendered forms only:
    //   - a JSX text child   >Suppr Kitchen<
    //   - a quoted prop/string  ="Suppr Kitchen"  or  : "Suppr Kitchen"
    for (const src of [MOBILE_DISCOVER, WEB_DISCOVER, MOBILE_LIBRARY, WEB_LIBRARY]) {
      expect(src).not.toMatch(/>\s*Suppr Kitchen\s*</);
      expect(src).not.toMatch(/[:=]\s*["']Suppr Kitchen["']/);
    }
  });
});

describe("warm fallback — never a flat lilac/grey block (§11.4)", () => {
  it("mobile Library image wrap base fill is the warm card cream, not the lilac border", () => {
    // The fix: cardImageWrap backgroundColor moved off `colors.border`
    // (#E8E2EC lilac) onto `colors.card` (cream). Assert the wrap no
    // longer uses the bare border token for its base fill.
    const wrap = MOBILE_LIBRARY.match(/cardImageWrap:\s*\{[\s\S]*?\}/);
    expect(wrap).not.toBeNull();
    expect(wrap![0]).toContain("backgroundColor: colors.card");
    expect(wrap![0]).not.toMatch(/backgroundColor:\s*colors\.border\b/);
  });

  it("mobile Library leaves the RecipeCardImage ground to the component — ENG-1374 PR 2 retired the fallbackBg prop (the component now paints the recipe's own opaque cuisine tint internally, so no caller can reintroduce a white/grey ground)", () => {
    expect(MOBILE_LIBRARY).not.toMatch(/fallbackBg=/);
    expect(
      readFileSync(resolve(ROOT, "apps/mobile/components/library/RecipeCardImage.tsx"), "utf8"),
    ).toMatch(
      /recipeUnderlayColor\(\{ id: recipeId, title: recipeTitle \}, scheme\)/,
    );
  });

  it("mobile Discover 'More ideas' rows fall back to RecipeHeroFallback, not a chef-hat box", () => {
    expect(MOBILE_DISCOVER).toMatch(/<RecipeHeroFallback/);
    // The old flat fallback used a ChefHat glyph; it must be gone.
    expect(MOBILE_DISCOVER).not.toMatch(/<ChefHat\b/);
  });

  it("mobile planner meal-row thumbnail falls back to RecipeHeroFallback on a broken/missing image", () => {
    expect(MOBILE_PLANNER).toMatch(/<RecipeHeroFallback/);
    // Routed through the PlanMealThumb helper with an onError flag.
    expect(MOBILE_PLANNER).toMatch(/function PlanMealThumb/);
    expect(MOBILE_PLANNER).toMatch(/onError=\{\(\) => setBroken\(true\)\}/);
  });
});
