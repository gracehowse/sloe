/**
 * ENG-1247 — Recipe-detail v3 prototype-conformance pins (WEB).
 *
 * Reference: `docs/ux/redesign/v3/Sloe-App.html` `RecipeDetail` (hero title
 * overlay L4336–4341, standfirst L4353, sticky CTA L4418–4421).
 *
 * The v3 conformance pass ships behind `recipe_detail_v3_conformance`
 * (default-ON since 2026-06-29; PostHog kill switch via isFeatureDisabled).
 * `recipe_detail_v3_conformance` (old path alive in the `else`). `RecipeDetail`
 * is a 3k-line component wired to Supabase + a dozen dialogs; mounting it for an
 * isolated assertion would be a mock sandbox, so — following the
 * `recipeDetailFigmaReskin.test.ts` idiom — we pin the structural contract via
 * source-string assertions. If this breaks, the v3 recipe-detail conformance
 * has regressed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/RecipeDetail.tsx"),
  "utf8",
);
const WEB_TRACK = readFileSync(
  resolve(__dirname, "../../src/lib/analytics/track.ts"),
  "utf8",
);

describe("ENG-1247 — flag registration (web)", () => {
  it("registers recipe_detail_v3_conformance as default-ON", () => {
    const block = WEB_TRACK.slice(
      WEB_TRACK.indexOf("REDESIGN_DEFAULT_ON"),
      WEB_TRACK.indexOf("]);", WEB_TRACK.indexOf("REDESIGN_DEFAULT_ON")),
    );
    expect(block).toContain('"recipe_detail_v3_conformance"');
  });

  it("reads the flag in RecipeDetail and gates the new path on it", () => {
    expect(WEB_SRC).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(WEB_SRC).toContain("const recipeDetailV3 =");
  });
});

describe("ENG-1247 — hero title overlay (web)", () => {
  it("renders the overlay only when the flag is ON AND a real photo resolves", () => {
    // Gated on `recipeDetailV3 && heroSrc` — never forced onto the placeholder.
    expect(WEB_SRC).toContain("recipeDetailV3 && heroSrc ?");
    expect(WEB_SRC).toContain('data-testid="recipe-hero-title-overlay"');
  });

  it("overlay carries kicker + serif H1 + clock/flame/serves meta row", () => {
    expect(WEB_SRC).toContain('data-testid="recipe-hero-kicker"');
    expect(WEB_SRC).toContain('data-testid="recipe-hero-overlay-title"');
    // Kicker: "From your cookbook" when saved, else "Fits your day".
    expect(WEB_SRC).toContain('saved ? "From your cookbook" : "Fits your day"');
    // Serif overlay title.
    const overlay = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-hero-title-overlay"'),
      WEB_SRC.indexOf('data-testid="recipe-hero-overlay-title"') + 200,
    );
    expect(overlay).toContain('fontFamily: "var(--font-headline)"');
    // Meta row icons: time + serves (utensils) always, kcal when known.
    expect(WEB_SRC).toContain("Serves {servings}");
  });

  it("hides the duplicate body H1 when the overlay is active", () => {
    expect(WEB_SRC).toContain("heroOverlayActive ? null : (");
    expect(WEB_SRC).toContain("const heroOverlayActive = recipeDetailV3 && heroHasPhoto");
  });
});

describe("ENG-1247 — editorial standfirst (web)", () => {
  it("renders the serif standfirst when the flag is ON, with a graceful fallback", () => {
    expect(WEB_SRC).toContain('data-testid="recipe-standfirst"');
    // Uses the recipe description first.
    const block = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-standfirst"'),
      WEB_SRC.indexOf('data-testid="recipe-standfirst"') + 700,
    );
    expect(block).toContain("sanitizeRecipeDescription(dbDescription)");
    // Protein-anchored fallback sentence (prototype L4353).
    expect(block).toContain("g of protein that sits comfortably");
    // Serif treatment.
    expect(block).toContain('fontFamily: "var(--font-headline)"');
  });
});

describe("ENG-1247 — consolidated sticky CTA bar (web)", () => {
  it("renders a sticky footer when the flag is ON", () => {
    expect(WEB_SRC).toContain('data-testid="recipe-detail-sticky-footer"');
    // Gated on the flag.
    const footerIdx = WEB_SRC.indexOf('data-testid="recipe-detail-sticky-footer"');
    const before = WEB_SRC.slice(footerIdx - 200, footerIdx);
    expect(before).toContain("recipeDetailV3 ?");
  });

  it("bar holds YIELD stepper + Cook Mode (outline) + Log (filled primary)", () => {
    const bar = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-detail-sticky-footer"'),
      WEB_SRC.indexOf('data-testid="recipe-footer-log-cta"') + 400,
    );
    // Yield stepper.
    expect(bar).toContain("Yield");
    expect(bar).toContain('data-testid="recipe-footer-servings-increment"');
    expect(bar).toContain('data-testid="recipe-footer-servings-decrement"');
    // Cook Mode is the OUTLINE secondary (border, transparent ground).
    expect(bar).toContain('data-testid="recipe-cook-mode-cta"');
    expect(bar).toContain("bg-transparent border-[1.5px] border-primary-solid text-primary-solid");
    // Log is the FILLED primary (the single filled slab).
    expect(bar).toContain('data-testid="recipe-footer-log-cta"');
    expect(bar).toContain("bg-primary text-primary-foreground");
  });

  it("the mid-body 'Servings to view' card is hidden when the bar is on (no duplicate stepper)", () => {
    // The stepper card is wrapped in `recipeDetailV3 ? null : (...)`.
    const cardIdx = WEB_SRC.indexOf('data-testid="recipe-view-servings-stepper"');
    const before = WEB_SRC.slice(cardIdx - 400, cardIdx);
    expect(before).toContain("recipeDetailV3 ? null : (");
  });
});

describe("ENG-1247 — web Log gap-fill (REAL journal write, not a fake toast)", () => {
  it("the v3 Log CTA calls the real logRecipeToToday handler, not the 'Marked as made!' toast", () => {
    // The sticky-bar Log fires the real write.
    expect(WEB_SRC).toContain("onClick={() => void logRecipeToToday()}");
    expect(WEB_SRC).toContain("const logRecipeToToday = async ()");
  });

  it("logRecipeToToday routes through the shared coercion guard + real insert", () => {
    const fn = WEB_SRC.slice(
      WEB_SRC.indexOf("const logRecipeToToday = async ()"),
      WEB_SRC.indexOf("const logRecipeToToday = async ()") + 2600,
    );
    // Coercion guard (refuse to log fabricated macros — route to Verify).
    expect(fn).toContain("fetchPlannedMealMicros");
    expect(fn).toContain("macrosAreCoerced");
    // Real journal write with the canonical Recipe source + recipe FK.
    expect(fn).toContain("addLoggedMealForDate");
    expect(fn).toContain('source: "Recipe"');
    expect(fn).toContain("recipeId: recipe.id");
    // Slot resolved from the shared helper (web == mobile).
    expect(fn).toContain("journalSlotFromMealTypes");
  });

  it("the legacy in-row 'Marked as made!' toast stays only in the flag-OFF branch", () => {
    // It must still exist (kill-switch path alive) …
    expect(WEB_SRC).toContain('toast.success("Marked as made!")');
    // … but the flag-ON action row collapses to the owner-only Edit pill.
    expect(WEB_SRC).toContain("recipeDetailV3 ? (");
  });
});

describe("ENG-1247 — borderless macro strip (web)", () => {
  it("uses the v3 borderless rd-macros treatment when the flag is ON", () => {
    const block = WEB_SRC.slice(
      WEB_SRC.indexOf('data-testid="recipe-macros-grid"'),
      WEB_SRC.indexOf('data-testid="recipe-macros-grid"') + 500,
    );
    expect(block).toContain("recipeDetailV3");
    expect(block).toContain("border-y border-border");
    expect(block).toContain("recipeDetailV3 ? undefined : whiteSlabStyle");
  });
});

describe("ENG-1247 — no fakes / honest data", () => {
  it("does not invent a cuisine kicker (no cuisine field exists in the pipeline)", () => {
    // The kicker is the honest saved/Fits-your-day pair — never a fabricated
    // cuisine string.
    expect(WEB_SRC).not.toMatch(/kicker[^]{0,80}cuisine/i);
  });
});
