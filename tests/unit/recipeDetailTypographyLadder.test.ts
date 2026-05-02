/**
 * Recipe detail — typography ladder + hero buttons (web parity pins).
 *
 * Authority: ui-critic findings #4 + #8 (2026-04-30).
 * Source: `src/app/components/RecipeDetail.tsx`.
 *
 * The mobile mirror at
 * `apps/mobile/tests/unit/recipeDetailTypographyLadder.test.ts` pins
 * the `Type.<role>` spread on the StyleSheet side. Web's equivalent is
 * Tailwind's `text-{xs,sm,base,lg,xl,2xl}` utility scale (see
 * `src/styles/theme.css` for the canonical CSS-variable mapping). The
 * 2026-05-01 cleanup replaced the two inline `style={{ fontSize: 12 }}`
 * literals on the "Fits your day" badge with `className="text-xs"`.
 *
 * Web's hero-button material (finding #8 on mobile) is implicit on
 * web — the recipe header is a sticky `backdrop-blur-xl bg-card/80`
 * top bar above the hero (no floating circular pills); the hero
 * already carries a `bg-gradient-to-t from-black/40` scrim. This file
 * pins both invariants so a future sweep can't quietly regress
 * either surface back to the 2019-iOS pill pattern.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "..", "..", "src/app/components/RecipeDetail.tsx"),
  "utf8",
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SRC_NO_COMMENTS = stripComments(SRC);

describe("RecipeDetail typography ladder (web) — Tailwind text-* utilities", () => {
  it("contains no inline `style={{ fontSize: N }}` literals", () => {
    // Pre-cleanup: the "Fits your day" badge had two inline
    // `style={{ fontSize: 12 }}` literals — the only `fontSize` in
    // the file. The cleanup swapped them for `text-xs` so Tailwind's
    // ladder is the single source of truth on web.
    const inlineLiteralPattern = /style=\{\{[^}]*\bfontSize:\s*\d+/g;
    const matches = SRC_NO_COMMENTS.match(inlineLiteralPattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("contains no kebab-case `font-size:` literals either", () => {
    // Defensive: a future Tailwind v4 inline-style migration shouldn't
    // re-introduce the same anti-pattern via the CSS spelling.
    expect(SRC_NO_COMMENTS).not.toMatch(/style=\{\{[^}]*font-size:/);
  });

  it("the Fits-your-day badge uses the `text-xs` utility (was inline fontSize: 12)", () => {
    expect(SRC).toMatch(/className="text-xs font-bold">\{label\}/);
  });
});

describe("RecipeDetail hero (web) — finding #8 parity", () => {
  it("renders a sticky top bar with `backdrop-blur-xl` (NOT floating circular pills)", () => {
    // Mobile finding #8 called out 2019-iOS hero pills. Web's
    // equivalent is the sticky `backdrop-blur-xl bg-card/80` top bar
    // that lives ABOVE the hero (line ~983 pre-cleanup). If a future
    // sweep moves the buttons back into the hero as floating circles,
    // this pin disappears.
    expect(SRC).toMatch(/sticky\s+top-0\s+backdrop-blur-xl/);
  });

  it("the hero image carries a top-edge scrim gradient for icon legibility", () => {
    // Already present pre-cleanup; pinned so no future touch removes
    // it. Without the scrim, monochrome icons can't read on bright
    // photos — the same legibility concern that drove finding #8 on
    // mobile.
    expect(SRC).toMatch(/bg-gradient-to-t\s+from-black\/40/);
  });
});
