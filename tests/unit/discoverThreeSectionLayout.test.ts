/**
 * Discover tab layout — pins the 2026-04-19 Claude Design prototype
 * port (`docs/prototypes/2026-04-19-whole-app-experience/project/
 * screens-mobile.jsx` → `DiscoverScreen` function) and the
 * 2026-05-12 premium-bar audit override on the Import card.
 *
 * MOBILE structure (post-2026-05-12 audit):
 *   - Permanent Import card AT THE TOP (refuse-to-pass #8: "Promote
 *     Import from a link to permanent first Discover card"). testID
 *     `discover-import-cta` stable.
 *   - "Matches your day" — 2 hero cards (16:10 image, full width)
 *     drawn from `filtered.slice(0, 2)`.
 *   - "More ideas" — a single card containing compact meal-row
 *     style list rows for `filtered.slice(2)`.
 *   - "My Library" — bottom rail with the saved-recipes jump card.
 *
 * WEB structure (unchanged 2026-04-20 prototype port):
 *   1. "Matches your day"
 *   2. "More ideas"
 *   3. "From your sources" — Import + My Library CTAs at the bottom
 *
 * Empty-state rule: when the filtered recipe list is empty we skip
 * sections 1 + 2 and fall back to the existing "No recipes yet" /
 * "Nothing to show" empty state. The bottom rail (mobile) / Section
 * 3 (web) still renders so users can still bring content in.
 *
 * F-11 still stands: NO fit-percent badge on either platform. The
 * prototype drew one but tester feedback killed it
 * (`recipeCardNoScore.test.ts` pins its absence). The brief
 * explicitly allowed skipping the badge — "don't block shipping".
 *
 * This test is structural (reads the source) so it runs cheaply in
 * the shared web vitest run and applies to both platforms from one
 * spec — matching the pattern used by `recipeCardNoScore.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");

const WEB_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");

describe("Discover tab — three-section layout (2026-04-20 prototype port)", () => {
  describe("section headings", () => {
    it("web renders all three section headings", () => {
      expect(WEB_SRC).toMatch(/>\s*Matches your day\s*</);
      expect(WEB_SRC).toMatch(/>\s*More ideas\s*</);
      expect(WEB_SRC).toMatch(/>\s*From your sources\s*</);
    });

    it("mobile renders all required section headings (post-2026-05-12 audit)", () => {
      // Mobile uses `<Text>…</Text>` so the literal string appears as
      // the child. "From your sources" was renamed to "My Library"
      // when Import moved to a permanent top card.
      expect(MOBILE_SRC).toMatch(/Matches your day/);
      expect(MOBILE_SRC).toMatch(/More ideas/);
      expect(MOBILE_SRC).toMatch(/>\s*My Library\s*</);
    });
  });

  describe("hero card slicing (Matches your day)", () => {
    it("web takes the first 2 recipes for the hero section", () => {
      expect(WEB_SRC).toMatch(/recipes\.slice\(0,\s*2\)/);
    });

    it("mobile takes the first 2 recipes for the hero section", () => {
      expect(MOBILE_SRC).toMatch(/filtered\.slice\(0,\s*2\)/);
    });
  });

  describe("more-ideas slicing (rest of the list)", () => {
    it("web uses recipes from index 2+ in the More ideas list", () => {
      expect(WEB_SRC).toMatch(/recipes\.slice\(2\)/);
    });

    it("mobile uses recipes from index 2+ in the More ideas list", () => {
      expect(MOBILE_SRC).toMatch(/filtered\.slice\(2\)/);
    });
  });

  describe("CTA reordering (From your sources at the bottom)", () => {
    it("web places the 'From your sources' heading BEFORE the Import / My Library CTAs", () => {
      const headingIdx = WEB_SRC.indexOf("From your sources");
      const importIdx = WEB_SRC.indexOf("Import from TikTok, Instagram...");
      const libraryIdx = WEB_SRC.indexOf("My Library</p>");
      expect(headingIdx).toBeGreaterThan(0);
      expect(importIdx).toBeGreaterThan(headingIdx);
      expect(libraryIdx).toBeGreaterThan(headingIdx);
    });

    it("web places the Import / My Library CTAs AFTER the More ideas section", () => {
      const moreIdeasIdx = WEB_SRC.indexOf("More ideas");
      const importIdx = WEB_SRC.indexOf("Import from TikTok, Instagram...");
      expect(moreIdeasIdx).toBeGreaterThan(0);
      expect(importIdx).toBeGreaterThan(moreIdeasIdx);
    });

    it("mobile places the Import card as the FIRST surface above all recipe sections (2026-05-12 audit)", () => {
      // Match the rendered strings, not the JSDoc comments at the top
      // of the file. Section headings render inside a `<Text style=...>`
      // tag so we anchor on the closing `>` from the opening tag.
      const importIdx = MOBILE_SRC.indexOf('testID="discover-import-cta"');
      const matchesIdx = MOBILE_SRC.search(/>\s*Matches your day\s*</);
      const moreIdeasIdx = MOBILE_SRC.search(/>\s*More ideas\s*</);
      const libraryHeadingIdx = MOBILE_SRC.search(/>\s*My Library\s*</);
      expect(importIdx).toBeGreaterThan(0);
      // Import card comes before all section headings.
      expect(matchesIdx).toBeGreaterThan(importIdx);
      expect(moreIdeasIdx).toBeGreaterThan(importIdx);
      // My Library jump-card stays in the bottom rail.
      expect(libraryHeadingIdx).toBeGreaterThan(moreIdeasIdx);
    });
  });

  describe("empty-state parity", () => {
    it("web still renders a 'No recipes / Nothing to show' empty state when there are no filtered recipes", () => {
      // Either `recipes.length === 0` (old shape), `recipes.length > 0 ? …`
      // ternary (mid shape), or `displayRecipes.length …` (post-Wave-4
      // cluster carousels) is fine — the contract is that the
      // `Nothing to show` branch still exists.
      expect(WEB_SRC).toMatch(
        /(?:displayRecipes|recipes)\.length\s*(?:===?\s*0|>\s*0|>\s*2)/,
      );
      expect(WEB_SRC).toMatch(/Nothing to show/);
    });

    it("mobile still renders the 'No recipes yet' / search-miss empty state", () => {
      expect(MOBILE_SRC).toMatch(/filtered\.length === 0/);
      expect(MOBILE_SRC).toMatch(/No recipes yet/);
    });
  });

  describe("F-11 no-score parity (prototype's fit badge NOT added)", () => {
    // Paranoia pin — the prototype draws a fit-percent badge on each
    // hero. F-11 killed that badge; the 2026-04-19 brief explicitly
    // permitted skipping it ("don't block shipping"). This asserts the
    // new section code didn't silently re-add one.
    it("web Discover does not render a fit/confidence percent badge", () => {
      expect(WEB_SRC).not.toMatch(/\{\s*recipe\.confidence\s*\}/);
      expect(WEB_SRC).not.toMatch(/\{\s*recipe\.fit\s*\}/);
    });

    it("mobile Discover does not render a fit/confidence percent badge", () => {
      expect(MOBILE_SRC).not.toMatch(/\{\s*item\.confidence\s*\}/);
      expect(MOBILE_SRC).not.toMatch(/\{\s*r\.confidence\s*\}/);
      expect(MOBILE_SRC).not.toMatch(/\{\s*item\.fit\s*\}/);
    });
  });

  describe("preserved behaviour (regression guards)", () => {
    it("web still filters by searchQuery (case-insensitive)", () => {
      expect(WEB_SRC).toMatch(/searchQuery/);
    });

    it("web still keeps the Eating-out row (debounced restaurant search)", () => {
      expect(WEB_SRC).toMatch(/Eating out/);
    });

    it("mobile still filters by search text (now via shared tokenized matcher)", () => {
      // Polish (2026-04-25) — pre-fix this checked for `search.toLowerCase()`,
      // the substring approach. Bug: "wasabi katsu curry" failed when the
      // title was "Katsu Curry by Wasabi" because tokens weren't contiguous.
      // Now both web and mobile route through `recipeSearchMatch` for
      // proper per-token AND matching across title + description + creator.
      expect(MOBILE_SRC).toMatch(/recipeSearchMatch/);
    });

    it("mobile still keeps the Eating-out row (debounced restaurant search)", () => {
      expect(MOBILE_SRC).toMatch(/Eating out/);
    });

    it("mobile still keeps the clipboard-import focus detector", () => {
      expect(MOBILE_SRC).toMatch(/consumeNewSocialRecipeUrlFromClipboard/);
    });
  });
});
