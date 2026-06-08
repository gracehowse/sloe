/**
 * ENG-758 — real weigh-in count in the trailing 7-day window
 * (`countWeighInDaysInWindow`, replaces the adaptiveTdeeConfidence-tier proxy).
 *
 * Note (2026-06-08): the Today "Adaptive TDEE learning · N of 7 days" line was
 * removed from the hero to match Figma `654:2`. This count helper is still
 * wired (the host passes it as `tdeeLearnDays` for call-site stability and the
 * learning state is surfaced on Progress), so its behaviour stays pinned here.
 */
import { describe, it, expect } from "vitest";
import { countWeighInDaysInWindow } from "../../src/lib/nutrition/weighInDays.ts";

const TODAY = "2026-06-02"; // window (7d) = 2026-05-27 .. 2026-06-02

describe("countWeighInDaysInWindow (ENG-758)", () => {
  it("returns 0 for a null/empty map", () => {
    expect(countWeighInDaysInWindow(null, TODAY)).toBe(0);
    expect(countWeighInDaysInWindow({}, TODAY)).toBe(0);
  });

  it("counts distinct weigh-in days inside the 7-day window", () => {
    const map = {
      "2026-06-02": 70.0, // today — in
      "2026-06-01": 70.1, // in
      "2026-05-28": 70.2, // in
    };
    expect(countWeighInDaysInWindow(map, TODAY)).toBe(3);
  });

  it("excludes weigh-ins older than the window", () => {
    const map = {
      "2026-06-02": 70.0, // in
      "2026-05-26": 70.5, // 1 day before the window start (05-27) — out
      "2026-05-20": 71.0, // out
    };
    expect(countWeighInDaysInWindow(map, TODAY)).toBe(1);
  });

  it("ignores zero / non-finite / non-number values", () => {
    const map = {
      "2026-06-02": 0, // not a real weigh-in
      "2026-06-01": Number.NaN as unknown as number,
      "2026-05-31": 69.8, // the only real one
    };
    expect(countWeighInDaysInWindow(map, TODAY)).toBe(1);
  });

  it("never exceeds the window size", () => {
    const map: Record<string, number> = {};
    // 10 consecutive days of weigh-ins, but a 7-day window caps at 7.
    for (let i = 0; i < 10; i++) {
      const key = i === 0 ? TODAY : `2026-05-${String(33 - i).padStart(2, "0")}`;
      map[key] = 70 + i;
    }
    expect(countWeighInDaysInWindow(map, TODAY, 7)).toBeLessThanOrEqual(7);
  });
});
