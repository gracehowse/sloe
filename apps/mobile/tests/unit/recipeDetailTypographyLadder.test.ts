/**
 * Recipe detail — typography ladder + hero-button material (mobile pins).
 *
 * Authority: ui-critic findings #4 + #8 (2026-04-30).
 * Source: `apps/mobile/app/recipe/[id].tsx`
 *
 * Finding #4: the StyleSheet was littered with 14 inline `fontSize`
 * literals (24/22/16/14/13/12/11/10/9). The canonical
 * `Type.{title,headline,body,caption,label}` ladder defined at
 * `apps/mobile/constants/theme.ts:209-226` was unused. The 2026-05-01
 * cleanup replaced every numeric literal with a `Type.<role>` spread,
 * with two documented exceptions:
 *   - `calorieNumber` (26/800) — F-23 hand-tuned hero numeral.
 *   - `nutritionValue` (28/700) — Discover-style stat tile.
 * Both are explicit numerics and are exempted from the source-grep ban
 * via comment context above each entry.
 *
 * Finding #8: the dead `headerBtn` style described a 38pt circular
 * pill with `shadowOpacity: 0.22` that no JSX consumer rendered (the
 * 2026-04-20 prototype port replaced the floating-over-hero pattern
 * with the sticky `topBar`). Removed entirely so future readers don't
 * mistake the dead style for a live one.
 *
 * Web mirror: `tests/unit/recipeDetailTypographyLadder.test.ts` runs
 * the equivalent grep against `src/app/components/RecipeDetail.tsx`.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../../app/recipe/[id].tsx"),
  "utf-8",
);

/**
 * Strips JSX/TS line comments so the source-grep doesn't false-positive
 * on doc-style mentions of the banned token. Block comments are
 * stripped because the cleanup deliberately documents banned numerics
 * (e.g. "10 → caption (11)") and we don't want those references to
 * trip the pin.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SRC_NO_COMMENTS = stripComments(SRC);

describe("recipe detail typography ladder (mobile) — Type-token spread", () => {
  it("imports Type and FontWeight from the canonical theme module", () => {
    // Pattern is generous — any single-line import from
    // `@/constants/theme` that mentions both Type and FontWeight.
    expect(SRC).toMatch(
      /import\s+\{[^}]*\bType\b[^}]*\bFontWeight\b[^}]*\}\s+from\s+["']@\/constants\/theme["']/,
    );
  });

  it("contains no inline `style={{ fontSize: N` literals in JSX", () => {
    // Inline JSX style objects with a numeric fontSize are the exact
    // anti-pattern flagged by ui-critic finding #4. The cleanup
    // replaced every one with `[Type.<role>, { ... }]`. If a future
    // sweep re-introduces an inline literal, this fires.
    const inlineLiteralPattern = /style=\{\{[^}]*\bfontSize:\s*\d+/g;
    const matches = SRC_NO_COMMENTS.match(inlineLiteralPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("StyleSheet retains only documented hand-tuned numeric fontSize entries", () => {
    // The cleanup spread Type tokens into every StyleSheet entry
    // EXCEPT the two hand-tuned hero numerals (calorieNumber 26/800
    // and nutritionValue 28/700). The pin asserts at most TWO
    // numeric `fontSize: N` lines remain, and that both are the
    // documented exceptions. New literals fail loudly.
    const numericFontSizeLines = SRC_NO_COMMENTS.match(/\bfontSize:\s*\d+\b/g) ?? [];
    expect(numericFontSizeLines.length).toBeLessThanOrEqual(2);

    expect(SRC).toMatch(/calorieNumber:\s*\{\s*fontSize:\s*26/);
    expect(SRC).toMatch(/nutritionValue:\s*\{\s*fontSize:\s*28/);
  });

  it("uses Type.title for the recipe title", () => {
    expect(SRC).toMatch(/title:\s*\{\s*\.\.\.Type\.title/);
  });

  it("uses Type.headline for the cardTitle", () => {
    expect(SRC).toMatch(/cardTitle:\s*\{\s*\.\.\.Type\.headline/);
  });

  it("uses Type.body for descText", () => {
    expect(SRC).toMatch(/descText:\s*\{\s*\.\.\.Type\.body/);
  });
});

describe("recipe detail hero buttons (mobile) — finding #8 dead style removed", () => {
  it("`headerBtn:` style entry is gone (replaced by sticky topBar)", () => {
    // Pre-cleanup: a 38pt `borderRadius: 19` pill with
    // `shadowOpacity: 0.22` lived as a StyleSheet entry but had no
    // JSX consumers. ui-critic flagged the heavy shadow + 2019-iOS
    // circular pill as out of step with the rest of the surface.
    // Cleanup deleted the dead entry.
    expect(SRC).not.toMatch(/^\s*headerBtn:\s*\{/m);
  });

  it("`headerBtnText:` companion style is also gone", () => {
    expect(SRC).not.toMatch(/^\s*headerBtnText:\s*\{/m);
  });

  it("the canonical sticky `topBar` + `topBarIconBtn` styles are present", () => {
    // The cleanup left the prototype-port top bar untouched. If a
    // future sweep reverts to floating pills, both these entries
    // disappear and the failure points to the regression.
    expect(SRC).toMatch(/topBar:\s*\{/);
    expect(SRC).toMatch(/topBarIconBtn:\s*\{/);
  });

  it("does NOT carry the heavy `shadowOpacity: 0.22` literal that flagged the finding", () => {
    // Pin the specific opacity value ui-critic called out. Any
    // other shadow declaration is fine; this exact value (the
    // 2019-iOS hero-pill smell) must stay out of executable code.
    // Run against the comment-stripped source so the cleanup's own
    // documentation of the deleted value doesn't false-positive.
    expect(SRC_NO_COMMENTS).not.toMatch(/shadowOpacity:\s*0\.22/);
  });
});
