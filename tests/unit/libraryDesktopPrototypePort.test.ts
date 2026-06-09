/**
 * Library — desktop prototype port pin (2026-04-20).
 *
 * Grace's 2026-04-19 Claude Design prototype
 * (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebLibrary`) replaced the legacy live Library desktop layout
 * with a prototype-flat grid. This test pins the structural
 * markers so drift is caught in CI rather than on-device.
 *
 * Pins (desktop at `md+`):
 *   1. A `library-desktop-grid` test id renders a `md:grid` (so the
 *      desktop variant is distinct from the mobile-web fallback).
 *   2. Each card renders a fit-% pill (`library-fit-{id}`) sourced
 *      from the shared `computeRecipeFitPercent` helper — parity
 *      with Discover's 2026-04-20 port.
 *   3. Saved-kind cards render a bookmark dot
 *      (`library-saved-dot-{id}`) instead of the kcal overlay, so
 *      the Saved filter pill result is visually recognisable from
 *      scroll distance.
 *   4. The filter pill row uses the shared `LIBRARY_CATEGORY_PILLS`
 *      (All · Breakfast · Lunch · Dinner · Dessert · Quick · …, from
 *      `recipeCategoryFilters` per ENG-921 / Figma 527:2) — web +
 *      mobile both moved off the legacy `libraryFilters` set together.
 *   5. The legacy mobile-web card layout is preserved below `md`
 *      (`md:hidden` wrapper) so narrow widths keep parity with the
 *      live mobile-web experience until the narrow port lands.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const LIBRARY_PATH = resolve(ROOT, "src/app/components/Library.tsx");
const FILTERS_PATH = resolve(ROOT, "src/lib/recipes/recipeCategoryFilters.ts");
const MOBILE_LIBRARY_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/library.tsx");

const SRC = readFileSync(LIBRARY_PATH, "utf8");
const FILTERS_SRC = readFileSync(FILTERS_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_LIBRARY_PATH, "utf8");

describe("Library — desktop prototype port (2026-04-20)", () => {
  describe("desktop grid marker", () => {
    it("renders a `library-desktop-grid` test id on a `hidden md:grid` container", () => {
      expect(SRC).toMatch(/data-testid="library-desktop-grid"/);
      expect(SRC).toMatch(/hidden md:grid/);
    });

    it("renders the mobile-web 2-column photo grid (Figma 527:2) gated behind `md:hidden`", () => {
      // ENG-921 rebuild (2026-06-08): the mobile-web (< md) layout moved
      // from a 1-column full-width card list to the Sloe Figma `527:2`
      // 2-column photo grid. The desktop (md+) grid stays distinct — this
      // pins that the narrow layout is BOTH 2-column AND `md:hidden` so it
      // can't silently revert to 1-column or leak into the desktop grid.
      expect(SRC).toMatch(/grid grid-cols-2 gap-4 md:hidden/);
      expect(SRC).toMatch(/data-testid="library-mobile-grid"/);
    });
  });

  describe("fit-% pill (parity with Discover 2026-04-20 port)", () => {
    it("imports and calls `computeRecipeFitPercent`", () => {
      expect(SRC).toMatch(/computeRecipeFitPercent/);
    });

    it("renders a `library-fit-{id}` test id per desktop card", () => {
      expect(SRC).toMatch(/library-fit-\$\{recipe\.id\}/);
    });

    it("styles the fit pill with primary-tinted bg + tabular nums (prototype spec)", () => {
      expect(SRC).toMatch(/bg-primary\/15 text-primary[^"]*tabular-nums/);
    });
  });

  describe("saved bookmark dot", () => {
    it("renders a `library-saved-dot-{id}` test id for Saved-kind cards", () => {
      expect(SRC).toMatch(/library-saved-dot-\$\{recipe\.id\}/);
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

  describe("mobile-web 2-column rebuild — Sloe Figma 527:2 (ENG-921, 2026-06-08)", () => {
    // The narrow (< md) Library is the Sloe Figma `527:2` cookbook frame:
    // a 2-column photo grid, each card showing a bookmark overlay, a calm
    // `★ saves · time` meta line, a single category-pill row, and a calm
    // count line. NO `…` overflow, NO kind badge.
    //
    // 2026-06-08 (recipe-card redesign-conformance pass) — the earlier
    // "NO macros on the card" call was REVERSED: cards carried no macro
    // data and read as unloaded/broken, so a macro row (kcal · protein ·
    // carbs · fat, protein emphasised — recipes.md §3.1) is now rendered
    // beneath the title on BOTH the desktop and mobile-web cards. The
    // saves/time line stays as a quieter secondary meta. Web + mobile
    // parity is enforced by pinning both here.

    describe("web (src/app/components/Library.tsx)", () => {
      it("renders the 2-column grid with a `library-mobile-grid` test id", () => {
        expect(SRC).toMatch(/data-testid="library-mobile-grid"/);
        expect(SRC).toMatch(/grid grid-cols-2 gap-4 md:hidden/);
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
        expect(SRC).toMatch(/library-bookmark-\$\{recipe\.id\}/);
        expect(SRC).toMatch(/toggleSaveRecipe\(/);
        // No three-dot overflow menu on the mobile-web card.
        expect(SRC).not.toMatch(/MoreHorizontal/);
      });

      it("folds the entry-kind narrowing into a quiet control, not a second pill row", () => {
        // The old full-width entry-kind segmented control
        // (`library-entry-kind-segment`) is gone; the narrowing now rides
        // a single quiet cycle control on the count line.
        expect(SRC).not.toMatch(/data-testid="library-entry-kind-segment"/);
        expect(SRC).toMatch(/data-testid="library-entrykind-cycle"/);
        // The single primary filter row (categories) is still present.
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

      it("folds entry-kind into a quiet count-line control, not a second segmented row", () => {
        // The old full-width `segment` / `segmentItem` styled control is
        // gone; the quiet cycle control writes the same `secondary` state.
        expect(MOBILE_SRC).not.toMatch(/styles\.segmentItem\b/);
        expect(MOBILE_SRC).toMatch(/library-entrykind-cycle/);
        expect(MOBILE_SRC).toMatch(/cycleEntryKind/);
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
});
