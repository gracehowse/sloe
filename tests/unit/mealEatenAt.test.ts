import { describe, expect, it } from "vitest";
import {
  compareMealsByChronology,
  dateKeyFromInstant,
  eatenAtIsoFromLocalParts,
  formatMealTimeFromChronology,
  mealChronologyInstantIso,
  mealChronologyMs,
} from "../../src/lib/nutrition/mealEatenAt";

describe("mealEatenAt (ENG-772)", () => {
  it("prefers eatenAt over createdAt for chronology", () => {
    expect(
      mealChronologyInstantIso({
        eatenAt: "2026-06-11T22:30:00.000Z",
        createdAt: "2026-06-12T08:00:00.000Z",
      }),
    ).toBe("2026-06-11T22:30:00.000Z");
  });

  it("falls back to createdAt when eatenAt is absent", () => {
    expect(mealChronologyInstantIso({ createdAt: "2026-06-12T08:00:00.000Z" })).toBe(
      "2026-06-12T08:00:00.000Z",
    );
  });

  it("sorts meals ascending by chronology ms", () => {
    const early = { eatenAt: "2026-06-12T08:00:00.000Z" };
    const late = { createdAt: "2026-06-12T20:00:00.000Z" };
    expect(compareMealsByChronology(early, late)).toBeLessThan(0);
    expect(mealChronologyMs(late)).toBeGreaterThan(mealChronologyMs(early));
  });

  it("dateKeyFromInstant uses local calendar day (cross-day gate)", () => {
    // 23:30 UTC on Jun 11 can be Jun 12 in positive-offset zones; pin a
    // deterministic local construction instead.
    const iso = eatenAtIsoFromLocalParts("2026-06-11", 23, 30);
    expect(dateKeyFromInstant(iso)).toBe("2026-06-11");
    const nextDay = eatenAtIsoFromLocalParts("2026-06-12", 0, 30);
    expect(dateKeyFromInstant(nextDay)).toBe("2026-06-12");
  });

  it("formatMealTimeFromChronology returns a non-empty label when instant exists", () => {
    const label = formatMealTimeFromChronology({
      eatenAt: eatenAtIsoFromLocalParts("2026-06-12", 12, 45),
    });
    expect(label.length).toBeGreaterThan(0);
  });
});
