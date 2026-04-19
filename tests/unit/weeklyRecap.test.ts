/**
 * Unit tests for the shared weekly-recap helper (Batch 4.11).
 */
import { describe, expect, it } from "vitest";

import {
  buildWeeklyRecap,
  formatRecapForShare,
  nextRecapFireDate,
  shouldShowRecap,
  weekKeyFor,
} from "../../src/lib/nutrition/weeklyRecap";
import type { FreezeLedger } from "../../src/lib/nutrition/streakFreeze";

const EMPTY_LEDGER: FreezeLedger = { earnedAt: [], usedHistory: [] };
const TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

function meal(cals: number, protein = 30) {
  return { calories: cals, protein, carbs: 40, fat: 15 };
}

describe("weekKeyFor", () => {
  it("produces a stable YYYY-Www key", () => {
    // Wed 8 Apr 2026 → Monday week start → Mon 6 Apr 2026 → day of year ~96 → week 14.
    const key = weekKeyFor(new Date(2026, 3, 8, 12, 0, 0), "monday");
    expect(key).toMatch(/^2026-W\d{2}$/);
  });

  it("differs between monday-start and sunday-start at the boundary", () => {
    // Sun 12 Apr 2026: Monday-start week starts Mon 6; Sunday-start week starts Sun 12.
    const d = new Date(2026, 3, 12, 12, 0, 0);
    const mon = weekKeyFor(d, "monday");
    const sun = weekKeyFor(d, "sunday");
    expect(mon).not.toBe(sun);
  });

  it("is stable across times within the same day", () => {
    const morning = weekKeyFor(new Date(2026, 3, 8, 6, 0, 0), "monday");
    const night = weekKeyFor(new Date(2026, 3, 8, 23, 0, 0), "monday");
    expect(morning).toBe(night);
  });
});

describe("buildWeeklyRecap", () => {
  it("builds the happy path with 7 logged days", () => {
    // Current week is Mon 13 Apr – Sun 19 Apr 2026. Recap covers the
    // PREVIOUS week, so we seed Mon 6 Apr – Sun 12 Apr with meals.
    const now = new Date(2026, 3, 15, 12, 0, 0); // Wed 15 Apr
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    const keys = [
      "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09",
      "2026-04-10", "2026-04-11", "2026-04-12",
    ];
    for (const k of keys) byDay[k] = [meal(2000, 150)];

    const recap = buildWeeklyRecap({
      byDay,
      weightKgByDay: {},
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });

    expect(recap.daysLogged).toBe(7);
    expect(recap.avgCalories).toBe(2000);
    expect(recap.avgProtein).toBe(150);
    expect(recap.proteinAdherencePct).toBe(100);
    expect(recap.bestDay).not.toBeNull();
    expect(recap.weightDeltaKg).toBeNull();
    expect(recap.weekLabel).toBe("Apr 6 – Apr 12");
  });

  it("averages only over logged days for a partial week", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const byDay = {
      "2026-04-06": [meal(1500, 100)],
      "2026-04-08": [meal(2100, 160)],
      "2026-04-10": [meal(1800, 130)],
    };
    const recap = buildWeeklyRecap({
      byDay,
      weightKgByDay: {},
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    expect(recap.daysLogged).toBe(3);
    expect(recap.avgCalories).toBe(1800);
    expect(recap.avgProtein).toBe(130);
  });

  it("reports weightDeltaKg=null when fewer than 2 weigh-ins", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const byDay = { "2026-04-06": [meal(1500)] };
    const r1 = buildWeeklyRecap({
      byDay,
      weightKgByDay: {},
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    expect(r1.weightDeltaKg).toBeNull();

    const r2 = buildWeeklyRecap({
      byDay,
      weightKgByDay: { "2026-04-08": 80 },
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    expect(r2.weightDeltaKg).toBeNull();
  });

  it("computes weightDeltaKg rounded to 0.1 kg when ≥2 weigh-ins", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const byDay = { "2026-04-06": [meal(1500)], "2026-04-12": [meal(2000)] };
    const recap = buildWeeklyRecap({
      byDay,
      weightKgByDay: { "2026-04-06": 80.4, "2026-04-12": 79.8 },
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    // 79.8 - 80.4 = -0.6 exactly (to 0.1 kg precision).
    expect(recap.weightDeltaKg).toBeCloseTo(-0.6, 1);
  });

  it("picks the highest-protein day as bestDay", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const byDay = {
      "2026-04-06": [meal(2000, 100)],
      "2026-04-08": [meal(2100, 180)],
      "2026-04-10": [meal(1800, 120)],
    };
    const recap = buildWeeklyRecap({
      byDay,
      weightKgByDay: {},
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    expect(recap.bestDay?.key).toBe("2026-04-08");
    expect(recap.bestDay?.protein).toBe(180);
  });

  it("returns zeroes when the previous week had no logs", () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const recap = buildWeeklyRecap({
      byDay: {},
      weightKgByDay: {},
      targets: TARGETS,
      weekStartDay: "monday",
      ledger: EMPTY_LEDGER,
      budgetMax: 3,
      now,
    });
    expect(recap.daysLogged).toBe(0);
    expect(recap.avgCalories).toBe(0);
    expect(recap.bestDay).toBeNull();
  });
});

describe("shouldShowRecap", () => {
  // Monday-start user: week ends Sunday; recap window = Sun ≥18:00 OR
  // Mon/Tue/Wed of the following week.
  it("is false mid-week (Thursday) for monday-start", () => {
    const thursday = new Date(2026, 3, 16, 10, 0, 0); // Thu 16 Apr
    expect(shouldShowRecap(null, "2026-W15", thursday, "monday")).toBe(false);
  });

  it("is true on Sunday evening for monday-start", () => {
    const sun18 = new Date(2026, 3, 12, 18, 0, 0); // Sun 12 Apr 18:00
    expect(shouldShowRecap(null, "2026-W14", sun18, "monday")).toBe(true);
  });

  it("is true early in the following week for monday-start", () => {
    const mon = new Date(2026, 3, 13, 10, 0, 0); // Mon 13 Apr
    expect(shouldShowRecap(null, "2026-W15", mon, "monday")).toBe(true);
  });

  it("suppresses when already seen this week", () => {
    const mon = new Date(2026, 3, 13, 10, 0, 0);
    expect(shouldShowRecap("2026-W15", "2026-W15", mon, "monday")).toBe(false);
  });

  it("shows again after the week-key flips", () => {
    const nextWeekMon = new Date(2026, 3, 20, 10, 0, 0);
    // User dismissed last week's (W15); now we're in W16.
    expect(shouldShowRecap("2026-W15", "2026-W16", nextWeekMon, "monday")).toBe(true);
  });

  it("for sunday-start users, fires Sat 18:00", () => {
    const sat18 = new Date(2026, 3, 11, 18, 0, 0); // Sat 11 Apr 18:00
    expect(shouldShowRecap(null, "2026-W14", sat18, "sunday")).toBe(true);
    // But at Sat morning it's still too early.
    const satAm = new Date(2026, 3, 11, 9, 0, 0);
    expect(shouldShowRecap(null, "2026-W14", satAm, "sunday")).toBe(false);
  });

  it("does not depend on weekly_recap_push_enabled (H6 audit, 2026-04-18)", () => {
    // The Settings toggle shipped on 2026-04-18 controls the mobile push
    // only — the Progress / Today recap card must keep appearing based
    // solely on `shouldShowRecap`. This test pins the contract by
    // exercising the helper identically for both flag states (the flag
    // is deliberately not an argument) and asserting the visibility
    // verdict is unchanged.
    const sun18 = new Date(2026, 3, 12, 18, 0, 0); // Sun 12 Apr 18:00
    const pushStates = [true, false] as const;
    for (const _pushEnabled of pushStates) {
      // The helper has no knob for the push flag, which is exactly the
      // point — so we simply run it and confirm the verdict does not
      // change across the two conceptual settings. Using `_pushEnabled`
      // keeps the parity intent documented in the test body.
      expect(shouldShowRecap(null, "2026-W14", sun18, "monday")).toBe(true);
      expect(shouldShowRecap("2026-W14", "2026-W14", sun18, "monday")).toBe(false);
    }
    // Sanity check that suppressing the Sunday-evening visibility window
    // still requires the same-week dismiss — nothing about the push
    // toggle could have landed us here by mistake.
    const thu = new Date(2026, 3, 16, 10, 0, 0);
    expect(shouldShowRecap(null, "2026-W15", thu, "monday")).toBe(false);
  });
});

describe("nextRecapFireDate", () => {
  it("picks next Sunday 18:00 for monday-start users when called mid-week", () => {
    // Thu 16 Apr 2026 10:00 local.
    const thu = new Date(2026, 3, 16, 10, 0, 0);
    const fire = nextRecapFireDate("monday", thu);
    expect(fire.getDay()).toBe(0); // Sunday
    expect(fire.getHours()).toBe(18);
    expect(fire.getMinutes()).toBe(0);
  });

  it("rolls forward to the following week if we're already past the target time", () => {
    // Sun 12 Apr 2026 19:00 local — target time was 18:00 today.
    const sunEvening = new Date(2026, 3, 12, 19, 0, 0);
    const fire = nextRecapFireDate("monday", sunEvening);
    // Next Sunday is 19 Apr 2026.
    expect(fire.getDate()).toBe(19);
    expect(fire.getMonth()).toBe(3);
  });

  it("picks next Saturday 18:00 for sunday-start users", () => {
    const tue = new Date(2026, 3, 14, 10, 0, 0);
    const fire = nextRecapFireDate("sunday", tue);
    expect(fire.getDay()).toBe(6); // Saturday
    expect(fire.getHours()).toBe(18);
  });
});

describe("formatRecapForShare", () => {
  it("produces a compact multi-line summary", () => {
    const txt = formatRecapForShare({
      weekKey: "2026-W14",
      weekLabel: "Apr 6 – Apr 12",
      daysLogged: 6,
      avgCalories: 1850,
      avgProtein: 140,
      proteinAdherencePct: 93,
      streakLength: 12,
      freezesAvailable: 1,
      bestDay: { key: "2026-04-08", label: "Wed", calories: 2000, protein: 180 },
      weightDeltaKg: -0.4,
      // Action 13 Item #13 (2026-04-19) — `weightFirstKg` /
      // `weightLastKg` are populated by `buildWeeklyRecap`. Test
      // doubles supply matching values so the WeeklyRecap shape stays
      // valid; the share-string formatter doesn't read them.
      weightFirstKg: 78.4,
      weightLastKg: 78.0,
    });
    expect(txt).toContain("My week on Suppr");
    expect(txt).toContain("6/7 days logged");
    expect(txt).toContain("1850 kcal");
    expect(txt).toContain("12-day streak");
    expect(txt).toContain("Closest to target: Wed — 180g protein");
    expect(txt).toContain("-0.4 kg");
  });

  it("omits the weight line when weightDeltaKg is null", () => {
    const txt = formatRecapForShare({
      weekKey: "2026-W14",
      weekLabel: "Apr 6 – Apr 12",
      daysLogged: 3,
      avgCalories: 1800,
      avgProtein: 130,
      proteinAdherencePct: 87,
      streakLength: 3,
      freezesAvailable: 0,
      bestDay: null,
      weightDeltaKg: null,
      weightFirstKg: null,
      weightLastKg: null,
    });
    expect(txt).not.toContain("Weight:");
  });
});
