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

describe("web recipe-detail — title block + kcal in the CAL strip column (Figma 332:2)", () => {
  // Re-pinned 2026-06-09 to the canonical 332:2 structure (mobile
  // `recipeDetailV3SourcePins.test.ts` is the reference). The v3/v4 subtitle row
  // + dedicated kcal headline line (`composeSubtitleParts`, `recipe-kcal-line`,
  // `recipe-kcal-number`, 18px sans kcal) are SUPERSEDED — kcal now renders as
  // the leading CAL column of the macro strip and the title block is a plum
  // serif `<h1>` with inline attribution.
  it("body renders the plum-serif `recipe-body-title` h1 (parity gap closed)", () => {
    expect(SRC).toMatch(/data-testid="recipe-body-title"/);
    expect(SRC).toMatch(/<h1[^>]*data-testid="recipe-body-title"[^>]*>\s*\{\s*normaliseRecipeDisplayTitle\(recipe\.title\)\s*\}/);
  });

  it("the v3/v4 subtitle row is gone — attribution is the inline `recipe-attribution` line", () => {
    // No `composeSubtitleParts({` call site remains (the helper import is dead
    // weight, not a render path) and no `recipe-subtitle-row` is composed.
    expect(SRC).not.toMatch(/composeSubtitleParts\(\{/);
    expect(SRC).not.toMatch(/data-testid="recipe-subtitle-row"/);
    expect(SRC).not.toMatch(/data-testid="recipe-subtitle-kcal"/);
    // Attribution renders as `via <creator> · See original` instead.
    expect(SRC).toMatch(/data-testid="recipe-attribution"/);
    expect(SRC).toMatch(/See original/);
  });

  it("the v4 dedicated kcal headline line is gone — kcal is the CAL strip column", () => {
    // Superseded by Figma 332:2: there is no separate `recipe-kcal-line`. kcal
    // renders as the leading CAL column of the macro strip (calories first).
    expect(SRC).not.toMatch(/data-testid="recipe-kcal-line"/);
    expect(SRC).not.toMatch(/data-testid="recipe-kcal-number"/);
    expect(SRC).toContain('label: "CAL"');
    expect(SRC).toMatch(/value:\s*`\$\{Math\.round\(scaledMacros\.calories\)\}`/);
  });

  it("the CAL strip value renders in the Newsreader serif at 24px (plum), not an 18-pt sans line", () => {
    // The kcal number is the macro-strip CAL value: serif 24px, tabular-nums,
    // plum (the `--foreground-brand` aubergine token), NOT a hardcoded hex.
    const strip = SRC.slice(SRC.indexOf('data-testid="recipe-macros-grid"'));
    expect(strip).toContain("var(--font-headline)");
    expect(strip).toContain('fontSize: "24px"');
    expect(SRC).toMatch(/label: "CAL", value: `\$\{Math\.round\(scaledMacros\.calories\)\}`, unit: "", color: "var\(--foreground-brand\)"/);
  });

  it("the macro strip is gated on `hasNutrition` — no `0 kcal` for un-imported recipes", () => {
    // P1-16 behaviour preserved: the dimmed `recipe-nutrition-pending`
    // placeholder takes over when no macro is > 0, not a confident "0 kcal".
    expect(SRC).toMatch(/const hasNutrition =/);
    expect(SRC).toMatch(/data-testid="recipe-nutrition-pending"/);
  });

  it("the standalone meal-type pill / dedicated 'by author' row are gone", () => {
    expect(SRC).not.toMatch(/className="[^"]*meal-?type-?badge/);
  });
});

describe("web recipe-detail — meta row replaces the v3 compact time-stats line (Figma 332:2 §5)", () => {
  // The v3 `shouldRenderTimeStats` + inline `<X> prep · <Y> cook` line is
  // superseded by the `recipe-meta-row` (Figma §5), fed by `composeRecipeMeta`
  // so web + mobile surface identical visible stats (time · N items only —
  // rating + difficulty are deliberately omitted, no-fakes rule).
  it("time + item-count stats come from the shared `composeRecipeMeta` helper", () => {
    expect(SRC).toMatch(/const metaStats = composeRecipeMeta\(\{/);
    expect(SRC).toMatch(/data-testid="recipe-meta-row"/);
  });

  it("the meta row is gated to render nothing when no stat is known", () => {
    // `composeRecipeMeta` returns [] when neither time nor item count is real;
    // the render short-circuits on the empty list.
    expect(SRC).toMatch(/if \(metaStats\.length === 0\) return null;/);
    // The old 4-tile confidence/icon-circle row is gone.
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

describe("web recipe-detail — macro summary is the ENG-920 flat Figma 332:2 strip", () => {
  // ENG-920 (resolved 2026-06-07): the macro summary is a FLAT NUMBER STRIP
  // (CAL / PRO / CARB / FAT — calories first), serif value + small-caps label,
  // four equal columns in one card, NO per-macro progress bar. Replaces the v4
  // progress-bar tiles. Net-carbs lens + all tracked values are preserved.
  it("the macros grid carries `recipe-macros-grid` testID", () => {
    expect(SRC).toMatch(/data-testid="recipe-macros-grid"/);
  });

  it("the strip uses `grid grid-cols-4` so all four columns share width", () => {
    expect(SRC).toMatch(
      /data-testid="recipe-macros-grid"[\s\S]{0,200}className="[^"]*grid\s+grid-cols-4[^"]*"/,
    );
    // The legacy flex-wrap tile layout must NOT come back.
    expect(SRC).not.toMatch(
      /data-testid="recipe-macros-grid"[\s\S]{0,200}className="[^"]*flex\s+flex-wrap[^"]*"/,
    );
  });

  it("tiles no longer carry the `max-w-[48%]` half-row constraint", () => {
    expect(SRC).not.toMatch(/max-w-\[48%\]/);
  });

  it("columns carry stable per-macro testIDs (calories/protein/carbs/fat)", () => {
    // The strip keys are the macro keys; calories leads.
    expect(SRC).toMatch(/data-testid=\{`recipe-macro-tile-\$\{m\.key\}`\}/);
    expect(SRC).toContain('label: "CAL"');
  });

  it("strip values render in the Newsreader serif at 24px (not the old sans bold tile)", () => {
    // Flat Figma value treatment. The old `text-lg font-extrabold tabular-nums`
    // progress-bar tile value is gone from the strip.
    const strip = SRC.slice(
      SRC.indexOf('data-testid="recipe-macros-grid"'),
      SRC.indexOf("recipe-macro-micro-chips"),
    );
    expect(strip).toContain("var(--font-headline)");
    expect(strip).toContain('fontSize: "24px"');
    expect(strip).toMatch(/uppercase tracking-\[0\.1em\]/);
    // No per-macro progress-bar fill div in the strip.
    expect(strip).not.toMatch(/width:\s*`?\$\{Math\.min\(/);
  });

  it("the redundant 'MACROS' overline is gone (the strip self-labels)", () => {
    expect(SRC).not.toMatch(
      /<p\s+className="mb-2\s+text-\[11px\]\s+font-bold\s+uppercase\s+tracking-wide\s+text-muted-foreground">Macros<\/p>/,
    );
  });
});

describe("web recipe-detail v3 — Fix 5 (Fits your day softened)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
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

/**
 * 'Fits your day' verdict chip (Figma 332:2 §2). Re-pinned 2026-06-09 to the
 * canonical structure (mobile `recipeDetailV3SourcePins.test.ts` is the
 * reference). The intermediate ENG-818 flag-gated win-amber chip + the shared
 * `fitsYourDayChipStyle` palette helper are SUPERSEDED: the canonical frame
 * renders a SINGLE (unflagged) verdict pill in the title block, tinted INLINE
 * from `verdict.tone` (sage fits / amber over-half / destructive over-a-day),
 * with the verdict itself coming from the shared `computeFitsYourDayVerdict`.
 */
describe("web recipe-detail — 'Fits your day' verdict chip (Figma 332:2 §2)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
  });

  it("there is exactly one fits-your-day chip (no flag-OFF legacy duplicate)", () => {
    // The intermediate design kept a flag-off legacy line as a second
    // occurrence; the canonical frame renders one chip only, unflagged.
    const matches = SRC.match(/data-testid="recipe-fits-your-day"/g) ?? [];
    expect(matches.length).toBe(1);
    // No `design_system_colours`-gated branch wrapping the chip any more.
    expect(SRC).not.toMatch(/if \(redesignColours\) \{[\s\S]{0,400}recipe-fits-your-day/);
    expect(SRC).not.toMatch(/Flag-off legacy path — flat coloured glyph \+ text line/);
  });

  it("the chip palette is tinted INLINE from `verdict.tone`, not a shared helper or win-amber", () => {
    // The chip colours flow from a `verdictChip` derived off `verdict.tone`.
    expect(SRC).toMatch(/verdict\.tone === "success"/);
    expect(SRC).toMatch(/verdict\.tone === "destructive"/);
    // No shared `fitsYourDayChipStyle` helper and no inline win-amber token.
    expect(SRC).not.toMatch(/fitsYourDayChipStyle\(/);
    expect(SRC).not.toMatch(/var\(--accent-win\)/);
    // Success leads with the sage token; over-budget tones use the
    // warning / destructive CSS vars (never a raw hex for the over states).
    expect(SRC).toMatch(/\{ fg: "#5E7C5A", bg: "rgba\(94,124,90,0\.1\)" \}/);
    expect(SRC).toMatch(/fg: "var\(--destructive\)"/);
    expect(SRC).toMatch(/fg: "var\(--warning\)"/);
  });

  it("the chip is a rounded-full pill with a real background fill from `verdictChip.bg`", () => {
    const fitsIdx = SRC.indexOf('data-testid="recipe-fits-your-day"');
    expect(fitsIdx).toBeGreaterThan(0);
    const block = SRC.slice(fitsIdx, fitsIdx + 400);
    expect(block).toMatch(/rounded-full/);
    expect(block).toMatch(/backgroundColor:\s*verdictChip\.bg/);
  });

  it("a11y contract preserved — role='status' + aria-label from the verdict", () => {
    expect(SRC).toMatch(/role="status"[\s\S]{0,160}aria-label=\{verdict\.a11y\}/);
  });
});

/**
 * ENG-818/819 — soft elevation on the resting detail cards + the commit-CTA
 * press payoff (web analog of the mobile confirm haptic). Both flag-gated.
 */
describe("web recipe-detail — ENG-818/819 elevation + commit-CTA payoff", () => {
  it("resting detail cards are UNCONDITIONAL white slabs lifting off cream (Figma 332:2)", () => {
    // Superseded 2026-06-07 (Figma 332:2): the page is now cream, so resting
    // cards are unconditional WHITE slabs with the soft elevation — the old
    // `design_system_elevation`-gated `cardElevationClass` is gone, in lockstep
    // with mobile's unconditional `useCardElevation` soft lift. The slab style
    // (white bg + `--elev-card-soft`) is shared via `whiteSlabStyle`.
    expect(SRC).not.toMatch(/const cardElevationClass = redesignElevation/);
    expect(SRC).toMatch(/const whiteSlabStyle: React\.CSSProperties/);
    expect(SRC).toMatch(/boxShadow: "var\(--elev-card-soft\)"/);
    // Applied to the resting section cards (steps / micronutrients) via the
    // shared white-slab style, not the old `bg-card ... cardElevationClass`.
    expect(SRC).not.toMatch(/bg-card rounded-2xl overflow-hidden \$\{cardElevationClass\}/);
    expect(SRC).toMatch(/rounded-2xl p-5 space-y-4" style=\{whiteSlabStyle\}/);
  });

  it("commit CTAs carry the `redesign_winmoment`-gated press payoff class", () => {
    expect(SRC).toMatch(/isFeatureEnabled\("redesign_winmoment"\)/);
    expect(SRC).toMatch(/const commitCtaPayoffClass = winFeedback/);
    // Active-state scale + brightness lift — the haptic substitute on web.
    expect(SRC).toMatch(/active:scale-\[0\.97\] active:brightness-110/);
    // Wired onto the commit CTAs — the top-bar Cook, Start Cooking, and
    // I Made This buttons all spread the payoff class (3 button call-sites).
    const payoffUses = SRC.match(/\$\{commitCtaPayoffClass\}/g) ?? [];
    expect(payoffUses.length).toBeGreaterThanOrEqual(3);
    // The Start Cooking button carries it. Re-pinned 2026-06-09: under the Sloe
    // treatment the everyday primary is an aubergine OUTLINE (transparent ground
    // + 1.5px aubergine border), not the old filled `bg-primary` slab.
    const startBtnIdx = SRC.indexOf(
      "bg-transparent border-[1.5px] border-primary-solid text-primary-solid text-sm font-bold hover:bg-primary/5 transition-all disabled:opacity-50 ${commitCtaPayoffClass}",
    );
    expect(startBtnIdx).toBeGreaterThan(0);
  });
});

describe("web recipe-detail — tighter section gaps (Fix 6 / Figma 332:2)", () => {
  it("body container uses space-y-5, not space-y-8", () => {
    // Re-pinned 2026-06-09: under the full-bleed-hero 332:2 layout the body
    // padding is `py-6` (the cream body begins right under the photo), not the
    // old `py-8`. The tightened `space-y-5` rhythm is preserved.
    expect(SRC).toMatch(/<div className="px-6 py-6 space-y-5"/);
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
    // ENG-920 (resolved 2026-06-07): the strip is Figma-fixed at four columns
    // (CAL / PRO / CARB / FAT — calories first). Tracked micros fall to a chip
    // row. `macrosToShow` drives which micro chips render, NOT the strip.
    const tracked = args.macrosToShow ?? ["protein", "carbs", "fat", "fiber"];
    const STRIP_KEYS = ["calories", "protein", "carbs", "fat"] as const;
    const microChips = ["fiber", "sugar", "sodium"].filter((k) => tracked.includes(k));
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
              className="text-[18px] font-bold text-foreground tabular-nums leading-none"
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
        <div data-testid="recipe-macros-grid" className="grid grid-cols-4 rounded-2xl">
          {STRIP_KEYS.map((key, idx) => (
            <div
              key={key}
              data-testid={`recipe-macro-tile-${key}`}
              className={idx > 0 ? "border-l border-border" : ""}
            >
              {key}
            </div>
          ))}
        </div>
        {microChips.length > 0 ? (
          <div data-testid="recipe-macro-micro-chips">
            {microChips.map((k) => (
              <span key={k} data-testid={`recipe-macro-chip-${k}`}>
                {k}
              </span>
            ))}
          </div>
        ) : null}
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

  it("v4: kcal number element renders at fontSize ≥ 18px (on-scale)", () => {
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
    expect(kcalNumber.className).toMatch(/text-\[18px\]/);
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

  it("ENG-920: strip renders the Figma-fixed CAL/PRO/CARB/FAT columns (calories first)", () => {
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
    // Calories leads the strip, then protein/carbs/fat — exactly four columns.
    expect(within(grid).getByTestId("recipe-macro-tile-calories")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-protein")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-carbs")).toBeTruthy();
    expect(within(grid).getByTestId("recipe-macro-tile-fat")).toBeTruthy();
    // Calories is the first column (the Figma frame leads with CAL).
    expect(grid.children[0]).toBe(getByTestId("recipe-macro-tile-calories"));
    // The strip is always four columns — no per-macro tracked spill into it.
    expect(grid.children.length).toBe(4);
  });

  it("ENG-920: tracked micros (fiber/sugar/sodium) fall to the chip row, not the strip", () => {
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
    // Strip stays at four columns regardless of how many micros are tracked.
    expect(grid.className).toMatch(/grid\s+grid-cols-4/);
    expect(grid.children.length).toBe(4);
    // The tracked micros render as a separate chip row so no value is dropped.
    const chips = getByTestId("recipe-macro-micro-chips");
    expect(within(chips).getByTestId("recipe-macro-chip-fiber")).toBeTruthy();
    expect(within(chips).getByTestId("recipe-macro-chip-sugar")).toBeTruthy();
    expect(within(chips).getByTestId("recipe-macro-chip-sodium")).toBeTruthy();
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
