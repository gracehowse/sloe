import { describe, expect, it } from "vitest";
import {
  coerceSharePreset,
  DEFAULT_SHARE_PRESET,
  isWeekend,
  slotAllowedForPreset,
  SHARE_PRESET_VALUES,
} from "@/lib/household/sharePresetFilter";

const MON = "2026-05-04"; // Monday
const TUE = "2026-05-05";
const SAT = "2026-05-02"; // Saturday
const SUN = "2026-05-03"; // Sunday

describe("sharePresetFilter", () => {
  it("knows weekdays vs weekends", () => {
    expect(isWeekend(MON)).toBe(false);
    expect(isWeekend(TUE)).toBe(false);
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SUN)).toBe(true);
  });

  it("'all' preset allows every canonical slot", () => {
    for (const d of [MON, SAT]) {
      for (const label of ["breakfast", "lunch", "dinner", "snack"]) {
        expect(slotAllowedForPreset("all", d, label)).toBe(true);
      }
    }
  });

  it("'all' preset rejects non-canonical labels (never shared)", () => {
    expect(slotAllowedForPreset("all", MON, "brunch")).toBe(false);
    expect(slotAllowedForPreset("all", MON, null)).toBe(false);
    expect(slotAllowedForPreset("all", MON, "")).toBe(false);
  });

  it("'dinners' preset allows only dinner", () => {
    expect(slotAllowedForPreset("dinners", MON, "dinner")).toBe(true);
    expect(slotAllowedForPreset("dinners", MON, "lunch")).toBe(false);
    expect(slotAllowedForPreset("dinners", SAT, "lunch")).toBe(false);
    expect(slotAllowedForPreset("dinners", SAT, "breakfast")).toBe(false);
  });

  it("'dinners_weekends' allows only dinner on weekdays, all canonical slots on weekends", () => {
    expect(slotAllowedForPreset("dinners_weekends", MON, "dinner")).toBe(true);
    expect(slotAllowedForPreset("dinners_weekends", MON, "lunch")).toBe(false);
    expect(slotAllowedForPreset("dinners_weekends", MON, "breakfast")).toBe(false);

    expect(slotAllowedForPreset("dinners_weekends", SAT, "breakfast")).toBe(true);
    expect(slotAllowedForPreset("dinners_weekends", SAT, "lunch")).toBe(true);
    expect(slotAllowedForPreset("dinners_weekends", SAT, "dinner")).toBe(true);
    expect(slotAllowedForPreset("dinners_weekends", SUN, "snack")).toBe(true);
  });

  it("'lunch_dinner' allows lunch + dinner only, any day", () => {
    for (const d of [MON, SAT]) {
      expect(slotAllowedForPreset("lunch_dinner", d, "lunch")).toBe(true);
      expect(slotAllowedForPreset("lunch_dinner", d, "dinner")).toBe(true);
      expect(slotAllowedForPreset("lunch_dinner", d, "breakfast")).toBe(false);
      expect(slotAllowedForPreset("lunch_dinner", d, "snack")).toBe(false);
    }
  });

  it("'custom' preset honours the per-cell grid; missing cell rejects", () => {
    const grid = {
      [MON]: { dinner: true, lunch: false },
      [SAT]: { breakfast: true },
    };
    expect(slotAllowedForPreset("custom", MON, "dinner", grid)).toBe(true);
    expect(slotAllowedForPreset("custom", MON, "lunch", grid)).toBe(false);
    expect(slotAllowedForPreset("custom", MON, "breakfast", grid)).toBe(false);
    expect(slotAllowedForPreset("custom", SAT, "breakfast", grid)).toBe(true);
    expect(slotAllowedForPreset("custom", TUE, "dinner", grid)).toBe(false);
  });

  it("'custom' with no grid rejects everything", () => {
    expect(slotAllowedForPreset("custom", MON, "dinner")).toBe(false);
    expect(slotAllowedForPreset("custom", MON, "dinner", null)).toBe(false);
  });

  it("normalises mixed-case meal_label", () => {
    expect(slotAllowedForPreset("dinners", MON, "Dinner")).toBe(true);
    expect(slotAllowedForPreset("dinners", MON, "  DINNER  ")).toBe(true);
  });

  it("coerces unknown values to the default preset", () => {
    expect(coerceSharePreset(null)).toBe(DEFAULT_SHARE_PRESET);
    expect(coerceSharePreset(undefined)).toBe(DEFAULT_SHARE_PRESET);
    expect(coerceSharePreset("bogus")).toBe(DEFAULT_SHARE_PRESET);
    expect(coerceSharePreset("all")).toBe("all");
    expect(coerceSharePreset("custom")).toBe("custom");
  });

  it("exports the canonical five values in the documented order", () => {
    expect(SHARE_PRESET_VALUES).toEqual([
      "all",
      "dinners",
      "dinners_weekends",
      "lunch_dinner",
      "custom",
    ]);
  });
});
