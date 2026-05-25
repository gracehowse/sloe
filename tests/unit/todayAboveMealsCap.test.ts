/**
 * Today above-meals cap — contract pins (web).
 *
 * Authority: `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5 #2.
 * Source: `src/app/components/NutritionTracker.tsx`
 *
 * Mirrors the mobile pin at
 * `apps/mobile/tests/unit/todayAboveMealsCap.test.ts`. The pre-
 * Phase-4 web tracker had the same shape of drift as mobile: the
 * eat-again banner, fasting pill, AI-sentinel pill, NorthStarBlockHost,
 * and the all-nutrients grid all stacked unconditionally above the
 * meals section. Phase 4 / Top-5 #2 (2026-04-28) capped the
 * composition at four blocks (date header / hero / one mutually-
 * exclusive context block / macro tiles), folded the AI-sentinel
 * into TodayHeroStats, and embedded the nutrient rows inside
 * TodayDashboardMacroTiles.
 *
 * Web has no `TodayDeficitInsight` (removed 2026-04-18, Pass 7) so
 * the context-block dispatch is three-way (fasting > eat-again >
 * north-star) instead of four. Otherwise the pins match mobile.
 *
 * Mobile mirror: `apps/mobile/tests/unit/todayAboveMealsCap.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const HOST_SRC = readFileSync(
  resolve(REPO, "src/app/components/NutritionTracker.tsx"),
  "utf-8",
);

function countMatches(src: string, pattern: RegExp): number {
  const m = src.match(pattern);
  return m ? m.length : 0;
}

describe("Today above-meals cap (web) — context block dispatch", () => {
  // Pattern note: `[\s/]` after the component name only matches real
  // JSX renders (`<Foo `, `<Foo\n`, `<Foo/>`). It excludes JSX-style
  // doc-comment references like `\`<Foo>\`` which would otherwise
  // false-positive a `\b` boundary.

  it("TodayFastingPill renders at most once (active fast only; idle Start fast demoted 2026-05-19)", () => {
    expect(countMatches(HOST_SRC, /<TodayFastingPill[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("TodayEatAgainBanner renders at most once (in the unified dispatch)", () => {
    expect(countMatches(HOST_SRC, /<TodayEatAgainBanner[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("NorthStarBlockHost renders at most once in the context dispatch (below-meals copy is separate)", () => {
    expect(countMatches(HOST_SRC, /<NorthStarBlockHost[\s/]/g)).toBeLessThanOrEqual(1);
  });
});

function macroGridToMealsSlice(src: string): string {
  const mealsIdx = src.indexOf("<TodayMealsSection");
  const tilesIdx = src.lastIndexOf("<TodayDashboardMacroTiles", mealsIdx);
  const barsIdx = src.lastIndexOf("<TodayDashboardMacroBars", mealsIdx);
  const macroIdx = Math.max(tilesIdx, barsIdx);
  expect(macroIdx).toBeGreaterThan(-1);
  expect(mealsIdx).toBeGreaterThan(macroIdx);
  return src.slice(macroIdx, mealsIdx);
}

describe("Today above-meals cap (web) — macro tiles to meals gap", () => {
  it("QuickAddPanel does not render between macro tiles and meals", () => {
    const between = macroGridToMealsSlice(HOST_SRC);
    expect(between).not.toMatch(/<QuickAddPanel[\s/]/);
  });

  it("QuickAddPanel is wired through TodayMealsSection (ENG-594)", () => {
    expect(HOST_SRC).toMatch(/<TodayMealsSection[\s\S]+?quickAddPanel=\{[\s\S]+?<QuickAddPanel/);
  });

  it("NorthStarBlockHost does not render between macro tiles and meals", () => {
    const between = macroGridToMealsSlice(HOST_SRC);
    expect(between).not.toMatch(/<NorthStarBlockHost[\s/]/);
  });
});

describe("Today above-meals cap (web) — folded primitives", () => {
  it("AI-sentinel 'Includes N AI-estimated meals' text is NOT in the host (folded into TodayHeroStats)", () => {
    // Pre-Phase-4 the host rendered a standalone <div> pill above
    // the macro tiles. Phase 4 / Top-5 #2B moved the sentinel into
    // TodayHeroStats via the `aiSourcedCount` prop.
    expect(HOST_SRC).not.toMatch(/Includes \{[^}]+\} AI-estimated meal/);
    expect(HOST_SRC).not.toMatch(/aiCount === 0 \|\| viewMode/);
  });

  it("standalone nutrient grid <div> is NOT in the host (folded into TodayDashboardMacroTiles)", () => {
    // Pre-Phase-4 the host mapped over `dayNutrientDetailRows` to
    // render a 2-3 column grid of nutrient cards directly between
    // the macro tiles and the meals section. Phase 4 / Top-5 #2C
    // moved this into TodayDashboardMacroTiles via the
    // `nutrientRows` prop. If a future sweep re-adds the standalone
    // grid, this pin fires.
    //
    // The match looks for the JSX render shape (.map over the rows)
    // at the host level, which is harder to false-positive against
    // an unrelated description.
    expect(HOST_SRC).not.toMatch(
      /\{dayNutrientDetailRows\.map\(\(row\) =>\s*\(/,
    );
  });
});

describe("Today above-meals cap (web) — canonical four primitives", () => {
  it("renders <TodayHeroStats> exactly once", () => {
    expect(countMatches(HOST_SRC, /<TodayHeroStats[\s/]/g)).toBe(1);
  });

  it("renders <TodayDashboardMacroTiles> exactly once", () => {
    expect(countMatches(HOST_SRC, /<TodayDashboardMacroTiles[\s/]/g)).toBe(1);
  });
});

describe("Today premium sprint (2026-05-19) — below-meals prompts", () => {
  it("NorthStarBlockHost renders in the below-meals block, not the context IIFE", () => {
    expect(HOST_SRC).toMatch(/Below-meals prompts \(Today premium sprint 2026-05-19\)/);
    expect(HOST_SRC).toMatch(
      /NorthStarBlockHost[\s\S]+?mealsForSelectedDate\.length === 0/,
    );
    expect(HOST_SRC).toMatch(
      /\/\/ 3\. North-star moved below meals \(Today premium sprint 2026-05-19\)\.\s*\n\s*return null;/,
    );
  });

  it("documents idle Start fast removal from the context IIFE", () => {
    expect(HOST_SRC).toMatch(/Idle "Start fast" removed \(Today premium sprint 2026-05-19\)/);
    // No second TodayFastingPill branch for opted-in-but-not-fasting users.
    expect(HOST_SRC).not.toMatch(/fastingOptedIn\s*&&\s*!activeFast/);
  });
});

describe("Today premium sprint (2026-05-19) — neutral context chrome", () => {
  it("TodayEatAgainBanner uses neutral card chrome, not primary tint", () => {
    const bannerSrc = readFileSync(
      resolve(REPO, "src/app/components/suppr/today-eat-again-banner.tsx"),
      "utf-8",
    );
    expect(bannerSrc).toMatch(/border-border bg-card/);
    expect(bannerSrc).not.toMatch(/border-primary\/30 bg-primary\/5/);
    expect(bannerSrc).toMatch(/text-muted-foreground">Eat again</);
    expect(bannerSrc).not.toMatch(/tracking-widest text-primary">Eat again/);
  });
});

describe("Today above-meals cap (web) — context dispatch shape", () => {
  it("the context block uses an IIFE dispatch (single render path)", () => {
    // The mutually-exclusive context block is an inline IIFE in
    // the JSX. This pin asserts the dispatch shape exists; if a
    // future sweep replaces it with separate top-level conditionals
    // (the pre-Phase-4 anti-pattern), the IIFE disappears and this
    // fires.
    const hasIIFE = /\(\(\)\s*=>\s*\{[\s\S]+?<(TodayFastingPill|TodayEatAgainBanner|NorthStarBlockHost)/.test(
      HOST_SRC,
    );
    expect(hasIIFE).toBe(true);
  });
});
