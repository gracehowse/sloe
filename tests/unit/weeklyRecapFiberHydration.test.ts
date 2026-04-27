/**
 * B1 (2026-04-27) — pin the fibre + hydration adherence rollups added
 * to the weekly recap shape, push body formatter, and route-side
 * payload helpers. Spec:
 * docs/specs/2026-04-27-b1-weekly-fiber-hydration-rollups.md.
 */
import { describe, it, expect } from "vitest";
import {
  buildWeeklyRecap,
  type WeeklyRecap,
} from "../../src/lib/nutrition/weeklyRecap";
import {
  formatWeeklyRecapPushBody,
  PUSH_BODY_MAX_CHARS,
} from "../../src/lib/nutrition/weeklyRecapPushBody";
import {
  entriesToFiberByDay,
  parseHydrationByDay,
  type NutritionEntryRow,
} from "../../src/lib/push/weeklyRecapPayload";

// Anchor "now" mid-day on Sunday 2026-04-26 so the previous-week
// snapshot covers Mon 2026-04-13 .. Sun 2026-04-19 (monday-start) /
// Sun 2026-04-12 .. Sat 2026-04-18 (sunday-start).
const NOW = new Date("2026-04-26T12:00:00Z");

const PREVIOUS_WEEK_KEYS_MONDAY_START = [
  "2026-04-13",
  "2026-04-14",
  "2026-04-15",
  "2026-04-16",
  "2026-04-17",
  "2026-04-18",
  "2026-04-19",
] as const;

function buildByDay(): Record<string, Array<{ calories: number; protein: number; carbs: number; fat: number; name: string; recipeTitle: string }>> {
  // Two days with food, three without. Enough to exit the zero-days
  // guard but stay below the cascade Rule 3 (≥4 days) threshold.
  return {
    "2026-04-13": [{ calories: 600, protein: 40, carbs: 60, fat: 20, name: "Lunch", recipeTitle: "Salad" }],
    "2026-04-14": [{ calories: 700, protein: 45, carbs: 70, fat: 25, name: "Dinner", recipeTitle: "Stir fry" }],
  };
}

describe("buildWeeklyRecap — fibre adherence (B1)", () => {
  it("sums fibre across logged days and divides by days-with-food", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70, fiber: 30 },
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      fiberByDay: {
        "2026-04-13": 8,
        "2026-04-14": 12,
        // Days with no fibre entry are correctly skipped.
      },
      now: NOW,
    });
    // (8 + 12) / 2 days = 10g/day
    expect(recap.avgFiberG).toBe(10);
    // 10 / 30 = 33.33% → rounded to 33
    expect(recap.fiberAdherencePct).toBe(33);
  });

  it("reports 0 when fibre target is unset (suppression signal for the formatter)", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70 }, // no fiber
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      fiberByDay: { "2026-04-13": 8 },
      now: NOW,
    });
    expect(recap.fiberAdherencePct).toBe(0);
  });

  it("reports 0 when no fibre entries exist (avg = 0 → adherence = 0)", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70, fiber: 30 },
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      // No fiberByDay supplied
      now: NOW,
    });
    expect(recap.avgFiberG).toBe(0);
    expect(recap.fiberAdherencePct).toBe(0);
  });
});

describe("buildWeeklyRecap — hydration adherence (B1)", () => {
  it("rolls hydration across all 7 days (not just days-with-food)", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70, hydrationMl: 2000 },
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      hydrationByDay: {
        "2026-04-13": 2100,
        "2026-04-14": 1800,
        "2026-04-15": 2200,
        "2026-04-16": 1900,
        // Three days with no hydration — averaged across all 7
      },
      now: NOW,
    });
    // (2100 + 1800 + 2200 + 1900) / 7 days = 8000 / 7 = 1142.857... → 1143
    expect(recap.avgHydrationMl).toBe(1143);
  });

  it("counts days where hydration ≥ 90% of target", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70, hydrationMl: 2000 },
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      hydrationByDay: {
        "2026-04-13": 2100, // ≥ 1800 ✓
        "2026-04-14": 1800, // = 1800 ✓ (exactly 90%)
        "2026-04-15": 1799, // < 1800 ✗
        "2026-04-16": 2000, // ≥ 1800 ✓
        // 3 days unset → ✗
      },
      now: NOW,
    });
    expect(recap.hydrationDaysOnTarget).toBe(3);
  });

  it("reports 0 hydrationDaysOnTarget when target is unset", () => {
    const recap = buildWeeklyRecap({
      byDay: buildByDay(),
      weightKgByDay: {},
      targets: { calories: 2000, protein: 130, carbs: 250, fat: 70 },
      weekStartDay: "monday",
      ledger: { earnedAt: [], usedHistory: [] },
      budgetMax: 3,
      hydrationByDay: {
        "2026-04-13": 5000, // ridiculously high — without target, doesn't count
      },
      now: NOW,
    });
    expect(recap.hydrationDaysOnTarget).toBe(0);
    // Average still computes — that's an honest signal regardless of target.
    // 5000 / 7 = 714
    expect(recap.avgHydrationMl).toBe(714);
  });
});

describe("formatWeeklyRecapPushBody — with_adherence variant (B1)", () => {
  function recapStub(overrides: Partial<WeeklyRecap> = {}): WeeklyRecap {
    return {
      weekKey: "2026-W16",
      weekLabel: "Apr 13 – Apr 19",
      daysLogged: 5,
      avgCalories: 1850,
      avgProtein: 110,
      proteinAdherencePct: 85,
      streakLength: 5,
      freezesAvailable: 1,
      bestDay: null,
      weightDeltaKg: null,
      weightFirstKg: null,
      weightLastKg: null,
      avgFiberG: 0,
      fiberAdherencePct: 0,
      avgHydrationMl: 0,
      hydrationDaysOnTarget: 0,
      ...overrides,
    };
  }

  it("appends fibre tail when only fibre target is set + on-target", () => {
    const out = formatWeeklyRecapPushBody(recapStub({ fiberAdherencePct: 78 }));
    expect(out.variant).toBe("with_adherence");
    expect(out.body).toContain("Fibre 78%");
    expect(out.body).not.toContain("Hydration");
  });

  it("appends hydration tail when only hydration target is set + on-target", () => {
    const out = formatWeeklyRecapPushBody(recapStub({ hydrationDaysOnTarget: 4 }));
    expect(out.variant).toBe("with_adherence");
    expect(out.body).toContain("Hydration 4/7 days");
    expect(out.body).not.toContain("Fibre");
  });

  it("appends both when both targets set + on-target", () => {
    const out = formatWeeklyRecapPushBody(
      recapStub({ fiberAdherencePct: 78, hydrationDaysOnTarget: 4 }),
    );
    expect(out.variant).toBe("with_adherence");
    expect(out.body).toContain("Fibre 78%");
    expect(out.body).toContain("Hydration 4/7 days");
  });

  it("falls back to calories_only when neither target is set", () => {
    const out = formatWeeklyRecapPushBody(recapStub());
    expect(out.variant).toBe("calories_only");
    expect(out.body).not.toContain("Fibre");
    expect(out.body).not.toContain("Hydration");
  });

  it("never exceeds the APNs body length cap even with the tail", () => {
    const out = formatWeeklyRecapPushBody(
      recapStub({
        fiberAdherencePct: 99,
        hydrationDaysOnTarget: 7,
        weightDeltaKg: -0.4,
        weightFirstKg: 78.4,
        weightLastKg: 78.0,
      }),
    );
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX_CHARS);
  });

  it("zero_days fallback is never decorated with the adherence tail", () => {
    const out = formatWeeklyRecapPushBody(
      recapStub({ daysLogged: 0, fiberAdherencePct: 78, hydrationDaysOnTarget: 4 }),
    );
    expect(out.variant).toBe("zero_days");
    expect(out.body).not.toContain("Fibre");
    expect(out.body).not.toContain("Hydration");
  });
});

describe("payload helpers — entriesToFiberByDay + parseHydrationByDay (B1)", () => {
  const rows: NutritionEntryRow[] = [
    { user_id: "u1", date_key: "2026-04-13", calories: 500, protein: 30, carbs: 50, fat: 15, fiber_g: 6 },
    { user_id: "u1", date_key: "2026-04-13", calories: 200, protein: 10, carbs: 25, fat: 5, fiber_g: 4 },
    { user_id: "u1", date_key: "2026-04-14", calories: 700, protein: 50, carbs: 70, fat: 20, fiber_g: 12 },
    // Different user — must be filtered out.
    { user_id: "u2", date_key: "2026-04-13", calories: 400, protein: 20, carbs: 40, fat: 10, fiber_g: 99 },
    // Out-of-window — must be filtered out.
    { user_id: "u1", date_key: "2026-04-01", calories: 500, protein: 30, carbs: 50, fat: 15, fiber_g: 5 },
    // Null fiber — skipped (no negative contribution).
    { user_id: "u1", date_key: "2026-04-15", calories: 300, protein: 15, carbs: 30, fat: 8, fiber_g: null },
  ];

  it("sums per-meal fibre per (user, day) within the window", () => {
    const out = entriesToFiberByDay(rows, "u1", PREVIOUS_WEEK_KEYS_MONDAY_START);
    expect(out["2026-04-13"]).toBe(10); // 6 + 4
    expect(out["2026-04-14"]).toBe(12);
    // Null fiber day omitted entirely
    expect(out["2026-04-15"]).toBeUndefined();
    // Other-user / out-of-window leakage check
    expect(Object.keys(out).sort()).toEqual(["2026-04-13", "2026-04-14"]);
  });

  it("parseHydrationByDay tolerates null + non-object + corrupted values", () => {
    expect(parseHydrationByDay(null)).toEqual({});
    expect(parseHydrationByDay(undefined)).toEqual({});
    expect(parseHydrationByDay("not an object")).toEqual({});
    expect(parseHydrationByDay([1, 2, 3])).toEqual({});
    expect(parseHydrationByDay({ "2026-04-13": "abc" })).toEqual({});
  });

  it("parseHydrationByDay returns the populated map for valid input", () => {
    const out = parseHydrationByDay({
      "2026-04-13": 2100,
      "2026-04-14": 1800,
      "2026-04-15": 0, // skipped (≤ 0 = no log)
      "2026-04-16": "1500", // numeric strings coerced
    });
    expect(out).toEqual({
      "2026-04-13": 2100,
      "2026-04-14": 1800,
      "2026-04-16": 1500,
    });
  });
});
