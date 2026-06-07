/**
 * Today above-meals cap — contract pins (web).
 *
 * Authority: `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5 #2.
 * Source: `src/app/components/NutritionTracker.tsx`
 *
 * Mirrors the mobile pin at
 * `apps/mobile/tests/unit/todayAboveMealsCap.test.ts`.
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
  it("TodayFastingPill renders at most once (active fast only; idle Start fast demoted 2026-05-19)", () => {
    expect(countMatches(HOST_SRC, /<TodayFastingPill[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("TodayEatAgainBanner is not rendered on Today (moved to Log sheet, mobile parity 2026-05-22 v4)", () => {
    expect(countMatches(HOST_SRC, /<TodayEatAgainBanner[\s/]/g)).toBe(0);
  });

  it("NorthStarBlockHost renders at most once in the context dispatch (below-meals copy is separate)", () => {
    expect(countMatches(HOST_SRC, /<NorthStarBlockHost[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("TodayDeficitInsight renders at most once (in the unified dispatch)", () => {
    expect(countMatches(HOST_SRC, /<TodayDeficitInsight[\s/]/g)).toBeLessThanOrEqual(1);
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

  it("NorthStarBlockHost renders between macro tiles and meals (Figma 654:2)", () => {
    const between = macroGridToMealsSlice(HOST_SRC);
    expect(between).toMatch(/<NorthStarBlockHost[\s/]/);
    expect(between).toMatch(/showAboveMealsNorthStarWeb/);
  });
});

describe("Today above-meals cap (web) — folded primitives", () => {
  it("AI-sentinel 'Includes N AI-estimated meals' text is NOT in the host (folded into TodayHeroStats)", () => {
    expect(HOST_SRC).not.toMatch(/Includes \{[^}]+\} AI-estimated meal/);
    expect(HOST_SRC).not.toMatch(/aiCount === 0 \|\| viewMode/);
  });

  it("standalone nutrient grid <div> is NOT in the host (folded into TodayDashboardMacroTiles)", () => {
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
  it("NorthStarBlockHost renders above meals when calories remain (Figma 654:2)", () => {
    const mealsIdx = HOST_SRC.indexOf("<TodayMealsSection");
    const northStarIdx = HOST_SRC.indexOf("<NorthStarBlockHost");
    expect(mealsIdx).toBeGreaterThan(-1);
    expect(northStarIdx).toBeGreaterThan(-1);
    expect(northStarIdx).toBeLessThan(mealsIdx);
    expect(HOST_SRC).toMatch(/showAboveMealsNorthStarWeb/);
    expect(HOST_SRC).not.toMatch(/showBelowMealsNorthStarWeb/);
  });

  it("does not render idle Start fast in the context IIFE", () => {
    expect(HOST_SRC).not.toMatch(/fastingOptedIn\s*&&\s*!activeFast/);
  });
});

describe("Today premium sprint (2026-05-19) — neutral context chrome", () => {
  it("TodayEatAgainBanner uses neutral card chrome, not primary tint", () => {
    const bannerSrc = readFileSync(
      resolve(REPO, "src/app/components/suppr/today-eat-again-banner.tsx"),
      "utf-8",
    );
    expect(bannerSrc).toMatch(/bg-card card-slab-flat/);
    expect(bannerSrc).not.toMatch(/border-primary\/30 bg-primary\/5/);
    expect(bannerSrc).toMatch(/text-muted-foreground">Eat again</);
    expect(bannerSrc).not.toMatch(/tracking-widest text-primary">Eat again/);
  });
});

describe("Today above-meals cap (web) — context dispatch shape", () => {
  it("the context block uses an IIFE dispatch (single render path)", () => {
    const hasIIFE = /\(\(\)\s*=>\s*\{[\s\S]+?<(TodayFastingPill|TodayDeficitInsight)/.test(
      HOST_SRC,
    );
    expect(hasIIFE).toBe(true);
  });
});
