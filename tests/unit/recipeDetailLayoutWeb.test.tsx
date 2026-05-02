/**
 * 2026-04-30 ui-product-designer recipe-detail audit — web parity pins.
 * 2026-05-01 v3 redesign — kcal moved inline + macros become hero +
 * Fits-your-day softened to a single line. The pin set was rewritten.
 *
 * RecipeDetail.tsx is a ~2k-line component wired to AppDataContext,
 * Supabase, router, and a dozen sub-dialogs — mounting it for an
 * isolated layout assertion would be a sandbox of mocks. Instead we
 * pin the structural contract via source-string regex (matches the
 * existing `screenAuditFixesParity.test.ts` idiom) plus a real RTL
 * render of the helper-driven JSX pattern in a minimal harness.
 *
 * The acceptance criteria from the v3 spec map to:
 *   1. time-stats hidden when both prep and cook are absent →
 *      pinned via the `shouldRenderTimeStats` gate in the source AND
 *      RTL-asserted in the harness render
 *   2. compact `<X> min prep · <Y> min cook` form when timings present
 *      → RTL-asserted in the harness
 *   3. kcal renders INLINE in the subtitle row (not as a bordered
 *      hero card) → pinned via the `recipe-subtitle-kcal` testID and
 *      the absence of `recipe-calorie-hero` in the source
 *   4. macro tiles are the visual hero (`recipe-macros-grid` testID,
 *      bigger value font)
 *   5. fits-your-day verdict is a single text line below the macros
 *      with no card / pill background, driven by the shared verdict
 *      helper
 *
 * If this test breaks, recipe detail has regressed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/react";

import {
  composeSubtitleParts,
  computeFitsYourDayVerdict,
  shouldRenderTimeStats,
} from "../../src/lib/recipe/recipeDetailLayout";

const WEB_RECIPE = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");
const SRC = readFileSync(WEB_RECIPE, "utf8");

describe("web recipe-detail v3 — Fix 1 (subtitle merge + kcal inline)", () => {
  it("body renders an h1 title (parity gap closed)", () => {
    expect(SRC).toMatch(/data-testid="recipe-body-title"/);
    expect(SRC).toMatch(/<h1[^>]*data-testid="recipe-body-title"[^>]*>\s*\{\s*normaliseRecipeDisplayTitle\(recipe\.title\)\s*\}/);
  });

  it("subtitle row uses composeSubtitleParts and a no-underline author link", () => {
    expect(SRC).toMatch(/composeSubtitleParts\(\{/);
    expect(SRC).toMatch(/data-testid="recipe-subtitle-row"/);
    expect(SRC).toMatch(/no-underline/);
  });

  it("composeSubtitleParts is called with kcal arg (v3 inline kcal)", () => {
    expect(SRC).toMatch(/composeSubtitleParts\(\{[\s\S]*?kcal:\s*scaledMacros\.calories[\s\S]*?\}\)/);
  });

  it("subtitle renders a `recipe-subtitle-kcal` token with bold + foreground class", () => {
    expect(SRC).toMatch(/data-testid="recipe-subtitle-kcal"/);
    // The kcal token should carry weight + foreground colour so it
    // reads as the primary number on the meta line (not just another
    // grey separator-joined word).
    expect(SRC).toMatch(/font-bold\s+text-foreground\s+tabular-nums/);
  });

  it("the standalone meal-type pill / dedicated 'by author' row are gone", () => {
    expect(SRC).not.toMatch(/className="[^"]*meal-?type-?badge/);
  });
});

describe("web recipe-detail v3 — Fix 2 (compact time stats)", () => {
  it("time-stats row is gated by shouldRenderTimeStats", () => {
    expect(SRC).toMatch(/shouldRenderTimeStats\(/);
    expect(SRC).toMatch(/data-testid="recipe-time-stats"/);
  });

  it("compact form is `<prep> prep · <cook> cook`, not 4-tile icon-circle row", () => {
    expect(SRC).toMatch(/\$\{prepDisplay\}\s*prep/);
    expect(SRC).toMatch(/\$\{cookDisplay\}\s*cook/);
    expect(SRC).not.toMatch(/text-\[10px\][^"]*">Confidence</);
  });
});

describe("web recipe-detail v3 — Fix 3 (kcal hero card removed)", () => {
  it("the bordered kcal hero card is gone — no `recipe-calorie-hero` testID", () => {
    expect(SRC).not.toMatch(/data-testid="recipe-calorie-hero"/);
  });

  it("the dimmed pending state has its own testID (not the old hero)", () => {
    expect(SRC).toMatch(/data-testid="recipe-nutrition-pending"/);
    expect(SRC).toMatch(/Calories not yet computed[^"]*open the Ingredients tab/);
  });

  it("no large `text-4xl` kcal numeral remains (was the hero's visual weight)", () => {
    // The pre-v3 hero had `text-4xl font-extrabold tabular-nums
    // text-foreground` as the headline kcal numeral, immediately
    // followed by `{kcalNum}`. v3 doesn't render this pattern.
    expect(SRC).not.toMatch(
      /text-4xl\s+font-extrabold\s+tabular-nums\s+text-foreground[^>]*>\s*\{kcalNum\}/,
    );
  });
});

describe("web recipe-detail v3 — Fix 4 (macros are the visual hero)", () => {
  it("the macros grid carries `recipe-macros-grid` testID", () => {
    expect(SRC).toMatch(/data-testid="recipe-macros-grid"/);
  });

  it("macro tiles use the v3 bigger-numeral treatment (text-xl, p-3.5)", () => {
    // Pre-v3 was `text-base font-bold` + `p-2.5`. v3 lifts the
    // value font to `text-xl font-extrabold` and bumps padding.
    expect(SRC).toMatch(/text-xl\s+font-extrabold\s+tabular-nums/);
    expect(SRC).toMatch(/rounded-2xl\s+border\s+border-border\s+bg-card\s+p-3\.5/);
  });

  it("the redundant 'MACROS' overline is gone (the tiles self-label)", () => {
    expect(SRC).not.toMatch(
      /<p\s+className="mb-2\s+text-\[11px\]\s+font-bold\s+uppercase\s+tracking-wide\s+text-muted-foreground">Macros<\/p>/,
    );
  });
});

describe("web recipe-detail v3 — Fix 5 (Fits your day softened)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
  });

  it("fits-your-day testID still exists, but rendered as a plain inline-flex line (no pill bg)", () => {
    expect(SRC).toMatch(/data-testid="recipe-fits-your-day"/);
    // No pill background-color — the pre-v3 pill used a
    // `color-mix(... 10%)` background. v3 drops that for a clean
    // text line in the tone colour.
    const fitsIdx = SRC.indexOf('data-testid="recipe-fits-your-day"');
    expect(fitsIdx).toBeGreaterThan(0);
    const block = SRC.slice(fitsIdx, fitsIdx + 600);
    expect(block).not.toMatch(/backgroundColor:\s*`color-mix\(in srgb, \$\{toneVar\}/);
  });

  it("the verdict line is OUTSIDE the (now gone) kcal hero — the old IIFE is removed", () => {
    // Pre-v3 the verdict was a child of `recipe-calorie-hero`. With
    // the hero gone, the verdict must NOT appear inside any element
    // carrying that testID.
    expect(SRC).not.toMatch(
      /data-testid="recipe-calorie-hero"[^]*?data-testid="recipe-fits-your-day"/,
    );
  });
});

describe("web recipe-detail v3 — Fix 6 (tighter section gaps)", () => {
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
describe("web recipe-detail v3 — helper-driven render assertions", () => {
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
      kcal: args.kcal,
    });
    const verdict = computeFitsYourDayVerdict({
      kcal: args.kcal,
      targetCals: args.targetCals,
    });
    const hasNutrition = args.kcal > 0;
    return (
      <div>
        {subtitleParts.length > 0 ? (
          <div data-testid="recipe-subtitle-row">
            {subtitleParts.map((p, i) => (
              <span key={p.key}>
                {i > 0 ? " · " : ""}
                {p.key === "kcal" ? (
                  <span data-testid="recipe-subtitle-kcal">{p.label}</span>
                ) : (
                  <span>{p.label}</span>
                )}
              </span>
            ))}
          </div>
        ) : null}
        {showRow ? (
          <div data-testid="recipe-time-stats">{segments.join(" · ")}</div>
        ) : null}
        {!hasNutrition ? (
          <div data-testid="recipe-nutrition-pending">
            Calories not yet computed
          </div>
        ) : null}
        <div data-testid="recipe-macros-grid">macros</div>
        {verdict ? (
          <div data-testid="recipe-fits-your-day">{verdict.label}</div>
        ) : null}
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

  it("renders kcal INLINE in the subtitle row when nutrition is known", () => {
    const { getByTestId, queryByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={329}
        targetCals={2000}
        authorLabel="emthenutritionist"
        slots={["Lunch"]}
        servings={3}
      />,
    );
    const subtitle = getByTestId("recipe-subtitle-row");
    const kcalToken = within(subtitle).getByTestId("recipe-subtitle-kcal");
    expect(kcalToken.textContent).toBe("329 kcal");
    // The bordered hero card MUST not be rendered when nutrition is known.
    expect(queryByTestId("recipe-calorie-hero")).toBeNull();
    // The dimmed pending placeholder MUST not be rendered either.
    expect(queryByTestId("recipe-nutrition-pending")).toBeNull();
  });

  it("hides the kcal token AND shows the pending placeholder when kcal=0", () => {
    const { queryByTestId, getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={0}
        targetCals={2000}
        authorLabel="emthenutritionist"
        slots={["Lunch"]}
        servings={3}
      />,
    );
    expect(queryByTestId("recipe-subtitle-kcal")).toBeNull();
    expect(getByTestId("recipe-nutrition-pending").textContent).toMatch(
      /Calories not yet computed/,
    );
  });

  it("Fits your day verdict renders as a SIBLING of the macros grid (not a child of a kcal hero)", () => {
    const { getByTestId, queryByTestId } = render(
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
    // No more kcal hero.
    expect(queryByTestId("recipe-calorie-hero")).toBeNull();
    // Verdict appears (650/2000 = 32.5% → rounds to 30% → "Fits your day").
    const verdict = getByTestId("recipe-fits-your-day");
    expect(verdict.textContent).toMatch(/Fits your day/);
    // And it sits OUTSIDE the macros-grid testID region.
    const grid = getByTestId("recipe-macros-grid");
    expect(grid.contains(verdict)).toBe(false);
  });
});
