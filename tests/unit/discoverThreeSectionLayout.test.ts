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
    it("web renders the recipe section headings + the My Library bottom rail", () => {
      // 2026-05-12 (premium-bar audit web parity): Import card moved
      // to a permanent first card above the feed (mirror of mobile).
      // "From your sources" was renamed to "My Library" since Import
      // is no longer in that bottom-rail block.
      expect(WEB_SRC).toMatch(/>\s*Recipe ideas\s*</);
      expect(WEB_SRC).toMatch(/>\s*More ideas\s*</);
      expect(WEB_SRC).toMatch(/>\s*My Library\s*</);
    });

    it("mobile renders all required section headings (post-2026-05-12 audit)", () => {
      // Mobile uses `<Text>…</Text>` so the literal string appears as
      // the child. "From your sources" was renamed to "My Library"
      // when Import moved to a permanent top card.
      expect(MOBILE_SRC).toMatch(/Recipe ideas/);
      expect(MOBILE_SRC).toMatch(/More ideas/);
      expect(MOBILE_SRC).toMatch(/>\s*My Library\s*</);
    });
  });

  describe("hero card slicing (Recipe ideas)", () => {
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

    it("mobile renders More ideas as compact meal rows inside one card (not hero cards)", () => {
      // The compact More-ideas row was extracted to the DiscoverMoreIdeaRow
      // component (ENG-1225 Block 6 pre-work); the host renders it per row.
      expect(MOBILE_SRC).toMatch(/DiscoverMoreIdeaRow/);
      expect(MOBILE_SRC).not.toMatch(
        /More ideas[\s\S]{0,400}filtered\.slice\(2\)\.map\(\(r\) => renderHeroCard/,
      );
    });
  });

  describe("CTA reordering (Import as permanent first card; My Library at bottom)", () => {
    it("web renders the Import card ABOVE the cluster carousels on mobile-web (ENG-1089, flag-gated)", () => {
      // ENG-1089: the import card JSX is extracted to an `importCard` const and
      // rendered at ONE of two positions by `discover_import_above_carousels_v1`.
      // Flag-on (default) renders it ABOVE the carousels so it's the first feed
      // item on mobile-web (mobile native parity); flag-off keeps the old
      // below-carousels position as the kill switch.
      expect(WEB_SRC).toMatch(/isFeatureEnabled\("discover_import_above_carousels_v1"\)/);
      const newPosIdx = WEB_SRC.indexOf("importAboveCarousels ? importCard : null");
      const carouselsIdx = WEB_SRC.indexOf("discover-cluster-carousels");
      const oldPosIdx = WEB_SRC.indexOf("importAboveCarousels ? null : importCard");
      const matchesIdx = WEB_SRC.search(/>\s*Recipe ideas\s*</);
      const libraryHeadingIdx = WEB_SRC.search(/>\s*My Library\s*</);
      expect(newPosIdx).toBeGreaterThan(0);
      expect(carouselsIdx).toBeGreaterThan(0);
      expect(oldPosIdx).toBeGreaterThan(0);
      // Flag-on render is ABOVE the carousels; legacy fallback stays below them.
      expect(newPosIdx).toBeLessThan(carouselsIdx);
      expect(oldPosIdx).toBeGreaterThan(carouselsIdx);
      // The import card still leads the recipe sections + My Library rail.
      expect(newPosIdx).toBeLessThan(matchesIdx);
      expect(libraryHeadingIdx).toBeGreaterThan(matchesIdx);
    });

    it("web places the bottom My Library rail AFTER the More ideas section", () => {
      // Use the rendered `>Heading<` JSX-boundary patterns so the
      // pre-fix comment-block mentions of "More ideas" / "My Library"
      // at the top of the file don't false-match. The bottom-rail
      // "My Library" heading must follow the recipe-section "More
      // ideas" heading in source order.
      const moreIdeasIdx = WEB_SRC.search(/>\s*More ideas\s*</);
      const libraryHeadingIdx = WEB_SRC.search(/>\s*My Library\s*</);
      expect(moreIdeasIdx).toBeGreaterThan(0);
      expect(libraryHeadingIdx).toBeGreaterThan(moreIdeasIdx);
    });

    it("mobile places the Import card as the FIRST surface above all recipe sections (2026-05-12 audit)", () => {
      // Match the rendered strings, not the JSDoc comments at the top
      // of the file. Section headings render inside a `<Text style=...>`
      // tag so we anchor on the closing `>` from the opening tag.
      const importIdx = MOBILE_SRC.indexOf('testID="discover-import-cta"');
      const matchesIdx = MOBILE_SRC.search(/>\s*Recipe ideas\s*</);
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

  // ── ENG-1082 (2026-06-13) — §7 filter-chip + import-banner cohesion.
  // The Discover filter chips must render byte-identical to the Library
  // row: the soft tint IS the only selection signal, so a rest chip carries
  // NO light-mode ring (the border is gated through `cardElevation.useBorder`,
  // dead → flat-card decision). The import banner is a deliberate soft-tint
  // affordance (NOT a white recipe card), token-sourced, with no border.
  describe("ENG-1082 — §7 filter-chip + import-banner cohesion (cross-platform)", () => {
    it("mobile filter chips gate the border through cardElevation (no hardcoded light-mode ring)", () => {
      // Pre-fix: `borderWidth: StyleSheet.hairlineWidth` unconditionally,
      // putting a ring on Discover rest chips that Library's identical row
      // does not carry. Post-fix both rows gate it the same way.
      expect(MOBILE_SRC).toMatch(
        /borderWidth: cardElevation\.useBorder \? StyleSheet\.hairlineWidth : 0/,
      );
      // The unconditional hairline on the chip is gone.
      expect(MOBILE_SRC).not.toMatch(
        /minHeight: 36,[\s\S]{0,200}borderWidth: StyleSheet\.hairlineWidth,/,
      );
    });

    it("mobile filter chips use the soft-tint selection grammar (accentSoft fill + accentInk label, no solid slab)", () => {
      // Rest = quiet card slab; selected = accentSoft fill + accentInk label.
      expect(MOBILE_SRC).toMatch(/backgroundColor: following \? accentSoft : colors\.card/);
      expect(MOBILE_SRC).toMatch(/backgroundColor: active \? accentSoft : colors\.card/);
      expect(MOBILE_SRC).toMatch(/color: following \? accentInk : colors\.textSecondary/);
      expect(MOBILE_SRC).toMatch(/color: active \? accentInk : colors\.textSecondary/);
    });

    it("web filter chips use bg-primary-soft selected + bg-card rest, with NO selected ring (ENG-1022 parity)", () => {
      expect(WEB_SRC).toMatch(/bg-primary-soft text-primary-solid font-semibold/);
      expect(WEB_SRC).toMatch(/bg-card text-muted-foreground/);
      // No solid accent ring survived on the chips.
      expect(WEB_SRC).not.toMatch(/border-primary-solid[\s\S]{0,40}data-testid="discover-category/);
    });

    it("mobile import banner is a token-sourced soft-tint affordance with NO border or off-token hex", () => {
      expect(MOBILE_SRC).toMatch(/backgroundColor: accent\.primarySoft/);
      // The pre-fix off-token literal-hex fill + tint border are gone.
      expect(MOBILE_SRC).not.toMatch(/backgroundColor: t\.accent \+ "08"/);
      expect(MOBILE_SRC).not.toMatch(/borderColor: t\.accent \+ "22"/);
    });

    it("web import banner is a token-sourced soft-tint affordance with NO ring border", () => {
      // Legacy (flag-off) path keeps the 12% soft-tint fill.
      expect(WEB_SRC).toMatch(/background: "var\(--accent-primary-soft\)"/);
      // Border ring dropped per the flat-surface law.
      expect(WEB_SRC).not.toMatch(/borderColor: "var\(--accent-primary-ring\)"/);
    });
  });

  // ENG-1087 — the import-from-Reel card promoted from a settings-row slab to a
  // hero affordance: flag-gated (default-on) with the legacy nav row kept as the
  // kill switch. Treatment-only (the rendered POSITION on web mobile-web is
  // tracked separately in ENG-1089). Source-structural, both platforms.
  describe("import card → hero affordance (ENG-1087, flag-gated)", () => {
    it("mobile gates the hero on `discover_import_hero_v1`, legacy nav row in the else", () => {
      expect(MOBILE_SRC).toMatch(/isFeatureEnabled\("discover_import_hero_v1"\)/);
      expect(MOBILE_SRC).toMatch(/importHero \? \(/);
      // Two import-cta blocks now exist (hero + legacy); only one renders.
      const ctas = MOBILE_SRC.match(/testID="discover-import-cta"/g) ?? [];
      expect(ctas.length).toBe(2);
    });

    it("mobile hero raises the weight: confident lavender-plum accent + solid plum icon + 'Paste link' pill (ENG-1094)", () => {
      // ENG-1094 (Grace): a confident lavender-plum accent (`importHeroBg`), not
      // the muddy flat ~20% `primarySoftStrong` dark-plum wash that read as grey.
      expect(MOBILE_SRC).toMatch(/backgroundColor: colors\.importHeroBg/);
      // Solid plum icon circle with a WHITE glyph (not the soft IconBox).
      expect(MOBILE_SRC).toMatch(/backgroundColor: accent\.primarySolid,[\s\S]{0,160}<LinkIcon size=\{20\} color=\{Accent\.primaryForeground\}/);
      // Serif headline title + filled "Paste link" pill replacing the chevron.
      expect(MOBILE_SRC).toMatch(/\.\.\.Type\.headline[\s\S]{0,120}Import from TikTok/);
      expect(MOBILE_SRC).toMatch(/Paste link/);
    });

    it("web gates the hero on `discover_import_hero_v1`, legacy nav row in the else", () => {
      expect(WEB_SRC).toMatch(/isFeatureEnabled\("discover_import_hero_v1"\)/);
      // Two import-cta blocks now exist (hero + legacy); only one renders.
      const ctas = WEB_SRC.match(/data-testid="discover-import-cta-top"/g) ?? [];
      expect(ctas.length).toBe(2);
    });

    it("web hero raises the weight: confident lavender-plum accent + solid plum icon + 'Paste link' pill (ENG-1094)", () => {
      expect(WEB_SRC).toMatch(/background: "var\(--import-hero-bg\)"/);
      // Solid plum icon circle (white glyph) instead of the soft IconBox.
      expect(WEB_SRC).toMatch(/rounded-full bg-primary-solid text-white/);
      // Serif headline title + filled "Paste link" pill.
      expect(WEB_SRC).toMatch(/fontFamily: "var\(--font-headline\)"[\s\S]{0,160}Import from TikTok/);
      expect(WEB_SRC).toMatch(/bg-primary-solid px-3 py-1\.5[\s\S]{0,40}Paste link/);
    });
  });
});
