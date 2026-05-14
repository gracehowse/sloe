/**
 * Fasting milestone helpers — pinned 2026-05-14 (web Fasting expansion).
 *
 * These functions back the milestone chip row + projected-end-time row
 * on the web `<FastingTimer />`. Keeping the logic pure means the
 * component can stay focused on layout while the rules below get
 * exercised here without RTL.
 */
import { describe, expect, it } from "vitest";
import {
  FASTING_MILESTONES,
  formatProjectedEndTime,
  selectUpcomingMilestones,
} from "../../src/lib/fasting/milestones";

const HOUR = 3_600_000;

describe("FASTING_MILESTONES", () => {
  it("is the canonical ordered list (8h Glycogen, 12h Ketosis, 16h Deep fast)", () => {
    expect(FASTING_MILESTONES.map((m) => m.hours)).toEqual([8, 12, 16]);
    expect(FASTING_MILESTONES.map((m) => m.label)).toEqual([
      "Glycogen",
      "Ketosis",
      "Deep fast",
    ]);
  });

  it("is in strictly ascending hour order (selectUpcomingMilestones relies on this)", () => {
    for (let i = 1; i < FASTING_MILESTONES.length; i += 1) {
      expect(FASTING_MILESTONES[i].hours).toBeGreaterThan(
        FASTING_MILESTONES[i - 1].hours,
      );
    }
  });
});

describe("selectUpcomingMilestones", () => {
  it("returns all milestones for a fresh 16h fast (elapsed=0)", () => {
    expect(selectUpcomingMilestones(0, 16).map((m) => m.hours)).toEqual([
      8, 12, 16,
    ]);
  });

  it("drops the 8h marker once 8 hours have elapsed and beyond (but still includes the exact 8h tick)", () => {
    // Exactly 8h — milestone at 8h stays visible on the tick.
    expect(
      selectUpcomingMilestones(8 * HOUR, 16).map((m) => m.hours),
    ).toEqual([8, 12, 16]);
    // 8h + 1ms — 8h chip drops off; only 12h + 16h remain.
    expect(
      selectUpcomingMilestones(8 * HOUR + 1, 16).map((m) => m.hours),
    ).toEqual([12, 16]);
  });

  it("returns the empty list once all milestones have passed", () => {
    expect(selectUpcomingMilestones(20 * HOUR, 16)).toEqual([]);
  });

  it("caps milestones by the user's chosen fast window (14:10 user never sees 16h Deep fast)", () => {
    expect(selectUpcomingMilestones(0, 14).map((m) => m.hours)).toEqual([
      8, 12,
    ]);
    // 20:4 user sees all three.
    expect(selectUpcomingMilestones(0, 20).map((m) => m.hours)).toEqual([
      8, 12, 16,
    ]);
  });

  it("treats negative elapsed values as 0 (defensive — clock skew between client + server)", () => {
    expect(
      selectUpcomingMilestones(-1000, 16).map((m) => m.hours),
    ).toEqual([8, 12, 16]);
  });

  it("returns an empty list for a non-positive fast window (no preset selected yet)", () => {
    expect(selectUpcomingMilestones(0, 0)).toEqual([]);
    expect(selectUpcomingMilestones(0, -8)).toEqual([]);
  });

  it("handles non-finite inputs defensively", () => {
    // NaN elapsed → treated as 0 (clock skew between client + server
    // must not crash the UI); 16h window still returns all three.
    expect(
      selectUpcomingMilestones(Number.NaN, 16).map((m) => m.hours),
    ).toEqual([8, 12, 16]);
    // NaN fast window → empty list (no preset set yet).
    expect(selectUpcomingMilestones(0, Number.NaN)).toEqual([]);
    // Infinite fast window also fails the isFinite guard → empty
    // list. A non-finite window is a programmer-error signal (no
    // preset selected), not a "fast forever" semantic.
    expect(selectUpcomingMilestones(0, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("returns a fresh copy of each milestone (callers can mutate without poisoning the canonical list)", () => {
    const list = selectUpcomingMilestones(0, 16);
    list[0].label = "MUTATED";
    expect(FASTING_MILESTONES[0].label).toBe("Glycogen");
  });
});

describe("formatProjectedEndTime", () => {
  it("returns start + window hours as HH:MM in the locale's short time format", () => {
    // Use a fixed ISO start in UTC then assert the formatted output
    // contains the expected hour digits — locale formatting may
    // include AM/PM, spaces, etc. so we don't pin the full string.
    const startIso = "2026-05-14T08:00:00.000Z";
    const result = formatProjectedEndTime(startIso, 16, "en-GB");
    // 08:00 UTC + 16h = 00:00 next day UTC → 01:00 BST in May. The
    // exact format depends on the locale, but the result must be
    // non-empty and contain a colon.
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns empty string for an invalid start ISO", () => {
    expect(formatProjectedEndTime("not-a-date", 16)).toBe("");
    expect(formatProjectedEndTime("", 16)).toBe("");
  });

  it("returns empty string for a non-positive fast window", () => {
    expect(formatProjectedEndTime("2026-05-14T08:00:00.000Z", 0)).toBe("");
    expect(formatProjectedEndTime("2026-05-14T08:00:00.000Z", -1)).toBe("");
  });

  it("returns empty string for non-finite fast window", () => {
    expect(formatProjectedEndTime("2026-05-14T08:00:00.000Z", Number.NaN)).toBe("");
  });
});
