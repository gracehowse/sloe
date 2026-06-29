/**
 * ENG-1247 — Recipe-detail v3 prototype-conformance pins (MOBILE).
 *
 * Reference: `docs/ux/redesign/v3/Sloe-App.html` `RecipeDetail` (hero title
 * overlay L4336–4341, standfirst L4353, sticky CTA L4418–4421).
 *
 * The v3 conformance pass ships behind the default-OFF flag
 * `recipe_detail_v3_conformance` (old path alive in the `else`). The screen +
 * its extracted components are 2k+ LOC wired to Supabase / expo-router / cook
 * mode, so — following the `recipeDetailV3SourcePins.test.ts` idiom — we pin the
 * structural contract via source-string assertions against the screen AND its
 * extracted components. Web twin: `tests/unit/recipeDetailV3Conformance.test.ts`.
 * If this breaks, the v3 recipe-detail conformance has regressed on mobile.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const SCREEN = read("../../app/recipe/[id].tsx");
const HERO = read("../../components/recipe/RecipeDetailHero.tsx");
const TITLE_BLOCK = read("../../components/recipe/RecipeTitleBlock.tsx");
const STANDFIRST = read("../../components/recipe/RecipeStandfirst.tsx");
const ACTION_PILLS = read("../../components/recipe/RecipeActionPills.tsx");
const SERVINGS_FOOTER = read("../../components/recipe/RecipeServingsFooter.tsx");
const ANALYTICS = read("../../lib/analytics.ts");

describe("ENG-1247 — flag registration (mobile)", () => {
  it("registers recipe_detail_v3_conformance as a known default-OFF flag", () => {
    const block = ANALYTICS.slice(
      ANALYTICS.indexOf("export const KNOWN_DEFAULT_OFF_FLAGS"),
      ANALYTICS.indexOf("] as const", ANALYTICS.indexOf("KNOWN_DEFAULT_OFF_FLAGS")),
    );
    expect(block).toContain('"recipe_detail_v3_conformance"');
  });

  it("the screen reads the flag and gates the new path on it", () => {
    expect(SCREEN).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(SCREEN).toContain("const recipeDetailV3 =");
  });
});

describe("ENG-1247 — hero title overlay (mobile)", () => {
  it("the hero renders the overlay only when a photo shows (never on the placeholder)", () => {
    expect(HERO).toContain("const showOverlay = showPhoto && overlay != null");
    expect(HERO).toContain('testID="recipe-hero-title-overlay"');
  });

  it("overlay carries kicker + serif H1 + clock/flame/serves meta", () => {
    expect(HERO).toContain('testID="recipe-hero-kicker"');
    expect(HERO).toContain('testID="recipe-hero-overlay-title"');
    // Serif overlay title.
    expect(HERO).toContain("FontFamily.serifRegular");
    // Meta glyphs: clock (time) + flame (kcal) + utensils (serves).
    expect(HERO).toContain("Clock");
    expect(HERO).toContain("Flame");
    expect(HERO).toContain("UtensilsCrossed");
    expect(HERO).toContain("Serves ");
  });

  it("the screen composes the overlay only when flag ON AND a photo shows", () => {
    expect(SCREEN).toContain("const heroOverlayActive = recipeDetailV3 && heroShowsPhoto");
    expect(SCREEN).toContain("overlay={heroOverlay}");
    // Kicker: "From your cookbook" when saved, else the honest "Fits your day".
    expect(SCREEN).toContain('saved ? "From your cookbook" : "Fits your day"');
  });

  it("hides the duplicate body title when the overlay is active", () => {
    expect(SCREEN).toContain("hideTitle={heroOverlayActive}");
    expect(TITLE_BLOCK).toContain("hideTitle");
    expect(TITLE_BLOCK).toContain("{hideTitle ? null : (");
  });
});

describe("ENG-1247 — editorial standfirst (mobile)", () => {
  it("renders the serif standfirst when the flag is ON, with a graceful fallback", () => {
    expect(SCREEN).toContain("recipeDetailV3 ? (");
    expect(SCREEN).toContain("<RecipeStandfirst");
    expect(STANDFIRST).toContain('testID="recipe-standfirst"');
    expect(STANDFIRST).toContain("FontFamily.serifRegular");
    // Protein-anchored fallback (prototype L4353).
    expect(STANDFIRST).toContain("g of protein that sits comfortably");
  });
});

describe("ENG-1247 — consolidated sticky CTA bar (mobile)", () => {
  it("the footer renders the filled Log primary + Cook Mode outline when onLog is set", () => {
    expect(SERVINGS_FOOTER).toContain('testID="recipe-detail-sticky-footer"');
    // Log filled primary.
    expect(SERVINGS_FOOTER).toContain('testID="recipe-footer-log-cta"');
    expect(SERVINGS_FOOTER).toContain('variant="primary"');
    // Cook Mode outline secondary (transparent ground + aubergine border).
    expect(SERVINGS_FOOTER).toContain('testID="recipe-cook-mode-cta"');
    expect(SERVINGS_FOOTER).toContain('backgroundColor: "transparent"');
    expect(SERVINGS_FOOTER).toContain("borderColor: accent.primarySolid");
    // Yield stepper stays (the canonical servings control).
    expect(SERVINGS_FOOTER).toContain("Yield");
  });

  it("the screen wires Log into the footer only when the flag is ON", () => {
    expect(SCREEN).toContain(
      "onLog={recipeDetailV3 ? () => void addRecipeToTodayJournal() : undefined}",
    );
  });
});

describe("ENG-1247 — borderless macro strip (mobile)", () => {
  it("passes the v3 borderless variant to RecipeMacroStrip when the flag is ON", () => {
    expect(SCREEN).toContain(
      'variant={recipeDetailV3 ? "borderless" : "slab"}',
    );
  });
});

describe("ENG-1247 — RecipeActionPills collapses to owner Edit-only in v3", () => {
  it("the screen passes showLog={!recipeDetailV3} so Log leaves the action row", () => {
    expect(SCREEN).toContain("showLog={!recipeDetailV3}");
  });

  it("the pills render nothing for a non-owner when Log is suppressed", () => {
    expect(ACTION_PILLS).toContain("showLog");
    expect(ACTION_PILLS).toContain("if (!showLog && !onEdit) return null");
  });

  it("the legacy Log pill still exists in the flag-OFF (showLog default) path", () => {
    // Kill-switch path alive: the dominant Log primary renders when showLog.
    expect(ACTION_PILLS).toContain("showLog ? (");
    expect(ACTION_PILLS).toContain('testID="recipe-action-log"');
  });
});
