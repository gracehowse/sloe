/**
 * ENG-1098 "Calm mode" — the body-neutral display preference that quiets the
 * per-slot "Aim ~X kcal" numbers (ENG-1092). Client-side pref (localStorage /
 * AsyncStorage), shared key web ↔ mobile. v1 gates the aims only; named for the
 * umbrella so hide-weight / streak fold in later without a rename.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALM_MODE_STORAGE_KEY,
  DEFAULT_CALM_MODE,
  resolveCalmMode,
} from "../../src/lib/preferences/calmMode";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("resolveCalmMode", () => {
  it("defaults to off (aims show unless opted out)", () => {
    expect(DEFAULT_CALM_MODE).toBe(false);
    expect(resolveCalmMode(null)).toBe(false);
    expect(resolveCalmMode(undefined)).toBe(false);
    expect(resolveCalmMode("")).toBe(false);
    expect(resolveCalmMode("garbage")).toBe(false);
  });

  it("reads the stringified boolean from storage", () => {
    expect(resolveCalmMode("true")).toBe(true);
    expect(resolveCalmMode("false")).toBe(false);
  });

  it("accepts a native boolean (forward-compatible with a synced value)", () => {
    expect(resolveCalmMode(true)).toBe(true);
    expect(resolveCalmMode(false)).toBe(false);
  });

  it("uses one storage key across surfaces", () => {
    expect(CALM_MODE_STORAGE_KEY).toBe("suppr.prefs.calm_mode");
  });
});

describe("ENG-1098 wiring — all four aim surfaces honour Calm mode + both Settings expose it", () => {
  const AIM_SURFACES = [
    "src/app/components/suppr/today-meals-section.tsx",
    "src/app/components/MealPlanner.tsx",
    "apps/mobile/components/today/TodayMealsSection.tsx",
    "apps/mobile/app/(tabs)/planner.tsx",
  ];

  it("every aim surface reads the calm-mode pref and gates the aim on it", () => {
    for (const p of AIM_SURFACES) {
      const src = read(p);
      expect(src).toMatch(/useCalmMode/);
      expect(src).toMatch(/calmMode/);
    }
  });

  it("both web + mobile Settings expose the toggle (same testID)", () => {
    expect(read("src/app/components/Settings.tsx")).toMatch(
      /settings-calm-mode-toggle/,
    );
    expect(read("apps/mobile/components/settings/SettingsBundleContent.tsx")).toMatch(
      /settings-calm-mode-toggle/,
    );
  });
});
