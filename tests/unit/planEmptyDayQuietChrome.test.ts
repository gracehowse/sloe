/**
 * e2e walk 2026-06-10 (ENG-1020 #1/#2/#3) — Plan day-card chrome quietening.
 *
 * These are source-pinning contracts: the planner screens are far over the
 * jsdom-renderable size, and the behaviours under test are structural guards
 * inside the day-card render loop. Each assertion fails if the guard is
 * reverted, which is the regression we care about.
 *
 *   #1 Empty-day macro chip wall — the per-day `PlanDayMacroSummary` (mobile)
 *      / day-total delta chips (web) must be gated on the day having a REAL
 *      meal (a chosen recipe, not a placeholder slot), not merely a non-empty
 *      slot list. A placeholder-only day rendered an all-zero "P 0g −99g" wall.
 *   #2 "Bfast" → "Breakfast" — the only abbreviation in the app is gone; the
 *      add-slot chip now reads the full slot name (Snacks → "Snack" stays).
 *   #3 Redundant date subheader — the mobile page subheader no longer repeats
 *      the date already carried by the summary-card eyebrow.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const PLANNER = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"),
  "utf8",
);
const WEB_PLANNER = readFileSync(
  resolve(ROOT, "src/app/components/MealPlanner.tsx"),
  "utf8",
);
const PLAN_CHROME = readFileSync(
  resolve(ROOT, "apps/mobile/components/tabs/PlanTabChrome.tsx"),
  "utf8",
);

describe("Plan empty-day macro chips (ENG-1020 #1)", () => {
  it("mobile gates PlanDayMacroSummary on the day having a real meal", () => {
    // The macro summary block must be guarded by a per-day "has real meal"
    // predicate, so a placeholder-only day suppresses the all-zero chip wall.
    expect(PLANNER).toMatch(
      /planTargets && dp\.meals\.some\(planMealHasRecipe\)\s*\?/,
    );
  });

  it("mobile still renders the empty-day copy + add-slot pills", () => {
    // The quiet empty state stays — only the macro chips are suppressed.
    expect(PLANNER).toMatch(/No meals planned for this day yet\./);
    expect(PLANNER).toMatch(/planner-add-slot-back-/);
  });

  it("web gates the day-total delta chips on a real meal, not slot count", () => {
    // `renderTotals` must depend on a real-meal predicate, not just
    // `dp.meals.length > 0` (placeholder-only days have length > 0).
    expect(WEB_PLANNER).toMatch(/const dayHasRealMeal = dp\.meals\.some\(/);
    expect(WEB_PLANNER).toMatch(/renderTotals = dayTotalLine\.hasTargets && dayHasRealMeal/);
    // The buggy "meals.length > 0" gate is gone.
    expect(WEB_PLANNER).not.toMatch(/renderTotals = dayTotalLine\.hasTargets && dp\.meals\.length > 0/);
  });
});

describe("Plan add-slot chip label (ENG-1020 #2)", () => {
  it('no longer abbreviates Breakfast to "Bfast"', () => {
    // The abbreviation is gone from the chip resolver (it may survive in a
    // historical comment, so we pin the absence of the RETURN, not the token).
    expect(PLANNER).not.toMatch(/return "Bfast"/);
    // The chip resolver returns the full slot name for Breakfast.
    expect(PLANNER).toMatch(/case "Breakfast":[\s\S]*?return "Breakfast";/);
  });

  it('keeps "Snack" singular for the Snacks chip (one action)', () => {
    expect(PLANNER).toMatch(/case "Snacks":[\s\S]*?return "Snack";/);
  });
});

describe("Plan page subheader date redundancy (ENG-1020 #3)", () => {
  it("mobile no longer passes a date subtitle to PlanTabChrome", () => {
    // The "Week of {date}" subtitle is removed; the screen title "Meal plan"
    // + the summary-card eyebrow carry the date span.
    expect(PLANNER).not.toMatch(/subtitle=\{getWeekOfLabel\(\)\}/);
    expect(PLANNER).not.toMatch(/const getWeekOfLabel/);
  });

  it("the summary card eyebrow still carries the date span", () => {
    // Keep the eyebrow as the single date carrier.
    expect(PLANNER).toMatch(/· Meal plan/);
  });

  it("PlanTabChrome still defaults its title to 'Meal plan' and accepts an optional subtitle", () => {
    // The chrome contract is unchanged — only the planner stopped passing a
    // subtitle. The title stays "Meal plan".
    expect(PLAN_CHROME).toMatch(/title = "Meal plan"/);
    expect(PLAN_CHROME).toMatch(/subtitle\?: string/);
  });
});
