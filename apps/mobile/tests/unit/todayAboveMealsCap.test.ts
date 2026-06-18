/**
 * Today above-meals cap — contract pins (mobile).
 *
 * Authority: `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5 #2.
 * Source: `apps/mobile/app/(tabs)/index.tsx`
 *
 * The teardown's F1 finding called out that the Today screen had no
 * editor: every audit added a card, nothing got deleted, and the
 * above-meals composition swelled to 13 stacking blocks with multiple
 * aspirational prompts visible at once. Top-5 #2 (2026-04-28) capped
 * the composition at FOUR blocks (date header / hero / one context
 * block / macro tiles) and folded the AI-sentinel pill into the hero
 * card and the all-nutrients link into the macro-tiles section
 * header.
 *
 * The cap is rule-by-convention without a test pin — and this is
 * exactly the kind of invariant that quietly regresses across agent
 * sweeps. This file source-pins each half of the cap so a future
 * change that re-introduces a standalone block lights up CI.
 *
 * What's pinned:
 *   - Each of the four context-block components (TodayFastingPill,
 *     TodayEatAgainBanner, NorthStarBlockHost, TodayDeficitInsight)
 *     renders AT MOST ONCE in `(tabs)/index.tsx` — they live inside a
 *     single mutually-exclusive dispatch IIFE, never as separate
 *     stacking conditionals.
 *   - The "Includes N AI-estimated meals" sentinel text is NOT in
 *     the host file. Phase 4 / Top-5 #2B briefly folded it INTO
 *     `TodayHero` via `aiSourcedCount`; Phase 5 (2026-04-30) deleted
 *     the sentinel entirely after customer-lens flagged it as a
 *     defensive disclaimer that contradicted the 2026-04-27 macro-
 *     first strategic direction. Replaced with the one-time
 *     `AiFirstLogTooltip` rendered below the first AI-sourced meal
 *     row.
 *   - The standalone "View all nutrients" Pressable is NOT in the
 *     host file (it moved into `TodayDashboardMacroTiles`).
 *   - The host renders the canonical 4-block primitives:
 *     `<TodayDateHeader`, `<TodayHero`, `<TodayDashboardMacroTiles`,
 *     `<TodayMealsSection` — once each.
 *
 * Web mirror: `tests/unit/todayAboveMealsCap.test.ts`.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const HOST_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/index.tsx"),
  "utf-8",
);

function countMatches(src: string, pattern: RegExp): number {
  const m = src.match(pattern);
  return m ? m.length : 0;
}

describe("Today above-meals cap (mobile) — context block dispatch", () => {
  // Pattern note: `[\s/]` after the component name only matches real
  // JSX renders (`<Foo `, `<Foo\n`, `<Foo/>`). It excludes JSX-style
  // doc-comment references like `\`<Foo>\`` which would otherwise
  // false-positive a `\b` boundary.

  it("TodayFastingPill renders at most once at runtime (ENG-889 duplicates source refs in flag branches)", () => {
    expect(countMatches(HOST_SRC, /<TodayFastingPill[\s/]/g)).toBeLessThanOrEqual(2);
  });

  it("TodayEatAgainBanner is not rendered on Today (moved to Log sheet, 2026-05-22 v4)", () => {
    expect(countMatches(HOST_SRC, /<TodayEatAgainBanner[\s/]/g)).toBe(0);
  });

  it("TodayEatAgainScroller is not rendered on Today", () => {
    expect(countMatches(HOST_SRC, /<TodayEatAgainScroller[\s/]/g)).toBe(0);
  });

  it("NorthStarBlockHost renders at most once (in the unified dispatch)", () => {
    expect(countMatches(HOST_SRC, /<NorthStarBlockHost[\s/]/g)).toBeLessThanOrEqual(1);
  });

  it("TodayDeficitInsight appears in hero coachLine and legacy context dispatch only (ENG-889: one path renders)", () => {
    expect(countMatches(HOST_SRC, /<TodayDeficitInsight[\s/]/g)).toBeLessThanOrEqual(2);
    expect(HOST_SRC).toMatch(
      /isFeatureEnabled\("today_coach_in_hero_v1"\)[\s\S]+?return null;/,
    );
  });
});

describe("Today above-meals cap (mobile) — folded primitives", () => {
  it("AI-sentinel 'Includes N AI-estimated meals' text is NOT in the host (deleted Phase 5, replaced by AiFirstLogTooltip)", () => {
    // Pre-Phase-4 the host rendered a standalone <View> pill above
    // the macro tiles with this exact copy. Phase 4 / Top-5 #2B
    // moved the sentinel into the TodayHero card via the
    // `aiSourcedCount` prop. Phase 5 (2026-04-30) deleted the
    // sentinel altogether — customer-lens flagged it as a defensive
    // disclaimer that contradicted the 2026-04-27 macro-first
    // strategic direction. The signal now ships once via the
    // AiFirstLogTooltip on the first AI-sourced meal row, gated by
    // AsyncStorage. If a future sweep re-adds the daily caption,
    // this pin fires.
    expect(HOST_SRC).not.toMatch(/Includes \{?aiSourcedTodayCount/);
    expect(HOST_SRC).not.toMatch(/Includes \{[^}]+\} AI-estimated meal/);
    // Phase 5 — the prop and helper-derived count are gone too.
    expect(HOST_SRC).not.toMatch(/aiSourcedCount=/);
    expect(HOST_SRC).not.toMatch(/aiSourcedTodayCount\s*=/);
  });

  it("standalone 'View all nutrients' Pressable is NOT in the host (folded into TodayDashboardMacroTiles)", () => {
    // Pre-Phase-4 the host rendered a centred <Pressable> with the
    // text "View all nutrients" between the macro tiles and the
    // meals section. Phase 4 / Top-5 #2C moved this into the
    // TodayDashboardMacroTiles section header as a right-aligned
    // "Nutrients" chevron link, surfaced via `showNutrientsLink` +
    // `onPressNutrients` props. If a future sweep re-adds the
    // standalone link, this pin fires. (Comment mentions of the
    // string in the surrounding context are scrubbed; the pin
    // matches any occurrence in source so doc-style comments stay
    // out too.)
    expect(HOST_SRC).not.toMatch(/View all nutrients/);
  });
});

describe("Today branding row (mobile)", () => {
  // SLOE redesign (2026-06-03, `01 · Today` frame, Grace decision): the
  // Today scroll now opens with a "Sloe" wordmark + avatar header in
  // place of the old "< Today >" date-nav row. This supersedes the
  // earlier "tab title is enough, no wordmark" posture — the wordmark IS
  // the intended top-of-Today identity now. We still forbid the legacy
  // standalone <TodayBrandBar> component (the wordmark is a lightweight
  // inline row, not that retired block).
  it("renders the Sloe wordmark header (intentional, SLOE redesign 2026-06-03)", () => {
    expect(HOST_SRC).toMatch(/<SloeHeaderWordmark[\s/]/);
    expect(HOST_SRC).toMatch(/testID="today-wordmark"/);
  });

  it("does not use the legacy standalone <TodayBrandBar> block", () => {
    expect(HOST_SRC).not.toMatch(/<TodayBrandBar[\s/]/);
  });
});

describe("Today above-meals cap (mobile) — canonical four primitives", () => {
  it("renders <TodayDateHeader> exactly once", () => {
    expect(countMatches(HOST_SRC, /<TodayDateHeader[\s/]/g)).toBe(1);
  });

  it("renders <TodayHero> exactly once", () => {
    // The pattern excludes `<TodayHeroRing` and (deleted) variants
    // because `[\s/]` enforces that the component name is followed
    // by a word-terminating JSX character.
    expect(countMatches(HOST_SRC, /<TodayHero[\s/]/g)).toBe(1);
  });

  it("renders <TodayDashboardMacroTiles> exactly once", () => {
    expect(countMatches(HOST_SRC, /<TodayDashboardMacroTiles[\s/]/g)).toBe(1);
  });

  it("renders <TodayMealsSection> exactly once", () => {
    expect(countMatches(HOST_SRC, /<TodayMealsSection[\s/]/g)).toBe(1);
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

describe("Today above-meals cap (mobile) — macro tiles to meals gap", () => {
  it("WeeklyCheckinBanner does not render between macro tiles and meals", () => {
    const between = macroGridToMealsSlice(HOST_SRC);
    expect(between).not.toMatch(/<WeeklyCheckinBanner[\s/]/);
  });

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
    expect(between).toMatch(/showAboveMealsNorthStar/);
  });
});

describe("Today premium sprint (2026-05-19) — below-meals prompts", () => {
  it("uses shared below-meals prompt cap (max 2, ENG-585)", () => {
    expect(HOST_SRC).toMatch(/belowMealsPromptSelection/);
    expect(HOST_SRC).toMatch(/isBelowMealsPromptVisible/);
    expect(HOST_SRC).toMatch(/showBelowMealsCheckin/);
  });

  it("North Star above meals is a PERMANENT today-day-view block, not gated on remaining calories (ENG-935)", () => {
    // ENG-935 (2026-06-17): the "What to eat next" block is now a
    // permanent glanceable Today block. The gate is day-view + today
    // only — it no longer hangs off `remaining > 0`, which used to hide
    // the block over-budget / on-target (exactly when the user still
    // needs guidance). The over-budget state is owned by
    // `NorthStarBlockHost` (renders the calm caption when
    // remainingCalories <= 0). This pins the gate so a future sweep
    // can't silently re-add the `remaining > 0` suppression.
    expect(HOST_SRC).toMatch(/showAboveMealsNorthStar\s*=\s*viewMode === "day" && isToday;/);
    // Bound the negative to the gate STATEMENT only (up to its
    // semicolon) — `remaining` legitimately appears elsewhere in the
    // 3,400-line host, so an unbounded `[\s\S]*` would false-positive.
    expect(HOST_SRC).not.toMatch(/showAboveMealsNorthStar\s*=[^;]*remaining\s*>\s*0/);
    expect(HOST_SRC).not.toMatch(/showBelowMealsNorthStar/);
  });

  it("NorthStarBlockHost above meals is gated by showAboveMealsNorthStar", () => {
    const mealsIdx = HOST_SRC.indexOf("<TodayMealsSection");
    const northStarAboveIdx = HOST_SRC.indexOf("<NorthStarBlockHost");
    expect(mealsIdx).toBeGreaterThan(-1);
    expect(northStarAboveIdx).toBeGreaterThan(-1);
    expect(northStarAboveIdx).toBeLessThan(mealsIdx);
    expect(HOST_SRC).toMatch(/showAboveMealsNorthStar\s*&&[\s\S]*<NorthStarBlockHost/);
  });

  it("WeeklyCheckinBanner is in the below-meals block, not above macro tiles", () => {
    const checkinIdx = HOST_SRC.indexOf("showBelowMealsCheckin");
    const weeklyIdx = HOST_SRC.indexOf("<WeeklyCheckinBanner", checkinIdx);
    const mealsIdx = HOST_SRC.indexOf("<TodayMealsSection");
    expect(checkinIdx).toBeGreaterThan(-1);
    expect(weeklyIdx).toBeGreaterThan(checkinIdx);
    expect(weeklyIdx).toBeGreaterThan(mealsIdx);
  });
});

describe("Eat-again banner retired (ENG-984, mobile)", () => {
  it("the TodayEatAgainBanner component file no longer exists", () => {
    // ENG-984 (2026-06-17): the Eat-again banner was suppressed from
    // Today on 2026-05-22 (v4) and rendered nowhere thereafter. The
    // dead component is deleted; this pin fires if it is resurrected.
    expect(
      fs.existsSync(path.resolve(__dirname, "../../components/today/TodayEatAgainBanner.tsx")),
    ).toBe(false);
  });

  it("the TodayEatAgainScroller component file no longer exists", () => {
    expect(
      fs.existsSync(path.resolve(__dirname, "../../components/today/TodayEatAgainScroller.tsx")),
    ).toBe(false);
  });

  it("the Today host no longer imports eat-again candidate / dismiss plumbing", () => {
    // Match the import/render sites only — retirement breadcrumb comments
    // (which name the components) are fine and must not trip these pins.
    expect(HOST_SRC).not.toMatch(/^\s*computeEatAgainCandidatesForSlot,?\s*$/m);
    expect(HOST_SRC).not.toMatch(/from "@suppr\/shared\/nutrition\/eatAgainDismiss"/);
    expect(HOST_SRC).not.toMatch(/<TodayEatAgainBanner[\s/]/);
    expect(HOST_SRC).not.toMatch(/<TodayEatAgainScroller[\s/]/);
  });
});

describe("Today above-meals cap (mobile) — context dispatch shape", () => {
  it("the context block uses an IIFE dispatch (single render path)", () => {
    // The mutually-exclusive context block is an inline IIFE — the
    // `(() => { ... })()` pattern in the JSX. This pin asserts the
    // dispatch shape exists; if a future sweep replaces it with
    // separate top-level conditionals (the pre-Phase-4 anti-
    // pattern), the IIFE disappears and this fires.
    //
    // The pin matches any IIFE that returns one of the four
    // context-block components — generous enough to survive
    // refactors, strict enough to catch the regression.
    const hasIIFE = /\(\(\)\s*=>\s*\{[\s\S]+?<(TodayFastingPill|TodayDeficitInsight)/.test(
      HOST_SRC,
    );
    expect(hasIIFE).toBe(true);
  });
});

describe("ENG-889 — coach line inside hero card (mobile)", () => {
  it("index passes coachLine into TodayHero behind today_coach_in_hero_v1", () => {
    expect(HOST_SRC).toMatch(/today_coach_in_hero_v1/);
    expect(HOST_SRC).toMatch(/coachLine=\{heroCoachLine/);
  });

  it("TodayHeroRing renders the coachLine slot below stats", () => {
    const ring = fs.readFileSync(
      path.resolve(__dirname, "../../components/today/TodayHeroRing.tsx"),
      "utf-8",
    );
    expect(ring).toMatch(/\{coachLine\}/);
  });
});
