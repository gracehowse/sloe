/**
 * Library — Sloe Figma `527:2` recipe grid (ENG-896).
 *
 * Pins the unified responsive grid (`library-recipe-grid`) that replaced
 * the legacy desktop prototype-flat layout (2026-04-20 port retired).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const LIBRARY_PATH = resolve(ROOT, "src/app/components/Library.tsx");
const FILTERS_PATH = resolve(ROOT, "src/lib/recipes/recipeCategoryFilters.ts");
const MOBILE_LIBRARY_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/library.tsx");
// ENG-1126: the bookmark overlay + toggleSaveRecipe() call moved out of
// Library.tsx into this extracted component (screen-line-budget pin left
// zero slack for the new add-to-collection affordance). SRC alone no
// longer contains the overlay markup — OVERLAY_SRC covers it.
const OVERLAY_PATH = resolve(ROOT, "src/app/components/library/RecipeCardOverlayControls.tsx");

const SRC = readFileSync(LIBRARY_PATH, "utf8");
const FILTERS_SRC = readFileSync(FILTERS_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_LIBRARY_PATH, "utf8");
const OVERLAY_SRC = readFileSync(OVERLAY_PATH, "utf8");

describe("Library — Sloe Figma 527:2 grid (ENG-896)", () => {
  describe("unified recipe grid", () => {
    it("renders `library-recipe-grid` with responsive 2/3-column layout", () => {
      expect(SRC).toMatch(/data-testid="library-recipe-grid"/);
      expect(SRC).toMatch(/grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3/);
    });

    it("does not keep the legacy desktop-only prototype grid", () => {
      expect(SRC).not.toMatch(/data-testid="library-desktop-grid"/);
    });

    it("renders bookmark overlay per card (`library-bookmark-{id}`)", () => {
      expect(OVERLAY_SRC).toMatch(/library-bookmark-\$\{recipe\.id\}/);
    });
  });

  describe("shared filter pill set", () => {
    it("imports `LIBRARY_CATEGORY_PILLS` + `matchesRecipeCategory` from the shared helper", () => {
      // ENG-921 / Figma 527:2: the entry-kind pill set (All · Saved ·
      // High-Protein, from `libraryFilters`) was replaced by the
      // recipe-category pill set (Breakfast · Lunch · Dinner · …, from
      // `recipeCategoryFilters`). Web + mobile both moved off the old
      // helper, so parity holds.
      expect(SRC).toMatch(/LIBRARY_CATEGORY_PILLS/);
      expect(SRC).toMatch(/matchesRecipeCategory/);
    });

    it("renders a `library-filter-pills` test id around the pill row", () => {
      expect(SRC).toMatch(/data-testid="library-filter-pills"/);
    });

    it("shared helper still exports the category-ordered pill set", () => {
      // Paranoia: if the helper order or contents change, this spec
      // also flags. The Figma 527:2 order opens All · Breakfast ·
      // Lunch · Dinner · Dessert · Quick.
      expect(FILTERS_SRC).toMatch(/id:\s*"all"[\s\S]*id:\s*"breakfast"[\s\S]*id:\s*"lunch"[\s\S]*id:\s*"dinner"[\s\S]*id:\s*"dessert"/);
    });
  });

  describe("unified Sloe Figma 527:2 card grid (ENG-896 / ENG-921)", () => {
    // All breakpoints share one `library-recipe-grid`: 2-col mobile-web,
    // 3-col desktop. Square hero, bookmark overlay, macro row, saves/time
    // meta — parity with native mobile Library.

    describe("web (src/app/components/Library.tsx)", () => {
      it("renders the unified grid with responsive column breakpoints", () => {
        expect(SRC).toMatch(/data-testid="library-recipe-grid"/);
        expect(SRC).toMatch(/grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3/);
        expect(SRC).not.toMatch(/data-testid="library-mobile-grid"/);
        expect(SRC).not.toMatch(/library-desktop-grid/);
      });

      it("the card meta uses the REAL saves count (savedCount), never a fabricated rating", () => {
        // `★` pairs with the honest popularity signal. There is no rating
        // field on RecipeCard — a 4.8-style score would be invented data
        // and would trip recipeCardNoScore.test.ts + the trust posture.
        expect(SRC).toMatch(/recipe\.savedCount/);
        // The legacy `P: {recipe.protein}g` chip format (a denser,
        // letter-prefixed style) is gone — the macro row below uses the
        // calm `{protein}g` + macro-hue-icon grammar instead.
        expect(SRC).not.toMatch(/P:\s*\{recipe\.protein\}g/);
      });

      it("renders the macro row (kcal · protein · carbs · fat) beneath the card title (recipes.md §3.1)", () => {
        // Reversal of the earlier "NO macros" call: cards now carry the
        // macro row so they read as a tracker, not unloaded/broken. The
        // four macro colour vars are referenced; protein leads.
        for (const v of ["--macro-calories", "--macro-protein", "--macro-carbs", "--macro-fat"]) {
          expect(SRC, `web Library card missing ${v}`).toContain(v);
        }
        // kcal is suppressed at ≤0 so an un-computed recipe never shows a
        // confident "0 kcal".
        expect(SRC).toMatch(/kcal > 0 \?/);
      });

      it("renders a bookmark overlay toggle per card and no `…` overflow on the card", () => {
        expect(OVERLAY_SRC).toMatch(/library-bookmark-\$\{recipe\.id\}/);
        expect(OVERLAY_SRC).toMatch(/toggleSaveRecipe\(/);
        // No three-dot overflow menu on the mobile-web card.
        expect(SRC).not.toMatch(/MoreHorizontal/);
        expect(OVERLAY_SRC).not.toMatch(/MoreHorizontal/);
      });

      it("surfaces a provenance row above the category row (ENG-1247 'Both rows')", () => {
        // ENG-1247 (Grace 2026-06-26) reverses the ENG-921 single-row polish:
        // the v3 Cookbook shows a provenance row (All/Saved/Created/Imported)
        // ABOVE the category row; the old quiet count-line cycle is gone.
        expect(SRC).not.toMatch(/data-testid="library-entry-kind-segment"/);
        expect(SRC).not.toMatch(/data-testid="library-entrykind-cycle"/);
        expect(SRC).toMatch(/data-testid="library-provenance-pills"/);
        expect(SRC).toMatch(/data-testid="library-filter-pills"/);
      });

      it("keeps a calm count line (Figma 527:2 'N recipes')", () => {
        expect(SRC).toMatch(/data-testid="library-count-line"/);
      });
    });

    describe("mobile (apps/mobile/app/(tabs)/library.tsx) — parity", () => {
      it("uses a 2-column FlatList", () => {
        expect(MOBILE_SRC).toMatch(/numColumns=\{2\}/);
        expect(MOBILE_SRC).toMatch(/columnWrapperStyle=\{styles\.columnWrap\}/);
      });

      it("card renders the macro row (MacroIconRow) AND keeps the saves/time meta", () => {
        // 2026-06-08 (recipe-card redesign-conformance): the macro row was
        // RE-ADDED to the card (recipes.md §3.1) after the cards read as
        // unloaded/broken without it. The honest `★ saves · time` line is
        // kept as a quieter secondary meta — Star + savesCount stay.
        expect(MOBILE_SRC).toMatch(/savesCount/);
        expect(MOBILE_SRC).toMatch(/\bStar\b/);
        expect(MOBILE_SRC).toMatch(/<MacroIconRow/);
        // Protein is emphasised so the card reads as a tracker (§3.1).
        expect(MOBILE_SRC).toMatch(/emphasiseProtein/);
      });

      it("removes the `…` overflow from the card (bookmark is the only overlay)", () => {
        expect(MOBILE_SRC).not.toMatch(/MoreHorizontal/);
        expect(MOBILE_SRC).not.toMatch(/cardOverflowBtn/);
        expect(MOBILE_SRC).toMatch(/toggleCardSave/);
      });

      it("surfaces a provenance row (ENG-1247 'Both rows'), not the old quiet cycle", () => {
        // ENG-1247 reverses ENG-921: the entry-kind buckets are a visible
        // provenance row writing the same `secondary` state; the cycle is gone.
        expect(MOBILE_SRC).not.toMatch(/styles\.segmentItem\b/);
        expect(MOBILE_SRC).not.toMatch(/cycleEntryKind/);
        expect(MOBILE_SRC).toMatch(/LIBRARY_PROVENANCE_PILLS/);
        expect(MOBILE_SRC).toMatch(/library-provenance-/);
      });
    });
  });

  describe("preserved behaviour (regression guards)", () => {
    it("still exposes the sort cycle (Recent → Calories → Protein)", () => {
      expect(SRC).toMatch(/cycleSort/);
      expect(SRC).toMatch(/sortKey/);
    });

    it("still renders the Go-public CTA for unpublished created recipes", () => {
      expect(SRC).toMatch(/Go public/);
    });

    it("still renders the Create-your-own-version CTA for imported recipes", () => {
      expect(SRC).toMatch(/Create your own version/);
    });

    it("still renders the empty-state with a Discover CTA", () => {
      // ENG-921 copy refresh: heading "Your library is empty" →
      // "No saved recipes yet"; the Discover CTA "Go to Discover" →
      // "Explore Discover" (now paired with an "Import a recipe" CTA
      // for the Reel/TikTok save loop). The Discover escape hatch is
      // preserved.
      expect(SRC).toMatch(/No saved recipes yet/);
      expect(SRC).toMatch(/Explore Discover/);
    });
  });

  describe("kcal trust qualifier — Library calorie-sort (ENG-1417 slice E)", () => {
    // This grid (SupprCard) is distinct from the editorial-shelf
    // RecipeCardWide excluded by the 2026-04-28 GW-08 audit — see
    // LibraryShelvesHeader above, which is a separate component/import.
    // Sorting by calories (cycleSort) makes this a decision surface, unlike
    // an unordered browse feed, so it gets the qualifier.
    it("renders via formatQualifiedKcal behind kcal_trust_qualifier_v1, not the bare number", () => {
      expect(SRC).toMatch(
        /import\s*\{\s*formatQualifiedKcal\s*\}\s*from\s*["']\.\.\/\.\.\/lib\/nutrition\/formatMacro["']/,
      );
      expect(SRC).toMatch(/\{kcal > 0 \? \(/);
      expect(SRC).toMatch(
        /isFeatureEnabled\("kcal_trust_qualifier_v1"\) \? formatQualifiedKcal\(kcal, recipe\.isVerified\) : String\(kcal\)/,
      );
    });
  });
});
