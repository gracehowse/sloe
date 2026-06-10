/**
 * Web recipe-detail layout pins. History:
 *   - 2026-04-30 ui-product-designer audit — first web parity pins.
 *   - 2026-05-01 v3 — kcal inline + macros hero + softened Fits-your-day.
 *   - 2026-05-02 v4 — kcal promoted to its own headline line, 4-up tiles.
 *   - 2026-06-09 Figma 332:2 (the SHIPPED aubergine redesign) — the screen is
 *     a cream editorial page: serif plum `recipe-body-title` <h1>, the v3/v4
 *     subtitle row + dedicated kcal headline line are REMOVED, kcal renders as
 *     the leading CAL column of the flat `recipe-macros-grid` strip (serif
 *     24px, calories first), tracked micros fall to a chip row, and a single
 *     tone-tinted `recipe-fits-your-day` chip lives in the title block. The
 *     canonical reference is mobile `recipeDetailV3SourcePins.test.ts`.
 *
 * RecipeDetail.tsx is a ~2k-line component wired to AppDataContext, Supabase,
 * router, and a dozen sub-dialogs — mounting it for an isolated layout
 * assertion would be a sandbox of mocks. Instead we pin the structural
 * contract via source-string regex (matches the existing
 * `screenAuditFixesParity.test.ts` idiom) plus a real RTL render of the
 * helper-driven JSX pattern in a minimal harness that mirrors the 332:2 hero.
 *
 * If this test breaks, recipe detail has regressed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/react";

import {
  composeRecipeMeta,
  computeFitsYourDayVerdict,
} from "../../src/lib/recipe/recipeDetailLayout";
import { normaliseRecipeDisplayTitle } from "../../src/lib/recipe/normaliseDisplayTitle";

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
 * stand-in component so we can assert on real DOM structure. The harness
 * mirrors the production hero block exactly (same testIDs, same
 * conditionals) so a structural regression in the production file shows up
 * here too alongside the source pins above.
 *
 * Re-pinned 2026-06-09 to the canonical Figma 332:2 structure (mobile
 * `recipeDetailV3SourcePins.test.ts` is the reference). The v4 fiction this
 * harness used to render — a dedicated `recipe-kcal-line`/`recipe-kcal-number`
 * headline, a `recipe-subtitle-row`/`recipe-subtitle-kcal` subtitle, and a
 * `recipe-time-stats` prep·cook line — is SUPERSEDED and never appeared in the
 * real source again, so asserting on it protected nothing. The 332:2 hero is:
 *   - plum-serif `recipe-body-title` <h1> (no subtitle row)
 *   - `recipe-attribution` line (gated on a real byline)
 *   - a single `recipe-fits-your-day` verdict chip, tinted from `verdict.tone`
 *   - kcal as the leading CAL column of the four-fixed `recipe-macros-grid`
 *     strip (CAL / PRO / CARB / FAT, calories first)
 *   - tracked micros in a `recipe-macro-micro-chips` overflow row
 *   - `recipe-meta-row` (time · N items) from the shared `composeRecipeMeta`
 */
describe("web recipe-detail — Figma 332:2 helper-driven render assertions", () => {
  const STRIP_KEYS = ["calories", "protein", "carbs", "fat"] as const;

  function HeroHarness(args: {
    prepMin: number | null | undefined;
    cookMin: number | null | undefined;
    ingredientCount: number;
    kcal: number;
    targetCals: number;
    bylineLabel: string | null;
    sourceUrl?: string | null;
    title?: string;
    macrosToShow?: string[];
  }) {
    const verdict = computeFitsYourDayVerdict({
      kcal: args.kcal,
      targetCals: args.targetCals,
    });
    // Inline tone-tint, mirroring the production `verdictChip` derivation.
    const verdictChip = verdict
      ? verdict.tone === "success"
        ? { fg: "#5E7C5A", bg: "rgba(94,124,90,0.1)" }
        : verdict.tone === "destructive"
          ? { fg: "var(--destructive)", bg: "color-mix(in srgb, var(--destructive) 12%, transparent)" }
          : { fg: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)" }
      : null;
    const originalHref =
      typeof args.sourceUrl === "string" && args.sourceUrl.trim()
        ? args.sourceUrl.trim()
        : null;
    const hasNutrition = args.kcal > 0;
    // ENG-920 (resolved 2026-06-07): the strip is Figma-fixed at four columns
    // (CAL / PRO / CARB / FAT — calories first). Tracked micros fall to a chip
    // row. `macrosToShow` drives which micro chips render, NOT the strip.
    const tracked = args.macrosToShow ?? ["protein", "carbs", "fat", "fiber"];
    const microChips = ["fiber", "sugar", "sodium"].filter((k) => tracked.includes(k));
    const metaStats = composeRecipeMeta({
      prepMin: args.prepMin,
      cookMin: args.cookMin,
      ingredientCount: args.ingredientCount,
    });
    return (
      <div>
        <div className="space-y-3" data-testid="recipe-title-block">
          <h1
            className="text-foreground-brand leading-tight"
            style={{ fontFamily: "var(--font-headline)", fontSize: "34px", fontWeight: 400 }}
            data-testid="recipe-body-title"
          >
            {normaliseRecipeDisplayTitle(args.title ?? "Lemon Orzo Salad")}
          </h1>
          {args.bylineLabel ? (
            <p className="text-sm text-muted-foreground" data-testid="recipe-attribution">
              via <span className="font-medium text-foreground">{args.bylineLabel}</span>
              {originalHref ? (
                <>
                  {"  ·  "}
                  <a href={originalHref} target="_blank" rel="noopener noreferrer">
                    See original
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {verdict && verdictChip ? (
            <div
              data-testid="recipe-fits-your-day"
              role="status"
              aria-label={verdict.a11y}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-xs font-bold"
              style={{ color: verdictChip.fg, backgroundColor: verdictChip.bg }}
            >
              <span>{verdict.label}</span>
            </div>
          ) : null}
        </div>
        {!hasNutrition ? (
          <div data-testid="recipe-nutrition-pending">
            Calories not yet computed — open the Ingredients tab to verify
          </div>
        ) : null}
        <div
          data-testid="recipe-macros-grid"
          role="list"
          aria-label="Nutrition per serving"
          className="grid grid-cols-4 rounded-2xl"
        >
          {STRIP_KEYS.map((key, idx) => (
            <div
              key={key}
              role="listitem"
              data-testid={`recipe-macro-tile-${key}`}
              className={`flex flex-col items-center justify-center py-5 ${
                idx > 0 ? "border-l border-border" : ""
              }`}
            >
              {key === "calories" ? Math.round(args.kcal) : key}
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
        {metaStats.length > 0 ? (
          <div data-testid="recipe-meta-row" aria-label={metaStats.map((s) => s.label).join(", ")}>
            {metaStats.map((stat, idx) => (
              <span key={stat.key}>
                {idx > 0 ? " · " : ""}
                {stat.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  it("renders the plum-serif title <h1> via `normaliseRecipeDisplayTitle`", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={undefined}
        cookMin={undefined}
        ingredientCount={0}
        kcal={0}
        targetCals={0}
        bylineLabel={null}
      />,
    );
    const title = getByTestId("recipe-body-title");
    expect(title.tagName).toBe("H1");
    expect(title.style.fontFamily).toBe("var(--font-headline)");
    expect(title.style.fontSize).toBe("34px");
  });

  it("hides the meta row when neither timing nor item count is known", () => {
    const { queryByTestId } = render(
      <HeroHarness
        prepMin={undefined}
        cookMin={undefined}
        ingredientCount={0}
        kcal={0}
        targetCals={0}
        bylineLabel={null}
      />,
    );
    expect(queryByTestId("recipe-meta-row")).toBeNull();
  });

  it("renders the meta row as `<total> min · N items` from `composeRecipeMeta`", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={10}
        cookMin={25}
        ingredientCount={8}
        kcal={0}
        targetCals={0}
        bylineLabel={null}
      />,
    );
    // composeRecipeMeta sums prep+cook → "35 min" and renders the item count.
    expect(getByTestId("recipe-meta-row").textContent).toMatch(/35 min · 8 items/);
  });

  it("renders the attribution line only when a real byline exists", () => {
    const { queryByTestId, rerender } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={329}
        targetCals={2000}
        bylineLabel={null}
      />,
    );
    expect(queryByTestId("recipe-attribution")).toBeNull();
    rerender(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={329}
        targetCals={2000}
        bylineLabel="emthenutritionist"
        sourceUrl="https://example.com/recipe"
      />,
    );
    const attribution = queryByTestId("recipe-attribution");
    expect(attribution).not.toBeNull();
    expect(attribution!.textContent).toMatch(/via emthenutritionist/);
    // "See original" surfaces only when a source URL is present.
    expect(attribution!.textContent).toMatch(/See original/);
  });

  it("kcal renders as the leading CAL column of the strip — no separate kcal headline", () => {
    const { getByTestId, queryByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={329}
        targetCals={2000}
        bylineLabel="emthenutritionist"
      />,
    );
    // The superseded v4 dedicated kcal line / subtitle row never render.
    expect(queryByTestId("recipe-kcal-line")).toBeNull();
    expect(queryByTestId("recipe-kcal-number")).toBeNull();
    expect(queryByTestId("recipe-subtitle-row")).toBeNull();
    expect(queryByTestId("recipe-subtitle-kcal")).toBeNull();
    // kcal is the value of the calories (CAL) column instead.
    const calColumn = getByTestId("recipe-macro-tile-calories");
    expect(calColumn.textContent).toBe("329");
  });

  it("shows the pending placeholder (not a confident 0 kcal) when kcal=0", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={0}
        targetCals={2000}
        bylineLabel="emthenutritionist"
      />,
    );
    expect(getByTestId("recipe-nutrition-pending").textContent).toMatch(
      /Calories not yet computed/,
    );
    // The CAL column reflects the un-imported 0 only inside the strip — the
    // pending placeholder is what tells the user it's not yet computed.
    expect(getByTestId("recipe-macro-tile-calories").textContent).toBe("0");
  });

  it("ENG-920: strip renders the Figma-fixed CAL/PRO/CARB/FAT columns (calories first)", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={329}
        targetCals={2000}
        bylineLabel={null}
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
        ingredientCount={5}
        kcal={329}
        targetCals={2000}
        bylineLabel={null}
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

  it("the single Fits-your-day chip is a title-block sibling of the macros grid (no kcal hero)", () => {
    const { getByTestId, queryByTestId, queryAllByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={650}
        targetCals={2000}
        bylineLabel={null}
      />,
    );
    // No more kcal hero.
    expect(queryByTestId("recipe-calorie-hero")).toBeNull();
    // Exactly one verdict chip (no flag-off legacy duplicate).
    expect(queryAllByTestId("recipe-fits-your-day").length).toBe(1);
    // 650/2000 = 32.5% → rounds to 30% → "Fits your day".
    const verdict = getByTestId("recipe-fits-your-day");
    expect(verdict.textContent).toMatch(/Fits your day/);
    expect(verdict.getAttribute("role")).toBe("status");
    // And it sits OUTSIDE the macros-grid testID region.
    const grid = getByTestId("recipe-macros-grid");
    expect(grid.contains(verdict)).toBe(false);
  });

  it("the over-a-day verdict chip uses the destructive tone (red), never sage/clay", () => {
    const { getByTestId } = render(
      <HeroHarness
        prepMin={null}
        cookMin={null}
        ingredientCount={5}
        kcal={2400}
        targetCals={2000}
        bylineLabel={null}
      />,
    );
    // 2400/2000 = 120% → destructive tone → the --destructive token, not a hex.
    const verdict = getByTestId("recipe-fits-your-day");
    expect(verdict.style.color).toBe("var(--destructive)");
  });
});
