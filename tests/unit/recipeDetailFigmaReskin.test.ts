/**
 * Recipe-detail Figma reskin (frame 332:2) — conformance pins.
 *
 * Scope: the VISUAL reskin to Sloe tokens + Figma layout across the three
 * recipe-detail surfaces:
 *   - web public-share page    `app/recipe/[id]/page.tsx`
 *   - web in-app detail        `src/app/components/RecipeDetail.tsx`
 *   - mobile detail            `apps/mobile/app/recipe/[id].tsx`
 *
 * These are large / server / RN components wired to Supabase + a dozen
 * sub-dialogs; mounting them for an isolated visual assertion would be a
 * mock sandbox. Following the `recipeDetailLayoutWeb.test.ts` idiom, we pin
 * the structural visual contract via source-string assertions so a silent
 * regression (a violet gradient creeping back in, the serif title reverting
 * to a sans bold, a card radius dropping to the tight ladder, or a
 * non-functional "Ask" pill being added) breaks the suite.
 *
 * If this test breaks, the recipe-detail Figma reskin has regressed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_SHARE = resolve(__dirname, "../../app/recipe/[id]/page.tsx");
const WEB_IN_APP = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");
const MOBILE = resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx");

const PUBLIC_SRC = readFileSync(PUBLIC_SHARE, "utf8");
const WEB_SRC = readFileSync(WEB_IN_APP, "utf8");
const MOBILE_SRC = readFileSync(MOBILE, "utf8");

describe("public-share page — Sloe palette (delta 1: no violet/indigo)", () => {
  it("has no violet/indigo/sky/blue Tailwind accent classes", () => {
    // Matches `from-violet-600`, `to-indigo-600`, `text-violet-400`,
    // `bg-violet-500`, `bg-blue-500`, `text-sky-600`, etc.
    expect(PUBLIC_SRC).not.toMatch(
      /(?:from-|to-|bg-|text-|border-|ring-|shadow-)(?:violet|indigo|sky|blue)-\d/,
    );
  });

  it("has no slate base surface (replaced by cream background-secondary)", () => {
    expect(PUBLIC_SRC).not.toMatch(/bg-slate-\d/);
    expect(PUBLIC_SRC).toContain("bg-background-secondary");
  });

  it("renders the wordmark + CTA in Sloe plum/clay tokens", () => {
    expect(PUBLIC_SRC).toContain("text-foreground-brand");
    expect(PUBLIC_SRC).toContain("bg-primary text-primary-foreground");
  });
});

describe("public-share page — H1 (delta 2: Newsreader serif plum 36/45)", () => {
  it("renders the H1 with the headline serif font + 36px/45px + plum", () => {
    // The H1 block carries the serif family, the Figma size/line-height, and
    // the plum ink colour token, all on the same element.
    const h1Block = PUBLIC_SRC.slice(
      PUBLIC_SRC.indexOf("<h1"),
      PUBLIC_SRC.indexOf("</h1>"),
    );
    expect(h1Block).toContain("var(--font-headline)");
    expect(h1Block).toContain('fontSize: "36px"');
    expect(h1Block).toContain('lineHeight: "45px"');
    expect(h1Block).toContain("text-foreground-brand");
    // Normal weight per Figma (not bold).
    expect(h1Block).toContain("fontWeight: 400");
  });
});

describe("public-share page — macro strip (delta 3: flat 4-up CAL/PRO/CARB/FAT)", () => {
  it("builds a four-column strip with small-caps labels", () => {
    expect(PUBLIC_SRC).toContain("macroStrip");
    expect(PUBLIC_SRC).toContain('label: "CAL"');
    expect(PUBLIC_SRC).toContain('label: "PRO"');
    expect(PUBLIC_SRC).toContain('label: "CARB"');
    expect(PUBLIC_SRC).toContain('label: "FAT"');
    expect(PUBLIC_SRC).toContain("grid-cols-4");
  });

  it("preserves fibre/sugar/sodium values via a micro-chip row (no value dropped)", () => {
    expect(PUBLIC_SRC).toContain("microChips");
    expect(PUBLIC_SRC).toContain("Fibre");
    expect(PUBLIC_SRC).toContain("Sugar");
    expect(PUBLIC_SRC).toContain("Sodium");
  });

  it("renders the macro value in the serif at 24px", () => {
    // Strip value styled with headline serif at the Figma 24px value size.
    expect(PUBLIC_SRC).toContain('fontSize: "24px"');
  });
});

describe("public-share page — ingredients (delta 4: photo-card grid, existing fallback)", () => {
  it("uses a card grid (not a bullet list)", () => {
    expect(PUBLIC_SRC).toMatch(/grid-cols-3 sm:grid-cols-4/);
  });

  it("uses the EXISTING RecipeHeroFallback for the card image area (no new imagery, no empty box)", () => {
    // recipe_ingredients rows carry no per-ingredient image — the card image
    // area must reuse the deterministic fallback glyph keyed per ingredient.
    expect(PUBLIC_SRC).toContain("RecipeHeroFallback");
    expect(PUBLIC_SRC).toContain("-ing-");
    // No empty grey placeholder box.
    expect(PUBLIC_SRC).not.toMatch(/bg-(?:gray|grey|slate|neutral)-\d00[^]*?image-placeholder/);
  });

  it("rounds the ingredient cards to the Figma 24 corner", () => {
    // The ingredient <li> uses rounded-3xl (24px) per Figma.
    expect(PUBLIC_SRC).toMatch(/rounded-3xl bg-card border border-border/);
  });
});

describe("public-share page — actions/CTA (delta 5/6: radius-full pills)", () => {
  it("renders CTAs as radius-full clay pills", () => {
    expect(PUBLIC_SRC).toMatch(/rounded-full bg-primary text-primary-foreground/);
  });

  it("does NOT add a non-functional Ask pill", () => {
    // The Ask feature is unbuilt — it must not appear on this surface.
    expect(PUBLIC_SRC).not.toMatch(/>\s*Ask\s*</);
  });
});

describe("web in-app detail — full Figma 332:2 visual language (not just bounded deltas)", () => {
  it("page is the warm cream editorial base (background-secondary), not white", () => {
    // The outer wrapper + the sticky bar both ride the cream base so the
    // white slab cards lift off it (the page↔card inversion that makes the
    // slabs read as Figma editorial blocks).
    expect(WEB_SRC).toContain("max-w-4xl mx-auto bg-background-secondary min-h-screen");
    expect(WEB_SRC).toContain("bg-background-secondary/85");
  });

  it("body title is plum Newsreader serif at the Figma ~30px scale (not sans bold)", () => {
    const h1Block = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-body-title"') - 400,
      WEB_SRC.indexOf('data-testid="recipe-body-title"') + 80,
    );
    expect(h1Block).toContain("var(--font-headline)");
    expect(h1Block).toContain("text-foreground-brand");
    expect(h1Block).toContain('fontSize: "30px"');
    // No reverting to the old sans `text-2xl font-bold` title.
    expect(h1Block).not.toContain("text-2xl font-bold");
  });

  it("resting detail cards are WHITE slabs lifting off cream (whiteSlabStyle)", () => {
    // The shared white-slab style (white bg + soft elevation) replaces the
    // cream `bg-card` cards that blended on the cream page.
    expect(WEB_SRC).toContain("whiteSlabStyle");
    expect(WEB_SRC).toContain('backgroundColor: "var(--background)"');
    expect(WEB_SRC).toContain('boxShadow: "var(--elev-card-soft)"');
  });

  it("ingredients render as a photo-card grid (not a bullet/divide list)", () => {
    // Figma 332:2 — the in-app ingredients tab is a 3/4-col grid of cards.
    expect(WEB_SRC).toMatch(/grid grid-cols-3 sm:grid-cols-4 gap-3/);
    expect(WEB_SRC).toContain("recipe-ingredient-card-");
    // Old dense `divide-y` ingredient list is gone.
    expect(WEB_SRC).not.toContain("divide-y divide-border");
  });

  it("ingredient tiles show the on-brand image (Sloe image system) with a calm cream fallback", () => {
    // Sloe image system (2026-06-08): the tile shows the ready Template-B
    // photo from `ingredient_images` when present, else a calm cream
    // placeholder with the sage initial — never the loud gradient glyph.
    expect(WEB_SRC).toContain("resolveIngredientTileImage");
    expect(WEB_SRC).toContain("getIngredientTilePlaceholder");
    // 2026-06-08: hydration moved to `fetchIngredientImages` (returns the map
    // + the missing canonical keys for lazy generate-on-miss).
    expect(WEB_SRC).toContain("fetchIngredientImages");
    expect(WEB_SRC).toContain("recipe-ingredient-image-");
    expect(WEB_SRC).toContain("recipe-ingredient-placeholder-");
    // Labels use the cleaned display name (brand/quantity noise dropped).
    expect(WEB_SRC).toContain("cleanIngredientDisplayName");
  });

  it("Start Cooking + I Made This body action buttons are radius-full", () => {
    // The body action row (the Figma-analogous pill row) uses radius-full
    // clay + cream pills. Pin both directly; "Start Cooking" / "I Made This"
    // also appear in comments, so we match the className shapes, not a slice.
    expect(WEB_SRC).toContain(
      "rounded-full bg-primary text-primary-foreground font-bold text-sm",
    );
    expect(WEB_SRC).toContain(
      "rounded-full bg-card border border-border text-foreground font-bold text-sm",
    );
  });

  it("does NOT add a non-functional Ask pill", () => {
    expect(WEB_SRC).not.toMatch(/>\s*Ask\s*</);
  });

  it("preserves the owner per-ingredient Fix / Override affordances in the new card layout", () => {
    // The card grid must keep the owner edit affordances (verify-search Fix +
    // override dialog) that lived on the old row hover state.
    expect(WEB_SRC).toMatch(/aria-label={`Fix match for \$\{ingredient\.name\}`}/);
    expect(WEB_SRC).toMatch(/aria-label={`Override nutrition for \$\{ingredient\.name\}`}/);
  });
});

describe("ENG-920 (resolved 2026-06-07) — recipe-detail macro summary is the FLAT Figma 332:2 strip", () => {
  // Decision: the in-app + mobile recipe-detail macro summary renders as flat
  // NUMBER tiles (CAL / PRO / CARB / FAT, calories first) — a serif value + a
  // small-caps label in one cream/white card, four equal columns — NOT the
  // old progress-bar tiles. Mirrors the verified public-share strip.

  it("public-share + web in-app + mobile all lead the strip with CAL (calories first)", () => {
    // Public-share already shipped the strip; pin all three lead with CAL.
    for (const SRC of [PUBLIC_SRC, WEB_SRC, MOBILE_SRC]) {
      expect(SRC).toContain("macroStrip");
      expect(SRC).toContain('label: "CAL"');
      expect(SRC).toContain('label: "PRO"');
      expect(SRC).toContain('label: "FAT"');
      // The CARB column is present either as a literal "CARB" label or via the
      // net-carbs lens "NET" swap (in-app + mobile use the lens swap inline).
      expect(SRC).toMatch(/"CARB"/);
    }
  });

  it("web in-app strip is a flat 4-col grid with NO per-macro progress bar", () => {
    const strip = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-macros-grid"'),
      WEB_SRC.indexOf("recipe-macro-micro-chips"),
    );
    expect(strip).toContain("grid-cols-4");
    // Serif value treatment (Newsreader) at the Figma 24px value size.
    expect(strip).toContain("var(--font-headline)");
    expect(strip).toContain('fontSize: "24px"');
    // Small-caps macro label.
    expect(strip).toMatch(/uppercase tracking-\[0\.1em\]/);
    // The OLD progress-bar treatment (a width:% fill div) must be gone from
    // the strip block — flat numbers only.
    expect(strip).not.toMatch(/width:\s*`?\$\{Math\.min\(/);
    // The old "of {target}" per-macro reference is gone from the strip.
    expect(strip).not.toContain("of {m.tgt}");
  });

  it("mobile strip is a flat 4-col row with serif values and NO per-macro progress bar", () => {
    const strip = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf('testID="recipe-macros-grid"'),
      MOBILE_SRC.indexOf("recipe-macro-micro-chips"),
    );
    // Serif Newsreader value at the Figma 24px size.
    expect(strip).toContain("FontFamily.serifRegular");
    expect(strip).toContain("fontSize: 24");
    // Column dividers via borderLeft (the flat-strip column rule).
    expect(strip).toContain("borderLeftWidth");
    // No per-macro progress-bar fill in the strip (the old `width: %` bar).
    expect(strip).not.toMatch(/width:\s*`\$\{Math\.min\(m\.cur/);
  });

  it("net-carbs lens is preserved on both surfaces (label + value swap via shared helpers)", () => {
    for (const SRC of [WEB_SRC, MOBILE_SRC]) {
      expect(SRC).toContain("carbsLabel(");
      expect(SRC).toContain("netCarbsForRow(");
      // The CARB column label swaps to "NET" when the lens is on.
      expect(SRC).toContain('? "NET" : "CARB"');
    }
  });

  it("tracked micros (fiber/sugar/sodium) are not dropped — they fall to a chip row", () => {
    for (const SRC of [WEB_SRC, MOBILE_SRC]) {
      expect(SRC).toContain("recipe-macro-micro-chips");
      expect(SRC).toMatch(/recipeMacrosToShow\.includes\("fiber"\)/);
      expect(SRC).toMatch(/recipeMacrosToShow\.includes\("sugar"\)/);
      expect(SRC).toMatch(/recipeMacrosToShow\.includes\("sodium"\)/);
    }
  });

  it("the stale 'ENG-920 ... DEFERRED' comment is gone (the decision is now resolved)", () => {
    for (const SRC of [WEB_SRC, MOBILE_SRC]) {
      expect(SRC).not.toMatch(/ENG-920[^]*?DEFERRED/);
    }
  });
});

describe("mobile detail — full Figma 332:2 visual language (not just bounded deltas)", () => {
  it("page is the warm cream editorial base (backgroundSecondary), not white", () => {
    // The container background is the cream page so the white slab cards lift
    // off it (the page↔card inversion that fixes the blended-card bug).
    const containerBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("container: { flex: 1"),
      MOBILE_SRC.indexOf("container: { flex: 1") + 120,
    );
    expect(containerBlock).toContain("colors.backgroundSecondary");
  });

  it("recipe title is plum Newsreader serif at the Figma display scale", () => {
    const titleBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("title: {\n      fontFamily: Type.display.fontFamily"),
      MOBILE_SRC.indexOf("authorName:"),
    );
    expect(titleBlock).toContain("Type.display.fontFamily");
    expect(titleBlock).toContain("colors.navPrimary");
    expect(titleBlock).toContain("fontSize: 30");
  });

  it("resting detail cards are WHITE slabs lifting off cream with soft elevation", () => {
    // The card style uses the white `colors.background` fill + the soft
    // elevation (`useCardElevation({ variant: "soft" })`), not the cream
    // `colors.card` that blended on the white page.
    expect(MOBILE_SRC).toContain('useCardElevation({ variant: "soft" })');
    const cardBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("card: {\n      backgroundColor: cardElevation"),
      MOBILE_SRC.indexOf("cardTitle:"),
    );
    expect(cardBlock).toContain("colors.background");
  });

  it("ingredients render as a photo-card grid wired with the Sloe image map", () => {
    // Figma 332:2 — the ingredient list is a photo-card grid rendered by the
    // shared `RecipeIngredientGrid`. Sloe image system (2026-06-08): the
    // screen hydrates `ingredient_images` and passes the map down so each
    // tile shows the on-brand photo (or the calm cream placeholder).
    expect(MOBILE_SRC).toContain("RecipeIngredientGrid");
    // 2026-06-08: hydration moved to `fetchIngredientImages` (map + missing
    // keys for lazy generate-on-miss).
    expect(MOBILE_SRC).toContain("fetchIngredientImages");
    expect(MOBILE_SRC).toContain("imageMap={ingredientImageMap}");
  });

  it("hero has the Figma rounded-bottom + soft fade treatment", () => {
    expect(MOBILE_SRC).toContain("heroWrap:");
    expect(MOBILE_SRC).toContain("borderBottomLeftRadius: 28");
    expect(MOBILE_SRC).toContain("recipe-hero-fade");
  });
});

describe("mobile detail — Figma radii (delta 6)", () => {
  it("detail cards round to 16 (not the tight Radius.lg=8 ladder)", () => {
    // Both the resting `card` and the `sourceCard` carry borderRadius: 16.
    const cardBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("card: {\n      backgroundColor: cardElevation"),
      MOBILE_SRC.indexOf("cardTitle:"),
    );
    expect(cardBlock).toContain("borderRadius: 16");
    const sourceCardBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("sourceCard: {"),
      MOBILE_SRC.indexOf("sourceLabel:"),
    );
    expect(sourceCardBlock).toContain("borderRadius: 16");
  });

  it("macro tiles round to 16", () => {
    // The inline macro-tile style uses borderRadius: 16.
    const macroBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("recipe-macros-grid"),
      MOBILE_SRC.indexOf("recipe-fits-your-day"),
    );
    expect(macroBlock).toContain("borderRadius: 16");
  });

  it("primary action + sticky-footer pills are radius-full", () => {
    const actionBtnBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("actionBtn: {"),
      MOBILE_SRC.indexOf("actionBtnText:"),
    );
    expect(actionBtnBlock).toContain("borderRadius: Radius.full");
    const footerBtnBlock = MOBILE_SRC.slice(
      MOBILE_SRC.indexOf("stickyFooterBtn: {"),
      MOBILE_SRC.indexOf("stickyFooterBtnText:"),
    );
    expect(footerBtnBlock).toContain("borderRadius: Radius.full");
  });

  it("does NOT add a non-functional Ask pill", () => {
    expect(MOBILE_SRC).not.toMatch(/["']\s*Ask\s*["']/);
  });
});

describe("app-only features preserved across the reskin (no logic ripped out)", () => {
  it("web in-app keeps Cook Mode, verification, owner controls, stepper, net-carbs", () => {
    expect(WEB_SRC).toContain("CookMode");
    expect(WEB_SRC).toContain("autoVerifyingIngredients");
    expect(WEB_SRC).toContain("RecipeEditDialog");
    expect(WEB_SRC).toContain("GoPublicDialog");
    expect(WEB_SRC).toContain("recipe-view-servings-stepper");
    expect(WEB_SRC).toContain("netCarbsForRow");
    expect(WEB_SRC).toContain("OverrideIngredientDialog");
  });

  it("mobile keeps Cook Mode, verification, sticky log footer, stepper, net-carbs", () => {
    expect(MOBILE_SRC).toContain("setCookMode");
    expect(MOBILE_SRC).toContain("autoVerifyingIngredients");
    expect(MOBILE_SRC).toContain("recipe-detail-sticky-footer");
    expect(MOBILE_SRC).toContain("netCarbsForRow");
  });

  it("public-share keeps JSON-LD + page-view tracking + confidence disclosure", () => {
    expect(PUBLIC_SRC).toContain("application/ld+json");
    expect(PUBLIC_SRC).toContain("recipe_page_viewed");
    expect(PUBLIC_SRC).toContain("confidenceTier");
  });
});
