import { describe, expect, it } from "vitest";
import {
  compareMealsByChronology,
  dateKeyFromInstant,
  eatenAtIsoFromLocalParts,
  formatMealTimeFromChronology,
  mealChronologyInstantIso,
  mealChronologyMs,
  eatenAtFromLogDateAndTime,
  localTimeInputValueFromIso,
  nutritionEntryDateKeyAndEatenAt,
  parseLocalTimeInput,
  reanchorEatenAtToDay,
  reanchorMealEatenAt,
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

  it("uses an explicit canonical timezone instead of the editing device timezone", () => {
    const timeZone = "America/New_York";
    const eatenAt = eatenAtIsoFromLocalParts("2026-06-11", 23, 50, timeZone);

    expect(eatenAt).toBe("2026-06-12T03:50:00.000Z");
    expect(dateKeyFromInstant(eatenAt, timeZone)).toBe("2026-06-11");
    expect(localTimeInputValueFromIso(eatenAt, timeZone)).toBe("23:50");
    expect(
      nutritionEntryDateKeyAndEatenAt({ eatenAt }, "2026-06-12", null, { timeZone }),
    ).toEqual({ dateKey: "2026-06-11", eatenAt });
  });

  it("formatMealTimeFromChronology returns a non-empty label when instant exists", () => {
    const label = formatMealTimeFromChronology({
      eatenAt: eatenAtIsoFromLocalParts("2026-06-12", 12, 45),
    });
    expect(label.length).toBeGreaterThan(0);
  });

  it("time edit stays on anchor day (no cross-day move)", () => {
    // A time-only edit always re-derives eaten_at from the anchor day, so
    // editing 23:30 → 00:30 keeps date_key on the anchor (no day crossing).
    // The optimistic cross-day move branch (dateKey !== anchorDay) is
    // intentionally unreachable from the time field — parseLocalTimeInput
    // clamps hours/minutes to 0–23 / 0–59, so the instant never leaves the
    // anchor calendar day. This test proves the *absence* of a cross-day move.
    const priorDay = "2026-06-11";
    const late = nutritionEntryDateKeyAndEatenAt({}, priorDay, { hours: 23, minutes: 30 });
    expect(late.dateKey).toBe(priorDay);
    const early = nutritionEntryDateKeyAndEatenAt(
      { eatenAt: late.eatenAt },
      priorDay,
      { hours: 0, minutes: 30 },
    );
    expect(early.dateKey).toBe(priorDay);
    expect(mealChronologyMs({ eatenAt: early.eatenAt })).toBeLessThan(
      mealChronologyMs({ eatenAt: late.eatenAt }),
    );
  });

  it("parseLocalTimeInput accepts HH:mm", () => {
    expect(parseLocalTimeInput("23:30")).toEqual({ hours: 23, minutes: 30 });
    expect(parseLocalTimeInput("bad")).toBeNull();
  });

  it("eatenAtFromLogDateAndTime builds ISO from date_key + HH:mm", () => {
    const iso = eatenAtFromLogDateAndTime("2026-06-12", "14:15");
    expect(dateKeyFromInstant(iso)).toBe("2026-06-12");
  });

  describe("reanchorEatenAtToDay — copy/duplicate day re-anchoring", () => {
    it("moves the instant to the target day, preserving local wall-clock time", () => {
      const sourceIso = eatenAtIsoFromLocalParts("2026-06-10", 8, 15);
      const reanchored = reanchorEatenAtToDay(sourceIso, "2026-06-12");
      expect(reanchored).not.toBeNull();
      expect(dateKeyFromInstant(reanchored!)).toBe("2026-06-12");
      expect(localTimeInputValueFromIso(reanchored!)).toBe("08:15");
    });

    it("same-day re-anchor is the identity", () => {
      const iso = eatenAtIsoFromLocalParts("2026-06-12", 19, 45);
      expect(reanchorEatenAtToDay(iso, "2026-06-12")).toBe(iso);
    });

    it("null / undefined / blank / malformed pass through as null", () => {
      expect(reanchorEatenAtToDay(null, "2026-06-12")).toBeNull();
      expect(reanchorEatenAtToDay(undefined, "2026-06-12")).toBeNull();
      expect(reanchorEatenAtToDay("  ", "2026-06-12")).toBeNull();
      expect(reanchorEatenAtToDay("not-a-date", "2026-06-12")).toBeNull();
    });

    it("reanchorMealEatenAt: the write path then buckets the clone to the TARGET day (the copy bug this guards)", () => {
      // A clone of a Tuesday 08:15 meal copied to Thursday must persist with
      // Thursday's date_key — before re-anchoring, the eaten-derived date_key
      // would silently bucket it back to Tuesday.
      const source = { eatenAt: eatenAtIsoFromLocalParts("2026-06-09", 8, 15) };
      const clone = reanchorMealEatenAt(source, "2026-06-11");
      const { dateKey, eatenAt } = nutritionEntryDateKeyAndEatenAt(clone, "2026-06-11");
      expect(dateKey).toBe("2026-06-11");
      expect(eatenAt).toBe(clone.eatenAt);
      expect(localTimeInputValueFromIso(eatenAt!)).toBe("08:15");
    });
  });
});
