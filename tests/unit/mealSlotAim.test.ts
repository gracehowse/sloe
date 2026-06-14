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
import { emptySlotAimKcal, aimKcalLabel } from "../../src/lib/nutrition/mealSlotAim";

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
    for (const src of [WEB, MOBILE]) {
      expect(src).toMatch(/emptySlotAimKcal/);
      expect(src).toMatch(/aimKcalLabel/);
      expect(src).toMatch(/isFeatureEnabled\("plan_today_aim_empty_v1"\)/);
      expect(src).toMatch(/today-slot-aim-/);
    }
  });

  it("mobile drops the 0.55 empty-slot dim when the flag is on", () => {
    expect(MOBILE).toMatch(/hasMeals \|\| aimEmptyOn \? 1 : 0\.55/);
  });
});
