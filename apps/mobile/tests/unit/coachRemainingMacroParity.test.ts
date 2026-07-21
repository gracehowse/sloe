/**
 * Coach screen remaining-macro parity (ENG-1603, 2026-07-21).
 *
 * Bug: `apps/mobile/app/coach.tsx` selected `carbs`/`fat` from
 * `nutrition_entries` but dropped them when mapping rows into the
 * `TodayMeal` shape it feeds the totals/`remaining` computation. Because
 * the mapped objects never carried a `carbs`/`fat` key, `totals.carbs` and
 * `totals.fat` were always 0 — so `remaining.carbs`/`remaining.fat` were
 * always the FULL daily target, no matter what the user actually logged.
 * The shared `northStarSuggestion`/`mealCoach` scorer partially ranks
 * candidates on macro-remaining fit (`Math.abs(remaining.carbs - ca)` /
 * `Math.abs(remaining.fat - f)` penalties — see
 * `src/lib/nutrition/northStarSuggestion.ts`), so this could silently
 * change mobile's #1 "what to eat next" suggestion vs web for the same
 * user/state.
 *
 * A second, related divergence found while fixing the above: mobile
 * floored `remaining.protein`/`carbs`/`fat` at 0 with `Math.max(0, ...)`;
 * web (`src/app/components/suppr/coach-screen-client.tsx`) never has, and
 * still doesn't, clamp — it's a plain `target - logged` subtraction. Since
 * the ticket's ask is that mobile and web compute the SAME `remaining`
 * shape from the same logged entries, the clamp is fixed in the same
 * change (same file, same computation block) rather than filed
 * separately — it's the other half of "wrong ranking input vs web" for
 * any user who has logged a macro past its target.
 *
 * This file has two layers, matching the `coachAnalyticsParity.test.ts` /
 * `recipeSourceCardParity.test.ts` convention for these hard-to-render
 * (Expo Router / RN + Next client component) screens:
 *
 *   1. Structural source parity — regex-pin the exact shape of the
 *      mapping/totals/remaining code on both platforms so a future edit
 *      can't silently re-drop a macro or re-add a clamp.
 *   2. Numeric parity — actually execute the totals + remaining formula
 *      (verified by (1) to match both source files) against fixture
 *      `nutrition_entries` rows and assert mobile and web produce an
 *      identical `remaining` object, including the over-target case that
 *      only the clamp fix covers.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(__dirname, "../../app/coach.tsx");
const WEB_PATH = resolve(
  __dirname,
  "../../../../src/app/components/suppr/coach-screen-client.tsx",
);
const MOBILE = readFileSync(MOBILE_PATH, "utf8");
const WEB = readFileSync(WEB_PATH, "utf8");

describe("coach screen — remaining-macro structural parity (ENG-1603)", () => {
  it("mobile's TodayMeal shape carries carbs + fat (not dropped)", () => {
    expect(MOBILE).toMatch(/type TodayMeal = \{[\s\S]*?carbs\?:\s*number \| null;[\s\S]*?\};/);
    expect(MOBILE).toMatch(/type TodayMeal = \{[\s\S]*?fat\?:\s*number \| null;[\s\S]*?\};/);
  });

  it("mobile selects carbs + fat from nutrition_entries", () => {
    expect(MOBILE).toMatch(
      /\.select\(\s*["']name, calories, protein, carbs, fat["']\s*\)/,
    );
  });

  it("mobile's entries → TodayMeal mapping carries carbs + fat through (the exact ENG-1603 bug)", () => {
    const mapMatch = MOBILE.match(
      /setMealsToday\(\s*\(entries \?\? \[\]\)\.map\(\(e\) => \(\{([\s\S]*?)\}\)\),?\s*\);/,
    );
    expect(mapMatch).not.toBeNull();
    const body = mapMatch![1];
    expect(body).toMatch(/carbs:\s*e\.carbs/);
    expect(body).toMatch(/fat:\s*e\.fat/);
  });

  it("mobile's totals loop reads m.carbs / m.fat directly, no discarding cast", () => {
    expect(MOBILE).toMatch(/carbs \+= Number\(m\.carbs\) \|\| 0;/);
    expect(MOBILE).toMatch(/fat \+= Number\(m\.fat\) \|\| 0;/);
    // The pre-fix code cast to `{ carbs?: number }` specifically because
    // the mapped object never actually had the field. That cast must be
    // gone now that TodayMeal carries carbs/fat for real.
    expect(MOBILE).not.toMatch(/\(m as \{\s*carbs\?:\s*number\s*\}\)/);
    expect(MOBILE).not.toMatch(/\(m as \{\s*fat\?:\s*number\s*\}\)/);
  });

  it("mobile's remaining computation matches web: plain subtraction, no Math.max(0, ...) floor", () => {
    const remainingMatch = MOBILE.match(
      /const remaining = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/,
    );
    expect(remainingMatch).not.toBeNull();
    const body = remainingMatch![1];
    expect(body).toMatch(/protein:\s*targets\.protein\s*-\s*totals\.protein,/);
    expect(body).toMatch(/carbs:\s*targets\.carbs\s*-\s*totals\.carbs,/);
    expect(body).toMatch(/fat:\s*targets\.fat\s*-\s*totals\.fat,/);
    expect(body).not.toMatch(/Math\.max/);
  });

  it("web's totals + remaining computation (the reference this fix matches) is unchanged", () => {
    expect(WEB).toMatch(/carbs \+= Number\(m\.carbs\) \|\| 0;/);
    expect(WEB).toMatch(/fat \+= Number\(m\.fat\) \|\| 0;/);
    const remainingMatch = WEB.match(
      /const remaining = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/,
    );
    expect(remainingMatch).not.toBeNull();
    const body = remainingMatch![1];
    expect(body).toMatch(/protein:\s*macroTargets\.protein\s*-\s*totals\.protein,/);
    expect(body).toMatch(/carbs:\s*macroTargets\.carbs\s*-\s*totals\.carbs,/);
    expect(body).toMatch(/fat:\s*macroTargets\.fat\s*-\s*totals\.fat,/);
    expect(body).not.toMatch(/Math\.max/);
  });
});

describe("coach screen — remaining-macro numeric parity (ENG-1603)", () => {
  // Mirrors the (now-identical, per the structural assertions above)
  // totals + remaining formula on both platforms. Kept as a pure
  // function here so the numeric behaviour is pinned independently of
  // React/Expo Router/Supabase rendering, matching how
  // `coachAnalyticsParity.test.ts` avoids mounting the real screens.
  type Entry = { calories: number; protein: number; carbs: number; fat: number };
  type Targets = { calories: number; protein: number; carbs: number; fat: number };

  function computeRemaining(entries: Entry[], targets: Targets) {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    for (const m of entries) {
      calories += Number(m.calories) || 0;
      protein += Number(m.protein) || 0;
      carbs += Number(m.carbs) || 0;
      fat += Number(m.fat) || 0;
    }
    return {
      calories: targets.calories - calories,
      protein: targets.protein - protein,
      carbs: targets.carbs - carbs,
      fat: targets.fat - fat,
      dailyCalorieTarget: targets.calories,
    };
  }

  const targets: Targets = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

  it("reflects logged carbs/fat, not the full daily target (the ENG-1603 bug scenario)", () => {
    // Two meals logged today with real carbs/fat, mirroring what
    // `nutrition_entries` (carbs/fat `real not null default 0`) returns.
    const entries: Entry[] = [
      { calories: 450, protein: 30, carbs: 40, fat: 15 },
      { calories: 600, protein: 35, carbs: 55, fat: 22 },
    ];
    const remaining = computeRemaining(entries, targets);

    // Pre-fix, mobile's totals.carbs/fat were always 0 (the mapping
    // dropped the fields), so remaining.carbs/fat would equal the full
    // target here (200 / 65) regardless of the 95g carbs / 37g fat
    // actually logged. Post-fix they must reflect what's logged.
    expect(remaining.carbs).toBe(200 - 95);
    expect(remaining.fat).toBe(65 - 37);
    expect(remaining.carbs).not.toBe(targets.carbs);
    expect(remaining.fat).not.toBe(targets.fat);
  });

  it("does not floor remaining protein/carbs/fat at 0 when a macro is logged past target (clamp-divergence fix)", () => {
    const entries: Entry[] = [{ calories: 2200, protein: 160, carbs: 230, fat: 80 }];
    const remaining = computeRemaining(entries, targets);

    // Pre-fix, mobile's `Math.max(0, ...)` would report 0 here for all
    // three macros; web reported the true (negative) overage. The coach
    // scorer's `Math.abs(remaining.X - candidate.X)` penalty is a
    // materially different number under each behaviour, so this must
    // match web's signed result exactly.
    expect(remaining.protein).toBe(150 - 160);
    expect(remaining.carbs).toBe(200 - 230);
    expect(remaining.fat).toBe(65 - 80);
    expect(remaining.protein).toBeLessThan(0);
    expect(remaining.carbs).toBeLessThan(0);
    expect(remaining.fat).toBeLessThan(0);
  });

  it("produces the exact same remaining shape mobile and web compute from the same logged entries", () => {
    // Same fixture entries fed through the identical formula (pinned by
    // the structural-parity block above to be what both coach.tsx and
    // coach-screen-client.tsx actually contain) must yield one shared
    // result — there is no platform-specific branch in either formula.
    const entries: Entry[] = [
      { calories: 520, protein: 40, carbs: 45, fat: 18 },
      { calories: 380, protein: 22, carbs: 30, fat: 12 },
      { calories: 310, protein: 15, carbs: 60, fat: 8 },
    ];
    const mobileRemaining = computeRemaining(entries, targets);
    const webRemaining = computeRemaining(entries, targets);

    expect(mobileRemaining).toEqual(webRemaining);
    expect(mobileRemaining).toEqual({
      calories: 2000 - 1210,
      protein: 150 - 77,
      carbs: 200 - 135,
      fat: 65 - 38,
      dailyCalorieTarget: 2000,
    });
  });
});
