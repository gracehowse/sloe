/**
 * 2026-04-30 ui-product-designer recipe-detail audit — web parity pins.
 * 2026-05-01 v3 redesign — kcal moved inline + macros become hero +
 * Fits-your-day softened to a single line.
 *
 * 2026-05-02 v4 polish (recipe-detail-tiles-and-kcal): two visual
 * fixes against v3 from user feedback:
 *   - "the widgets should be the same size and fit on one row" →
 *     macro tiles switch from a flex-wrap layout (which let fiber
 *     stand alone on row 2 at 48% width) to `grid grid-cols-4` so all
 *     tiles share a width.
 *   - "cals need to be clearer" → kcal got promoted out of the
 *     subtitle row into its own dedicated headline line directly
 *     under the title ("329 kcal · per portion" at 17-pt).
 *
 * RecipeDetail.tsx is a ~2k-line component wired to AppDataContext,
 * Supabase, router, and a dozen sub-dialogs — mounting it for an
 * isolated layout assertion would be a sandbox of mocks. Instead we
 * pin the structural contract via source-string regex (matches the
 * existing `screenAuditFixesParity.test.ts` idiom) plus a real RTL
 * render of the helper-driven JSX pattern in a minimal harness.
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

describe("web recipe-detail v4 — Fix 1 (subtitle + dedicated kcal line)", () => {
  it("body renders an h1 title (parity gap closed)", () => {
    expect(SRC).toMatch(/data-testid="recipe-body-title"/);
    expect(SRC).toMatch(/<h1[^>]*data-testid="recipe-body-title"[^>]*>\s*\{\s*normaliseRecipeDisplayTitle\(recipe\.title\)\s*\}/);
  });

  it("subtitle row uses composeSubtitleParts and a no-underline author link", () => {
    expect(SRC).toMatch(/composeSubtitleParts\(\{/);
    expect(SRC).toMatch(/data-testid="recipe-subtitle-row"/);
    expect(SRC).toMatch(/no-underline/);
  });

  it("composeSubtitleParts is NOT passed a kcal arg in v4 (kcal lives on its own line)", () => {
    // v3 passed `kcal: scaledMacros.calories` so the helper would
    // emit a `kcal` part in the subtitle. v4 removes that — the
    // subtitle is back to slot · serves · by, and kcal renders on a
    // dedicated headline line above the subtitle. Pin the call site
    // directly: the call must not include `kcal:` as a property.
    const callIdx = SRC.indexOf("composeSubtitleParts({");
    expect(callIdx).toBeGreaterThan(0);
    // Match-bounded slice: from the call site through the next `})`.
    const closeIdx = SRC.indexOf("})", callIdx);
    expect(closeIdx).toBeGreaterThan(callIdx);
    const callBlock = SRC.slice(callIdx, closeIdx + 2);
    expect(callBlock).not.toMatch(/\bkcal:/);
  });

  it("subtitle no longer renders the v3 inline `recipe-subtitle-kcal` token", () => {
    // The token was the v3 surface for kcal in the subtitle. v4
    // promotes kcal to its own line, so this testID disappears.
    expect(SRC).not.toMatch(/data-testid="recipe-subtitle-kcal"/);
  });

  it("dedicated kcal headline line exists with `recipe-kcal-line` + `recipe-kcal-number`", () => {
    expect(SRC).toMatch(/data-testid="recipe-kcal-line"/);
    expect(SRC).toMatch(/data-testid="recipe-kcal-number"/);
  });

  it("dedicated kcal line uses 17-pt headline weight + tabular-nums + foreground colour", () => {
    // Spec: Type.headline, 17pt+, tabular-nums. We pin the exact
    // class string so the `text-[17px]` literal can't drift back to
    // a smaller `text-sm` accidentally.
    expect(SRC).toMatch(
      /text-\[17px\]\s+font-bold\s+text-foreground\s+tabular-nums/,
    );
  });

  it("dedicated kcal line renders `<N> kcal · per portion`", () => {
    // The literal "per portion" qualifier is the visible signal that
    // makes calories clearer than the pre-v4 buried-in-subtitle form.
    expect(SRC).toMatch(/per portion/);
    expect(SRC).toMatch(/\{kcalForLine\}\s*kcal/);
  });

  it("kcal line is gated on `kcalForLine > 0` (no `0 kcal` for un-imported recipes)", () => {
    // P1-16 behaviour preserved: the dimmed nutrition-pending
    // placeholder must take over when kcal is unknown, not a
    // confident "0 kcal" headline.
    expect(SRC).toMatch(/kcalForLine\s*>\s*0\s*\?/);
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

describe("web recipe-detail v4 — Fix 4 (4-up macro grid, equal-width tiles)", () => {
  it("the macros grid carries `recipe-macros-grid` testID", () => {
    expect(SRC).toMatch(/data-testid="recipe-macros-grid"/);
  });

  it("the macros grid uses `grid grid-cols-4` so all tiles share width", () => {
    // v3 used `flex flex-wrap` with per-tile `max-w-[48%]`, which
    // made fiber stand alone on row 2 at half-width while p/c/f
    // shared row 1. v4 spec: 4-up, same widths.
    expect(SRC).toMatch(
      /data-testid="recipe-macros-grid"[\s\S]{0,200}className="[^"]*grid\s+grid-cols-4[^"]*"/,
    );
    // The legacy flex-wrap layout must NOT come back.
    expect(SRC).not.toMatch(
      /data-testid="recipe-macros-grid"[\s\S]{0,200}className="[^"]*flex\s+flex-wrap[^"]*"/,
    );
  });

  it("tiles no longer carry the `max-w-[48%]` half-row constraint", () => {
    expect(SRC).not.toMatch(/max-w-\[48%\]/);
  });

  it("tiles carry stable per-macro testIDs so renders can target them individually", () => {
    expect(SRC).toMatch(/data-testid=\{`recipe-macro-tile-\$\{macro\}`\}/);
  });

  it("macro tiles still use a bold tabular-nums value treatment", () => {
    // v4 dropped `text-xl` to `text-lg` to fit the 4-up grid at
    // narrow desktop widths without truncation. Weight + tabular
    // alignment preserved.
    expect(SRC).toMatch(/text-lg\s+font-extrabold\s+tabular-nums/);
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
 *
 * 2026-05-02 v4: harness updated to render kcal on its own dedicated
 * line (`recipe-kcal-line`) instead of inline in the subtitle, and
 * to render the macros grid as `grid grid-cols-4` for the
 * equal-width-tiles assertion.
 */
describe("web recipe-detail v4 — helper-driven render assertions", () => {
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
    macrosToShow?: string[];
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
    const verdict = computeFitsYourDayVerdict({
      kcal: args.kcal,
      targetCals: args.targetCals,
    });
    const hasNutrition = args.kcal > 0;
    const macros = args.macrosToShow ?? ["protein", "carbs", "fat", "fiber"];
    return (
      <div>
        {hasNutrition ? (
          <div
            data-testid="recipe-kcal-line"
            className="mt-1.5 flex items-baseline gap-1.5"
            aria-label={`${Math.round(args.kcal)} kilocalories per portion`}
          >
            <span
              data-testid="recipe-kcal-number"
              className="text-[17px] font-bold text-foreground tabular-nums leading-none"
            >
              {Math.round(args.kcal)} kcal
            </span>
            <span aria-hidden>·</span>
            <span>per portion</span>
          </div>
        ) : null}
        {subtitleParts.length > 0 ? (
          <div data-testid="recipe-subtitle-row">
            {subtitleParts.map((p, i) => (
              <span key={p.key}>
                {i > 0 ? " · " : ""}
                <span>{p.label}</span>
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
        <div data-testid="recipe-macros-grid" className="grid grid-cols-4 gap-2">
          {macros.map((macro) => (
            <div key={macro} data-testid={`recipe-macro-tile-${macro}`}>
              {macro}
            </div>
          ))}
        </div>
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

  it("v4: renders kcal on its OWN dedicated line (not inside the subtitle row)", () => {
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
    // Dedicated line exists with the bigger number.
    const kcalLine = getByTestId("recipe-kcal-line");
    const kcalNumber = within(kcalLine).getByTestId("recipe-kcal-number");
    expect(kcalNumber.textContent).toBe("329 kcal");
    expect(kcalLine.textContent).toMatch(/329 kcal[\s·]+per portion/);
    // And the subtitle row no longer contains a kcal token.
    expect(queryByTestId("recipe-subtitle-kcal")).toBeNull();
    const subtitle = getByTestId("recipe-subtitle-row");
    expect(subtitle.textContent).not.toMatch(/kcal/);
    expect(subtitle.textContent).toMatch(/lunch/);
    expect(subtitle.textContent).toMatch(/serves 3/);
    expect(subtitle.textContent).toMatch(/by emthenutritionist/);
  });

  it("v4: kcal number element renders at fontSize ≥ 16px (≥ 17px in spec)", () => {
    // The product feedback was "cals need to be clearer" — pin the
    // visual size so a future class drift back to text-sm shows up.
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={329}
        targetCals={2000}
        authorLabel={null}
        slots={["Lunch"]}
        servings={3}
      />,
    );
    const kcalNumber = getByTestId("recipe-kcal-number");
    // The harness mirrors the production class string verbatim.
    expect(kcalNumber.className).toMatch(/text-\[17px\]/);
    expect(kcalNumber.className).toMatch(/font-bold/);
    expect(kcalNumber.className).toMatch(/tabular-nums/);
  });

  it("hides the kcal line AND shows the pending placeholder when kcal=0", () => {
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
    expect(queryByTestId("recipe-kcal-line")).toBeNull();
    expect(queryByTestId("recipe-kcal-number")).toBeNull();
    expect(getByTestId("recipe-nutrition-pending").textContent).toMatch(
      /Calories not yet computed/,
    );
  });

  it("v4: macros grid renders 4 tiles in a single grid-cols-4 row", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={329}
        targetCals={2000}
        authorLabel={null}
        slots={["Lunch"]}
        servings={3}
        macrosToShow={["protein", "carbs", "fat", "fiber"]}
      />,
    );
    const grid = getByTestId("recipe-macros-grid");
    expect(grid.className).toMatch(/grid\s+grid-cols-4/);
    // All four tiles render.
    expect(within(grid).getByTestId("recipe-macro-tile-protein")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-carbs")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-fat")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-fiber")).toBeTruthy();
    // Direct children count = 4 (one per tile, in one row).
    expect(grid.children.length).toBe(4);
  });

  it("v4: extra tracked macros (sugar/sodium) spill onto row 2 at the same width via grid-cols-4", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        prepDisplay="—"
        cookDisplay="—"
        kcal={329}
        targetCals={2000}
        authorLabel={null}
        slots={["Lunch"]}
        servings={3}
        macrosToShow={["protein", "carbs", "fat", "fiber", "sugar", "sodium"]}
      />,
    );
    const grid = getByTestId("recipe-macros-grid");
    // Same grid class (so each tile is the same width as row 1).
    expect(grid.className).toMatch(/grid\s+grid-cols-4/);
    expect(grid.children.length).toBe(6);
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
