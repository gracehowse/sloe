/**
 * F-74 / F-103 (2026-05-07) — pin per-meal `micros` as the canonical
 * SoT for food-derived caffeine / alcohol totals.
 *
 * Pre-fix shape (the bug):
 *   - log a 64mg espresso via food search →
 *     `nutrition_micros.caffeineMg = 64` written to the meal row AND
 *     `bumpStimulantsForLoggedMeal` adds 64 to
 *     `profiles.extra_caffeine_by_day[dayKey]`.
 *   - Today reads `(extraCaffeineByDay[dayKey] ?? 0) + caffeineFromMealsMg`
 *     = 64 + 64 = **128 mg displayed for a 64 mg meal**.
 *
 * Post-fix shape:
 *   - log path writes `nutrition_micros.caffeineMg` only; no ledger
 *     bump.
 *   - `extra_caffeine_by_day` ledger holds quick-add only.
 *   - delete: per-meal row removal automatically drops the contribution
 *     from `caffeineFromMealsMg` on the next render. No ledger
 *     decrement.
 *   - merge = quick-add ledger + per-meal sum, no double-count.
 *
 * Two pins:
 *  1. Behavioural — model the merge formula and assert correct totals.
 *  2. Static — assert log paths don't call the bump/decrement helpers.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

// --- Behavioural pin -----------------------------------------------------

type Meal = { micros?: { caffeineMg?: number; alcoholG?: number } };

function caffeineDisplayedToday(opts: {
  ledgerForDayMg: number;
  mealsToday: ReadonlyArray<Meal>;
}): number {
  const fromMeals = opts.mealsToday.reduce((sum, m) => {
    const v = Number(m.micros?.caffeineMg ?? 0);
    return Number.isFinite(v) && v > 0 ? sum + v : sum;
  }, 0);
  return opts.ledgerForDayMg + Math.round(fromMeals);
}

describe("F-74 / F-103 — per-meal micros canonical (no double-count)", () => {
  it("a single 64mg espresso (food-search) displays as 64, not 128", () => {
    // Post-fix: ledger holds 0 (no bump on log), per-meal sums to 64.
    expect(
      caffeineDisplayedToday({
        ledgerForDayMg: 0,
        mealsToday: [{ micros: { caffeineMg: 64 } }],
      }),
    ).toBe(64);
  });

  it("quick-add 32mg + logged 64mg meal displays as 96", () => {
    // Quick-add still writes ledger directly; per-meal still sums.
    expect(
      caffeineDisplayedToday({
        ledgerForDayMg: 32,
        mealsToday: [{ micros: { caffeineMg: 64 } }],
      }),
    ).toBe(96);
  });

  it("deleting the meal self-heals the total without ledger touch", () => {
    // After delete, the meal disappears from `mealsToday` and the
    // ledger is unchanged. Quick-add value persists.
    expect(
      caffeineDisplayedToday({
        ledgerForDayMg: 32,
        mealsToday: [],
      }),
    ).toBe(32);
  });

  it("two coffees stack from per-meal sum alone", () => {
    expect(
      caffeineDisplayedToday({
        ledgerForDayMg: 0,
        mealsToday: [
          { micros: { caffeineMg: 64 } },
          { micros: { caffeineMg: 95 } },
        ],
      }),
    ).toBe(159);
  });

  it("meal without caffeine micros contributes 0", () => {
    expect(
      caffeineDisplayedToday({
        ledgerForDayMg: 50,
        mealsToday: [{ micros: {} }, { micros: { caffeineMg: 64 } }],
      }),
    ).toBe(114);
  });
});

// --- Static pin: log paths must not bump / decrement the ledger ----------

const LOG_PATHS_NO_BUMP = [
  "apps/mobile/app/(tabs)/index.tsx",
  "apps/mobile/app/(tabs)/barcode.tsx",
  "src/context/appData/useNutritionJournalState.ts",
];

describe("F-74 / F-103 — log paths do not call bump/decrement helpers", () => {
  it.each(LOG_PATHS_NO_BUMP)("%s does not invoke bumpStimulantsForLoggedMeal*", (rel) => {
    const src = read(rel);
    // Strip block + line comments so doc references don't trip the
    // pin. We're asserting against actual call expressions.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/bumpStimulantsForLoggedMeal\s*\(/);
    expect(code).not.toMatch(/bumpStimulantsForLoggedMeals\s*\(/);
  });

  it.each(LOG_PATHS_NO_BUMP)("%s does not invoke updateStimulantsForDay (positive or negative)", (rel) => {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/updateStimulantsForDay\s*\(/);
  });
});
