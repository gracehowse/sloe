/**
 * Action 13 Item #9 (2026-04-19) — pin the "Closest to target"
 * selection rule (replaces the prior "highest protein" rule).
 *
 * The day with the smallest summed normalised L1 deviation across the
 * day's macros wins, gated on ≥80% of macro targets logged. Tie →
 * most recent date.
 */
import { describe, expect, it } from "vitest";

import { selectClosestToTargetDay } from "../../src/lib/nutrition/weeklyRecap";

type Day = {
  key: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
};

const targets = {
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 70,
};

function day(key: string, label: string, c: number, p: number, cb: number, f: number): Day {
  return { key, label, calories: c, protein: p, carbs: cb, fat: f, ...targets };
}

describe("selectClosestToTargetDay (Item #9)", () => {
  it("(a) eligible day with smallest deviation wins", () => {
    // Day A is dead-on target. Day B is way over. A should win.
    const a = day("2026-04-08", "Wed", 2000, 150, 200, 70);
    const b = day("2026-04-10", "Fri", 3000, 250, 350, 120);
    const winner = selectClosestToTargetDay([a, b]);
    expect(winner?.key).toBe("2026-04-08");
  });

  it("(b) high-protein day with high deficit doesn't win over a balanced day", () => {
    // Old "best day" rule (highest protein) would crown B. New rule
    // crowns A because B is starved on calories/carbs/fat.
    const a = day("2026-04-08", "Wed", 1950, 145, 195, 68); // tiny deviation across all
    const b = day("2026-04-10", "Fri", 1100, 220, 80, 30); // huge protein, big deficit elsewhere
    const winner = selectClosestToTargetDay([a, b]);
    expect(winner?.key).toBe("2026-04-08");
  });

  it("(c) day below 80% logged is excluded", () => {
    // Eligibility floor — when 4 macros have targets, 4 × 0.8 → 4
    // (ceil), so all 4 must be logged. A protein-only day is excluded.
    const protein_only = day("2026-04-08", "Wed", 0, 150, 0, 0);
    const balanced = day("2026-04-10", "Fri", 1700, 130, 180, 60);
    const winner = selectClosestToTargetDay([protein_only, balanced]);
    expect(winner?.key).toBe("2026-04-10");
  });

  it("(d) all days below 80% → suppressed entirely", () => {
    const protein_only = day("2026-04-08", "Wed", 0, 150, 0, 0);
    const carbs_only = day("2026-04-09", "Thu", 0, 0, 200, 0);
    expect(selectClosestToTargetDay([protein_only, carbs_only])).toBeNull();
  });

  it("(e) tie → most recent date wins", () => {
    // Two days with identical macros + identical targets → identical
    // score. Tie-break on key (later wins).
    const a = day("2026-04-08", "Wed", 1900, 140, 190, 65);
    const b = day("2026-04-12", "Sun", 1900, 140, 190, 65);
    const winner = selectClosestToTargetDay([a, b]);
    expect(winner?.key).toBe("2026-04-12");
  });

  it("(f) no targets set → suppressed", () => {
    const noTargets: Day = {
      key: "2026-04-08",
      label: "Wed",
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 70,
      targetCalories: 0,
      targetProtein: 0,
      targetCarbs: 0,
      targetFat: 0,
    };
    expect(selectClosestToTargetDay([noTargets])).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(selectClosestToTargetDay([])).toBeNull();
  });

  it("excludes days with zero food (calories <= 0)", () => {
    const empty = day("2026-04-08", "Wed", 0, 0, 0, 0);
    const eaten = day("2026-04-10", "Fri", 1900, 140, 190, 65);
    const winner = selectClosestToTargetDay([empty, eaten]);
    expect(winner?.key).toBe("2026-04-10");
  });

  it("preserves the macros of the winning day on the returned object", () => {
    const a = day("2026-04-08", "Wed", 1950, 148, 195, 68);
    const winner = selectClosestToTargetDay([a]);
    expect(winner).toEqual({
      key: "2026-04-08",
      label: "Wed",
      calories: 1950,
      protein: 148,
    });
  });
});
