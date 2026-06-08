/**
 * Shared single-letter weekday labels for the Today week strip.
 *
 * Pins the canonical Figma `654:2` treatment (single letters `S M T W T F S`,
 * NOT three-letter `Mon/Tue/Wed`) so web `DayStrip` and mobile `DayStrip` —
 * which both consume `weekdayInitials` — can't drift back to abbreviations or
 * from each other. The day NUMBER below each letter disambiguates the date,
 * which is why duplicate initials (Sat/Sun → "S", Tue/Thu → "T") are correct.
 */
import { describe, expect, it } from "vitest";
import { weekdayInitials } from "../../src/lib/today/weekdayLabels";

describe("weekdayInitials — single-letter Today week strip labels (Figma 654:2)", () => {
  it("returns Monday-first single letters", () => {
    expect(weekdayInitials("monday")).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  });

  it("returns Sunday-first single letters", () => {
    expect(weekdayInitials("sunday")).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });

  it("always returns exactly 7 labels (one per weekday tile)", () => {
    expect(weekdayInitials("monday")).toHaveLength(7);
    expect(weekdayInitials("sunday")).toHaveLength(7);
  });

  it("uses single characters only — never the old 3-letter abbreviations", () => {
    for (const start of ["monday", "sunday"] as const) {
      for (const label of weekdayInitials(start)) {
        expect(label).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("keeps the same letters across week starts, only rotated", () => {
    const mon = [...weekdayInitials("monday")].sort();
    const sun = [...weekdayInitials("sunday")].sort();
    expect(mon).toEqual(sun);
  });
});
