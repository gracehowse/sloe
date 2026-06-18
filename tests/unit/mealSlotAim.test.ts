/**
 * ENG-1092 — empty meal-slot "Aim ~X kcal" helper + cross-surface wiring.
 *
 * Pins the shared number + copy (so Today web/mobile + Plan can't drift) and the
 * critical `calories:0` guard the design panel flagged: `distributeMealBudget`
 * returns `calories: 0` for any slot once it has food, so the aim must never
 * render "Aim ~0 kcal".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { emptySlotAimKcal, planSlotAimKcal, aimKcalLabel } from "../../src/lib/nutrition/mealSlotAim";

describe("planSlotAimKcal (Plan day-card static per-slot target)", () => {
  it("rounds the passed slot-target kcal to the nearest 5", () => {
    expect(planSlotAimKcal("Lunch", 600)).toBe(600);
    expect(planSlotAimKcal("Dinner", 612)).toBe(610);
    expect(planSlotAimKcal("Breakfast", 308)).toBe(310);
  });

  it("never shows an aim on the optional Snacks slot (same policy as Today)", () => {
    expect(planSlotAimKcal("Snacks", 200)).toBeNull();
    expect(planSlotAimKcal("Snack", 200)).toBeNull();
  });

  it("suppresses Snacks case-insensitively — the web Plan grid passes lowercase slot names", () => {
    // src/app/components/MealPlanner.tsx SLOTS = ["breakfast","lunch","dinner","snacks"].
    expect(planSlotAimKcal("snacks", 200)).toBeNull();
    expect(planSlotAimKcal("snack", 200)).toBeNull();
    // ...but a lowercase MAIN slot still resolves an aim.
    expect(planSlotAimKcal("breakfast", 308)).toBe(310);
  });

  it("returns null for a non-positive target", () => {
    expect(planSlotAimKcal("Breakfast", 0)).toBeNull();
    expect(planSlotAimKcal("Breakfast", -5)).toBeNull();
  });
});

describe("emptySlotAimKcal", () => {
  it("redistributes the day target across the main meals (25/30/30), rounded to 5", () => {
    const t = 1231;
    expect(emptySlotAimKcal("Breakfast", t, 30, {})).toBe(310); // 307.75 → 308 → 310
    expect(emptySlotAimKcal("Lunch", t, 30, {})).toBe(370); // 369.3 → 369 → 370
    expect(emptySlotAimKcal("Dinner", t, 30, {})).toBe(370);
  });

  it("never shows an aim on the optional Snacks slot (diet-culture sign-off 2026-06-13)", () => {
    // Snacks stays in the budget ratios (so the main meals leave ~15% headroom),
    // but an aim on an optional slot reads as a quota — suppressed entirely.
    expect(emptySlotAimKcal("Snacks", 1231, 30, {})).toBeNull();
    expect(emptySlotAimKcal("Snack", 1231, 30, {})).toBeNull();
  });

  it("shrinks the remaining slots' aims when a slot is already logged (honest redistribution)", () => {
    // Breakfast logged at 620 → 611 left across Lunch/Dinner/Snacks (ratios 0.30/0.30/0.15).
    const consumed = { Breakfast: 620 };
    const lunch = emptySlotAimKcal("Lunch", 1231, 30, consumed)!;
    const dinner = emptySlotAimKcal("Dinner", 1231, 30, consumed)!;
    expect(lunch).toBeLessThan(370); // shrank from the empty-day 370
    expect(lunch).toBe(dinner); // equal ratios
  });

  it("returns null for a slot that already has food (the calories:0 trap — never 'Aim ~0')", () => {
    expect(emptySlotAimKcal("Breakfast", 1231, 30, { Breakfast: 400 })).toBeNull();
  });

  it("returns null when the day is already at/over budget (no 'Aim ~0 kcal')", () => {
    expect(emptySlotAimKcal("Lunch", 1231, 30, { Breakfast: 1300 })).toBeNull();
  });

  it("returns null when there is no target yet", () => {
    expect(emptySlotAimKcal("Breakfast", 0, 30, {})).toBeNull();
    expect(emptySlotAimKcal("Breakfast", -5, 30, {})).toBeNull();
  });

  it("labels body-neutrally as a single tilde value, not a range", () => {
    expect(aimKcalLabel(370)).toBe("Aim ~370 kcal");
    expect(aimKcalLabel(1200)).toBe("Aim ~1,200 kcal");
    expect(aimKcalLabel(370)).not.toMatch(/–|-|Recommended/);
  });
});

describe("ENG-1092 wiring (web + mobile reference the shared helper + flag)", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  const WEB = read("src/app/components/suppr/today-meals-section.tsx");
  const MOBILE = read("apps/mobile/components/today/TodayMealsSection.tsx");
  const WEB_FLAGS = read("src/lib/analytics/track.ts");
  const MOBILE_FLAGS = read("apps/mobile/lib/analytics.ts");

  it("registers plan_today_aim_empty_v1 default-on on both platforms", () => {
    expect(WEB_FLAGS).toMatch(/"plan_today_aim_empty_v1"/);
    expect(MOBILE_FLAGS).toMatch(/"plan_today_aim_empty_v1"/);
  });

  it("both Today components call emptySlotAimKcal behind the flag", () => {
    expect(WEB).toMatch(/emptySlotAimKcal/);
    expect(WEB).toMatch(/EmptyMealSlotAimLine/);
    expect(WEB).toMatch(/isFeatureEnabled\("plan_today_aim_empty_v1"\)/);

    expect(MOBILE).toMatch(/emptySlotAimKcal/);
    expect(MOBILE).toMatch(/EmptyMealSlotAimLine/);
    expect(MOBILE).toMatch(/isFeatureEnabled\("plan_today_aim_empty_v1"\)/);
    expect(read("apps/mobile/components/EmptyMealSlotRow.tsx")).toMatch(/today-slot-aim-/);
  });

  it("mobile drops the 0.55 empty-slot dim when the flag is on", () => {
    expect(MOBILE).toMatch(/hasMeals \|\| aimEmptyOn \? 1 : 0\.55/);
  });
});

describe("ENG-1092 increment 2 — Plan day cards reference the shared helper + flag", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  const WEB_PLAN = read("src/app/components/MealPlanner.tsx");
  const MOBILE_PLAN = read("apps/mobile/app/(tabs)/planner.tsx");

  it("both Plan surfaces gate the aim on the same flag as Today (one spine, no drift)", () => {
    expect(WEB_PLAN).toMatch(/isFeatureEnabled\("plan_today_aim_empty_v1"\)/);
    expect(WEB_PLAN).toMatch(/planSlotAimKcal/);
    expect(WEB_PLAN).toMatch(/EmptyMealSlotAimLine/);

    expect(MOBILE_PLAN).toMatch(/isFeatureEnabled\("plan_today_aim_empty_v1"\)/);
    expect(MOBILE_PLAN).toMatch(/planSlotAimKcal/);
    expect(MOBILE_PLAN).toMatch(/EmptyMealSlotAimLine/);
    expect(read("apps/mobile/components/EmptyMealSlotRow.tsx")).toMatch(/plan-slot-aim-/);
  });

  it("both Plan surfaces source the per-slot target from slotMacroTargets (static dietitian ratio)", () => {
    for (const src of [WEB_PLAN, MOBILE_PLAN]) {
      expect(src).toMatch(/slotMacroTargets\(/);
    }
  });
});

describe("ENG-1100 — web EmptyMealSlotRow extract", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

  it("exports a shared module consumed by Today + Plan on web", () => {
    expect(read("src/app/components/suppr/empty-meal-slot-row.tsx")).toMatch(
      /export function EmptyMealSlotAimLine/,
    );
    expect(read("src/app/components/suppr/today-meals-section.tsx")).toMatch(
      /EmptyMealSlotAimLine/,
    );
    expect(read("src/app/components/MealPlanner.tsx")).toMatch(/PlanAbsentMealSlotRow/);
  });

  it("exports a shared module consumed by Today + Plan on mobile", () => {
    expect(read("apps/mobile/components/EmptyMealSlotRow.tsx")).toMatch(
      /export function EmptyMealSlotAimLine/,
    );
    expect(read("apps/mobile/components/today/TodayMealsSection.tsx")).toMatch(
      /EmptyMealSlotAimLine/,
    );
    expect(read("apps/mobile/app/(tabs)/planner.tsx")).toMatch(/EmptyMealSlotAimLine/);
  });
});
