/**
 * ENG-793 floor-leak fix — `clampTargetToSafetyFloor` + `coerceSex`.
 *
 * The sex-aware safety floor (`safetyFloorFor`: 1500 M / 1200 F / 1350
 * unspecified) was enforced ONLY on the weekly-check-in suggestion preview, so a
 * stored sub-floor target (e.g. 901) reached the Today ring on both platforms.
 * These helpers are the READ-time guard applied at the effective-target
 * resolvers — mobile `resolveTargets` (`apps/mobile/lib/calcTargets.ts`) and web
 * `AppDataContext` — so BOTH platforms clamp via this single shared export
 * (parity guarantee). The clamp is monotonic: it only ever RAISES a target to
 * the floor, never lowers it, and never touches macros.
 */
import { describe, it, expect } from "vitest";
import {
  clampTargetToSafetyFloor,
  coerceSex,
  safetyFloorFor,
} from "../../src/lib/onboarding/targets.ts";

describe("ENG-793 — clampTargetToSafetyFloor (sex-aware read-time guard)", () => {
  it("raises a stored sub-floor target (901) to the sex-aware floor", () => {
    expect(clampTargetToSafetyFloor(901, "female")).toBe(1200);
    expect(clampTargetToSafetyFloor(901, "male")).toBe(1500);
    expect(clampTargetToSafetyFloor(901, "unspecified")).toBe(1350);
    // Unknown sex → null → the 1350 policy midpoint (never the 1500 male floor,
    // which would wrongly raise a legitimate female target).
    expect(clampTargetToSafetyFloor(901, null)).toBe(1350);
  });

  it("leaves above-floor targets untouched (no over-correction)", () => {
    expect(clampTargetToSafetyFloor(1800, "female")).toBe(1800);
    expect(clampTargetToSafetyFloor(1800, "male")).toBe(1800);
    // A legitimate at-floor female target is preserved exactly.
    expect(clampTargetToSafetyFloor(1200, "female")).toBe(1200);
    expect(clampTargetToSafetyFloor(1250, "female")).toBe(1250);
  });

  it("applies the higher male floor to a between-floors value", () => {
    // 1250 is fine for a woman but below the 1500 male floor.
    expect(clampTargetToSafetyFloor(1250, "male")).toBe(1500);
  });

  it("is monotonic — never lowers a target", () => {
    for (const v of [800, 1199, 1200, 1349, 1500, 2500]) {
      for (const sex of ["male", "female", "unspecified", null] as const) {
        expect(clampTargetToSafetyFloor(v, sex)).toBeGreaterThanOrEqual(v);
      }
    }
  });

  it("passes non-finite / non-positive values straight through (caller owns those paths)", () => {
    expect(clampTargetToSafetyFloor(0, "female")).toBe(0);
    expect(clampTargetToSafetyFloor(-50, "male")).toBe(-50);
    expect(clampTargetToSafetyFloor(Number.NaN, "female")).toBeNaN();
  });

  it("matches safetyFloorFor for sub-floor inputs across every sex", () => {
    for (const sex of ["male", "female", "unspecified", null] as const) {
      expect(clampTargetToSafetyFloor(1, sex)).toBe(safetyFloorFor(sex));
    }
  });
});

describe("ENG-793 — coerceSex (raw profiles.sex → Sex | null)", () => {
  it("passes the three canonical values through", () => {
    expect(coerceSex("male")).toBe("male");
    expect(coerceSex("female")).toBe("female");
    expect(coerceSex("unspecified")).toBe("unspecified");
  });

  it("maps anything unrecognised / missing to null (→ 1350 floor, never male)", () => {
    for (const raw of ["MALE", "m", "Female", "", "other", null, undefined]) {
      expect(coerceSex(raw)).toBeNull();
    }
  });
});
