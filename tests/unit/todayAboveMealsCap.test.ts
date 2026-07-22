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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const HOST_SRC = readFileSync(
  resolve(REPO, "src/app/components/NutritionTracker.tsx"),
  "utf-8",
);

// ENG-1653: the hero (coach line + <TodayHeroStats>) is extracted to
// today-hero-block so the host can mount it in one of two flag-picked slots
// (tight cluster vs legacy). Pins that guarded the hero's internals now
// read the extracted source. Mobile mirror does the same.
const HERO_BLOCK_SRC = readFileSync(
  resolve(REPO, "src/app/components/suppr/today-hero-block.tsx"),
  "utf-8",
);

function countMatches(src: string, pattern: RegExp): number {
  const m = src.match(pattern);
  return m ? m.length : 0;
}

describe("Today above-meals cap (web) — context block dispatch", () => {
  it("TodayFastingPill renders at most once at runtime (ENG-889 duplicates source refs in flag branches)", () => {
    expect(countMatches(HOST_SRC, /<TodayFastingPill[\s/]/g)).toBeLessThanOrEqual(2);
  });

  it("TodayEatAgainBanner is not rendered on Today (moved to Log sheet, mobile parity 2026-05-22 v4)", () => {
    expect(countMatches(HOST_SRC, /<TodayEatAgainBanner[\s/]/g)).toBe(0);
  });

  it("NorthStarBlockHost renders at most once in the context dispatch (below-meals copy is separate)", () => {
    expect(countMatches(HOST_SRC, /<NorthStarBlockHost[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("TodayDeficitInsight renders exactly once, inside the hero coachLine (today_coach_in_hero_v1 collapsed ENG-1356; hero extracted ENG-1653)", () => {
    // `today_coach_in_hero_v1` was always-on in production (REDESIGN_DEFAULT_ON)
    // and is now collapsed — the legacy standalone context-block dispatch for
    // the deficit line is gone; only the hero coachLine path renders, and it
    // lives in the extracted today-hero-block (ENG-1653), never in the host.
    expect(countMatches(HOST_SRC, /<TodayDeficitInsight[\s/]/g)).toBe(0);
    expect(countMatches(HERO_BLOCK_SRC, /<TodayDeficitInsight[\s/]/g)).toBe(1);
    expect(HOST_SRC).not.toMatch(/isFeatureEnabled\("today_coach_in_hero_v1"\)/);
  });
});

function macroGridToMealsSlice(src: string): string {
  const mealsIdx = src.indexOf("<TodayMealsSection");
  // ENG-1224: the Tiles/Bars/Rings switch is rendered through the extracted
  // <TodayMacroSection> (was an inline <TodayDashboardMacroTiles/Bars> ternary).
  const macroIdx = src.lastIndexOf("<TodayMacroSection", mealsIdx);
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

  it("north-star mounts between macro tiles and meals on the LEGACY path, and directly under the hero cluster when today_hero_cluster_v3 is on (ENG-1653)", () => {
    // The hoisted `northStarBlockWeb` (gated on `showAboveMealsNorthStarWeb`)
    // mounts in exactly one of two slots: legacy below-macros (dead Figma
    // 654:2) or directly under the hero cluster (v3 prototype order).
    const between = macroGridToMealsSlice(HOST_SRC);
    expect(between).toMatch(/\{heroClusterOn \? null : northStarBlockWeb\}/);
    expect(countMatches(HOST_SRC, /\{heroClusterOn \? northStarBlockWeb : null\}/g)).toBe(1);
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
  it("renders the hero exactly once (host mounts <TodayHeroBlock> once; the block renders <TodayHeroStats> once — ENG-1653)", () => {
    expect(countMatches(HOST_SRC, /<TodayHeroBlock[\s/]/g)).toBe(1);
    expect(countMatches(HERO_BLOCK_SRC, /<TodayHeroStats[\s/]/g)).toBe(1);
    expect(countMatches(HOST_SRC, /\{heroClusterOn \? heroBlockWeb : null\}/g)).toBe(1);
    expect(countMatches(HOST_SRC, /\{heroClusterOn \? null : heroBlockWeb\}/g)).toBe(1);
  });

  it("renders <TodayMacroSection> exactly once (the Tiles/Bars/Rings switcher)", () => {
    expect(countMatches(HOST_SRC, /<TodayMacroSection[\s/]/g)).toBe(1);
  });
});

describe("Today premium sprint (2026-05-19) — below-meals prompts", () => {
  it("NorthStarBlockHost is a PERMANENT above-meals block, not gated on remaining calories (ENG-935)", () => {
    // ENG-935 (2026-06-17): mirrors the mobile change — the "What to
    // eat next" block renders for today regardless of remaining
    // calories (over-budget / on-target included). The web gate is
    // `selectedDateKey === todayKey()` only; it no longer hangs off
    // `Math.max(0, target - calories) > 0`. The over-budget state is
    // owned by `NorthStarBlockHost` (calm caption when
    // remainingCalories <= 0). This pins the gate so the `> 0`
    // suppression can't silently return.
    const mealsIdx = HOST_SRC.indexOf("<TodayMealsSection");
    const northStarIdx = HOST_SRC.indexOf("<NorthStarBlockHost");
    expect(mealsIdx).toBeGreaterThan(-1);
    expect(northStarIdx).toBeGreaterThan(-1);
    expect(northStarIdx).toBeLessThan(mealsIdx);
    expect(HOST_SRC).toMatch(/showAboveMealsNorthStarWeb\s*=\s*selectedDateKey === todayKey\(\);/);
    // Bound the negative to the gate STATEMENT only (up to its
    // semicolon). `Math.max(0, …) > 0` appears elsewhere in the
    // 2,600-line host, so an unbounded `[\s\S]*` would false-positive.
    expect(HOST_SRC).not.toMatch(
      /showAboveMealsNorthStarWeb\s*=[^;]*Math\.max\(0,[\s\S]*?\)\s*>\s*0/,
    );
    expect(HOST_SRC).not.toMatch(/showBelowMealsNorthStarWeb/);
  });

  it("does not render idle Start fast in the context IIFE", () => {
    expect(HOST_SRC).not.toMatch(/fastingOptedIn\s*&&\s*!activeFast/);
  });
});

describe("Eat-again banner retired (ENG-984, web)", () => {
  it("the TodayEatAgainBanner component file no longer exists", () => {
    // ENG-984 (2026-06-17): the Eat-again banner was suppressed from
    // Today on 2026-05-22 (v4) and rendered nowhere thereafter. The
    // dead component is deleted; this pin fires if it is resurrected.
    expect(
      existsSync(resolve(REPO, "src/app/components/suppr/today-eat-again-banner.tsx")),
    ).toBe(false);
  });

  it("the suppr barrel no longer exports TodayEatAgainBanner", () => {
    const barrel = readFileSync(
      resolve(REPO, "src/app/components/suppr/index.ts"),
      "utf-8",
    );
    expect(barrel).not.toMatch(/export\s*\{[^}]*TodayEatAgainBanner/);
  });

  it("NutritionTracker does not import the eat-again banner", () => {
    expect(HOST_SRC).not.toMatch(/today-eat-again-banner/);
    expect(HOST_SRC).not.toMatch(/import[\s\S]*TodayEatAgainBanner/);
  });
});

describe("Today above-meals cap (web) — context dispatch shape", () => {
  it("the fasting context block renders only WITH content (single conditional mount)", () => {
    // Historically an IIFE dispatch; the deficit line then moved inside the
    // hero (ENG-1356 → today-hero-block, ENG-1653) leaving fasting as the
    // one context block, mounted directly by its conditional.
    expect(HOST_SRC).toMatch(/\{activeFast \? \(\s*<TodayFastingPill/);
  });
});

describe("ENG-889 — coach line inside hero card", () => {
  it("the hero block passes coachLine into TodayHeroStats unconditionally (today_coach_in_hero_v1 collapsed ENG-1356; extracted ENG-1653)", () => {
    expect(HOST_SRC).not.toMatch(/today_coach_in_hero_v1/);
    expect(HERO_BLOCK_SRC).toMatch(/coachLine=\{coachLineEl\}/);
  });

  it("today-hero-ring renders the coachLine slot below stats", () => {
    const ring = readFileSync(
      resolve(REPO, "src/app/components/suppr/today-hero-ring.tsx"),
      "utf-8",
    );
    expect(ring).toMatch(/\{coachLine\}/);
  });
});
