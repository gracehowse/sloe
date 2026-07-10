// @vitest-environment jsdom

/**
 * ENG-1491 — web Plan eyebrow reads the persisted `start_date` anchor.
 *
 * Behavioural half: `usePlanWeekEyebrow` labels a plan WITH real meals by
 * its persisted anchor (mobile ENG-1480 `usePlanV3WeekAnchor` contract) and
 * keeps the prospective chip week for empty / legacy-anchorless plans.
 *
 * Source-pin half (repo convention for AppDataContext behaviour, see
 * `appDataHonestImagery.test.ts`): the persist effect passes the plan's
 * KNOWN anchor to `save_meal_plan` — the pre-fix hard-coded wall-clock
 * "today" re-anchored a saved plan on every hydration/edit re-save,
 * shifting log-as-planned calendar dates on both platforms.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePlanWeekEyebrow } from "../../src/app/components/plan/usePlanWeekEyebrow";
import type { DayPlan } from "../../src/types/recipe";

const meal = (recipeTitle: string) =>
  ({ name: recipeTitle, recipeTitle, calories: 500, protein: 30, carbs: 40, fat: 20 }) as DayPlan["meals"][number];

const realPlan: DayPlan[] = [
  { day: 1, meals: [meal("Shakshuka")], totals: { calories: 500, protein: 30, carbs: 40, fat: 20 } },
  { day: 2, meals: [meal("Ramen")], totals: { calories: 500, protein: 30, carbs: 40, fat: 20 } },
] as DayPlan[];

describe("usePlanWeekEyebrow — ENG-1491 anchor gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0)); // local Fri 24 Apr 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels a real plan by its persisted anchor, not the reset chip", () => {
    const { result } = renderHook(() =>
      usePlanWeekEyebrow({
        mealPlan: realPlan,
        mealPlanStartDate: "2026-04-19", // Sunday anchor
        planHasRealMeals: true,
        startOffset: 0, // chip reset to 0 on load — must NOT win
      }),
    );
    expect(result.current).toBe("Apr 19 – 20 · Meal plan");
  });

  it("keeps the prospective chip week for an EMPTY plan with a dead anchor", () => {
    const { result } = renderHook(() =>
      usePlanWeekEyebrow({
        mealPlan: null,
        mealPlanStartDate: "2026-04-19",
        planHasRealMeals: false,
        startOffset: 7,
      }),
    );
    // today(24 Apr) + 7 = 1 May; empty plan renders a same-day range.
    expect(result.current).toBe("May 1 – 1 · Meal plan");
  });

  it("falls back to the chip week for a real plan that predates the anchor column", () => {
    const { result } = renderHook(() =>
      usePlanWeekEyebrow({
        mealPlan: realPlan,
        mealPlanStartDate: null,
        planHasRealMeals: true,
        startOffset: 1,
      }),
    );
    expect(result.current).toBe("Apr 25 – 26 · Meal plan");
  });

  it("crosses month boundaries with both month names", () => {
    const { result } = renderHook(() =>
      usePlanWeekEyebrow({
        mealPlan: [
          ...realPlan,
          ...Array.from({ length: 5 }, (_, i) => ({
            day: i + 3,
            meals: [meal("Bowl")],
            totals: { calories: 500, protein: 30, carbs: 40, fat: 20 },
          })),
        ] as DayPlan[],
        mealPlanStartDate: "2026-04-28",
        planHasRealMeals: true,
        startOffset: 0,
      }),
    );
    expect(result.current).toBe("Apr 28 – May 4 · Meal plan");
  });
});

const ROOT = resolve(__dirname, "../..");
const APP_DATA = readFileSync(resolve(ROOT, "src/context/AppDataContext.tsx"), "utf8");

describe("AppDataContext persist path — ENG-1491 anchor contract (source pins)", () => {
  it("persists the plan's known anchor, never a re-derived wall-clock today", () => {
    // The pre-fix IIFE built `webStartDate` from `new Date()` on every save.
    expect(APP_DATA).not.toMatch(/const webStartDate/);
    expect(APP_DATA).toMatch(
      /const persistedStartDate =\s*\n?\s*mealPlanStartDateRef\.current \?\? startDateForOffset\(new Date\(\), 0\);/,
    );
    expect(APP_DATA).toMatch(/p_start_date: persistedStartDate,/);
  });

  it("blocks persist until the slot's cloud anchor has hydrated", () => {
    expect(APP_DATA).toMatch(/if \(!mealPlanAnchorLoadedRef\.current\) return;/);
  });

  it("hydration updates the anchor even for an empty slot (no stale carry-over)", () => {
    expect(APP_DATA).toMatch(/setMealPlanStartDate\(loaded\?\.startDate \?\? null\);/);
  });

  it("a full generation re-anchors from the chip offset", () => {
    expect(APP_DATA).toMatch(
      /setMealPlanStartDate\(startDateForOffset\(new Date\(\), options\?\.startOffset \?\? 0\)\);/,
    );
  });
});

describe("PlanV3Connected header week — ENG-1491 anchor gate (source pins)", () => {
  const V3 = readFileSync(
    resolve(ROOT, "src/app/components/plan/PlanV3Connected.tsx"),
    "utf8",
  );

  it("derives weekDates from the gated anchor, not the raw chip offset", () => {
    expect(V3).toMatch(/resolvePlanWeekAnchor\(\{ planHasRealMeals, planStartDate, startOffset \}\)/);
    // The pre-fix derivation walked 7 days straight off the resettable chip.
    expect(V3).not.toMatch(/planCalendarDateForIndex\(i, startOffset\)/);
  });

  it("MealPlanner plumbs the persisted anchor into the v3 surface", () => {
    const HOST = readFileSync(resolve(ROOT, "src/app/components/MealPlanner.tsx"), "utf8");
    expect(HOST).toMatch(/planStartDate=\{mealPlanStartDate\}/);
  });
});
