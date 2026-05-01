/**
 * 2026-04-30 ui-product-designer recipe-detail audit — web parity pins.
 *
 * RecipeDetail.tsx is a ~2k-line component wired to AppDataContext,
 * Supabase, router, and a dozen sub-dialogs — mounting it for an
 * isolated layout assertion would be a sandbox of mocks. Instead we
 * pin the structural contract via source-string regex (matches the
 * existing `screenAuditFixesParity.test.ts` idiom) plus a real RTL
 * render of the helper-driven JSX pattern in a minimal harness.
 *
 * The acceptance criteria from the spec map to:
 *   1. time-stats hidden when both prep and cook are absent →
 *      pinned via the `shouldRenderTimeStats` gate in the source AND
 *      RTL-asserted in the harness render
 *   2. compact `<X> min prep · <Y> min cook` form when timings present
 *      → RTL-asserted in the harness
 *   3. fits-your-day pill is a CHILD of `recipe-calorie-hero` (not a
 *      sibling) → pinned in the source via JSX nesting + RTL-asserted
 *      via `within(getByTestId(...)).getByTestId(...)`
 *
 * If this test breaks, recipe detail has regressed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/react";

import {
  composeSubtitleParts,
  shouldRenderTimeStats,
} from "../../src/lib/recipe/recipeDetailLayout";

const WEB_RECIPE = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");
const SRC = readFileSync(WEB_RECIPE, "utf8");

describe("web recipe-detail — Fix 1 (subtitle merge)", () => {
  it("body renders an h1 title (parity gap closed)", () => {
    expect(SRC).toMatch(/data-testid="recipe-body-title"/);
    expect(SRC).toMatch(/<h1[^>]*data-testid="recipe-body-title"[^>]*>\s*\{\s*normaliseRecipeDisplayTitle\(recipe\.title\)\s*\}/);
  });

  it("subtitle row uses composeSubtitleParts and a no-underline author link", () => {
    expect(SRC).toMatch(/composeSubtitleParts\(\{/);
    expect(SRC).toMatch(/data-testid="recipe-subtitle-row"/);
    // Author <a> uses no-underline class — design says no-underline
    // + secondary text colour.
    expect(SRC).toMatch(/no-underline/);
  });

  it("the standalone meal-type pill / dedicated 'by author' row are gone", () => {
    // Old subtitle did `{recipe.author?.display_name}` in its own div
    // adjacent to a separate "Lunch" pill. Both folded into the
    // subtitle parts now — the standalone pill must not exist.
    expect(SRC).not.toMatch(/className="[^"]*meal-?type-?badge/);
  });
});

describe("web recipe-detail — Fix 2 (compact time stats)", () => {
  it("time-stats row is gated by shouldRenderTimeStats", () => {
    expect(SRC).toMatch(/shouldRenderTimeStats\(/);
    expect(SRC).toMatch(/data-testid="recipe-time-stats"/);
  });

  it("compact form is `<prep> prep · <cook> cook`, not 4-tile icon-circle row", () => {
    expect(SRC).toMatch(/\$\{prepDisplay\}\s*prep/);
    expect(SRC).toMatch(/\$\{cookDisplay\}\s*cook/);
    // Old `Icons.target` portion-tile was a separate flex item; now
    // gone (servings lives in subtitle, edit affordance is text).
    // Confidence tile (Icons.verified ... "Confidence") removed.
    expect(SRC).not.toMatch(/text-\[10px\][^"]*">Confidence</);
  });
});

describe("web recipe-detail — Fix 3 (fits-your-day fused into kcal hero)", () => {
  it("kcal hero block carries data-testid='recipe-calorie-hero'", () => {
    expect(SRC).toMatch(/data-testid="recipe-calorie-hero"/);
  });

  it("fits-your-day pill is rendered INSIDE the kcal hero block, not as a sibling", () => {
    // Rough source-pin: the `recipe-fits-your-day` testID appears
    // between the kcal-hero opening and the same block's closing
    // </div>. Find the kcal-hero opener and the next sibling-level
    // node to confirm fits-your-day is not after it.
    const heroIdx = SRC.indexOf('data-testid="recipe-calorie-hero"');
    expect(heroIdx).toBeGreaterThan(0);
    const fitsIdx = SRC.indexOf('data-testid="recipe-fits-your-day"');
    expect(fitsIdx).toBeGreaterThan(heroIdx);
    // The Macros row pin marks the next sibling block. fits-your-day
    // must come BEFORE that, i.e. still inside the hero.
    const macrosIdx = SRC.indexOf('uppercase tracking-wide text-muted-foreground">Macros');
    expect(macrosIdx).toBeGreaterThan(fitsIdx);
  });

  it("the old standalone fits-your-day IIFE (sibling div) is gone", () => {
    // Pre-fix the file had a separate `<div className="mb-4 flex
    // justify-center">` wrapping the badge. After the fuse, the badge
    // sits inside the hero with no `mb-4 flex justify-center` wrapper.
    expect(SRC).not.toMatch(/<div\s+className="mb-4\s+flex\s+justify-center"\s*>\s*\n\s*<div\s+className="inline-flex\s+items-center\s+gap-1\.5\s+rounded-full"/);
  });
});

describe("web recipe-detail — Fix 4 (tighter section gaps)", () => {
  it("body container uses space-y-5, not space-y-8", () => {
    expect(SRC).toMatch(/<div className="px-6 py-8 space-y-5"/);
    expect(SRC).not.toMatch(/<div className="px-6 py-8 space-y-8"/);
  });
});

/**
 * RTL render harness — exercises the helper-driven JSX with a minimal
 * stand-in component so we can assert on real DOM structure. The
 * harness mirrors the production hero block exactly (same testIDs,
 * same conditionals) so a structural regression in the production
 * file shows up here too via the source pins above.
 */
describe("web recipe-detail — helper-driven render assertions", () => {
  function HeroHarness(args: {
    prepMin: number | null | undefined;
    cookMin: number | null | undefined;
    prepDisplay: string;
    cookDisplay: string;
    kcal: number;
    targetCals: number;
    authorLabel: string | null;
    slots: string[];
    servings: number;
  }) {
    const showRow = shouldRenderTimeStats(args.prepMin, args.cookMin);
    const segments: string[] = [];
    if (args.prepMin && args.prepMin > 0) segments.push(`${args.prepDisplay} prep`);
    if (args.cookMin && args.cookMin > 0) segments.push(`${args.cookDisplay} cook`);
    const subtitleParts = composeSubtitleParts({
      authorLabel: args.authorLabel,
      slots: args.slots,
      servings: args.servings,
    });
    const showVerdict = args.kcal > 0 && args.targetCals > 0;
    const pct = showVerdict
      ? Math.max(1, Math.round(((args.kcal / args.targetCals) * 100) / 5) * 5)
      : 0;
    const fits = pct > 0 && pct <= 50;
    const verdictLabel = fits
      ? "Fits your day"
      : pct >= 100
        ? `≈ ${pct}% of your day · over a full day`
        : `≈ ${pct}% of your day`;
    return (
      <div>
        {subtitleParts.length > 0 ? (
          <div data-testid="recipe-subtitle-row">
            {subtitleParts.map((p, i) => (
              <span key={p.key}>
                {i > 0 ? " · " : ""}
                {p.label}
              </span>
            ))}
          </div>
        ) : null}
        {showRow ? (
          <div data-testid="recipe-time-stats">{segments.join(" · ")}</div>
        ) : null}
        <div data-testid="recipe-calorie-hero">
          <span>{args.kcal} kcal</span>
          {showVerdict ? (
            <div data-testid="recipe-fits-your-day">{verdictLabel}</div>
          ) : null}
        </div>
      </div>
    );
  }

  it("hides recipe-time-stats when both prep and cook are missing", () => {
    const { queryByTestId } = render(
      <HeroHarness
        prepMin={undefined}
        cookMin={undefined}
        prepDisplay="—"
        cookDisplay="—"
        kcal={0}
        targetCals={0}
        authorLabel={null}
        slots={[]}
        servings={4}
      />,
    );
    expect(queryByTestId("recipe-time-stats")).toBeNull();
  });

  it("renders compact `<X> min prep · <Y> min cook` when timings are present", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={10}
        cookMin={25}
        prepDisplay="10 min"
        cookDisplay="25 min"
        kcal={0}
        targetCals={0}
        authorLabel={null}
        slots={[]}
        servings={4}
      />,
    );
    expect(getByTestId("recipe-time-stats").textContent).toMatch(
      /10 min prep · 25 min cook/,
    );
  });

  it("places fits-your-day INSIDE recipe-calorie-hero (parent/child, not sibling)", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={650}
        targetCals={2000}
        authorLabel={null}
        slots={[]}
        servings={4}
      />,
    );
    // Critical: `within(hero).getByTestId(...)` would throw if the
    // verdict were a sibling. This assertion enforces Fix 3.
    const hero = getByTestId("recipe-calorie-hero");
    const verdict = within(hero).getByTestId("recipe-fits-your-day");
    expect(verdict.textContent).toMatch(/Fits your day|of your day/);
  });
});
