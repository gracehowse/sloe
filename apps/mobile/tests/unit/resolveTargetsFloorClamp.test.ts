import { describe, expect, it } from "vitest";
import { resolveTargets } from "../../lib/calcTargets";

/**
 * ENG-793 floor-leak fix (mobile read guard). `resolveTargets` is the mobile
 * effective-target resolver feeding the Today ring. A stored sub-floor
 * `target_calories` (e.g. 901, which leaked past the suggestion-only floor) must
 * be clamped UP to the sex-aware safety floor at READ time. Macros are left
 * untouched. Web parity: the same `clampTargetToSafetyFloor` export guards
 * `AppDataContext` (pinned in `tests/unit/targetFloorLeakClamp.test.ts`).
 */

const FULL_MACROS = {
  target_calories: 901,
  target_protein: 90,
  target_carbs: 100,
  target_fat: 30,
  target_fiber_g: 25,
};

describe("resolveTargets — ENG-793 sub-floor clamp (explicit stored branch)", () => {
  it("clamps a stored 901 up to the sex-aware floor", () => {
    expect(resolveTargets(FULL_MACROS, { sex: "female" }).calories).toBe(1200);
    expect(resolveTargets(FULL_MACROS, { sex: "male" }).calories).toBe(1500);
    expect(resolveTargets(FULL_MACROS, { sex: "unspecified" }).calories).toBe(1350);
    // Missing / unrecognised sex → 1350 policy floor (never the 1500 male floor).
    expect(resolveTargets(FULL_MACROS, {}).calories).toBe(1350);
    expect(resolveTargets(FULL_MACROS, { sex: "nonbinary" }).calories).toBe(1350);
  });

  it("keeps the resolution explicit and leaves macros untouched", () => {
    const r = resolveTargets(FULL_MACROS, { sex: "female" });
    expect(r.resolution).toBe("explicit");
    expect(r.usingDefaults).toBe(false);
    expect(r.protein).toBe(90);
    expect(r.carbs).toBe(100);
    expect(r.fat).toBe(30);
    expect(r.fiber).toBe(25);
  });

  it("leaves an above-floor stored target unchanged (no over-correction)", () => {
    expect(
      resolveTargets({ ...FULL_MACROS, target_calories: 1800 }, { sex: "female" }).calories,
    ).toBe(1800);
    // A legitimate at-floor female target is preserved exactly.
    expect(
      resolveTargets({ ...FULL_MACROS, target_calories: 1250 }, { sex: "female" }).calories,
    ).toBe(1250);
    // …but the same 1250 is below the male floor, so it's raised.
    expect(
      resolveTargets({ ...FULL_MACROS, target_calories: 1250 }, { sex: "male" }).calories,
    ).toBe(1500);
  });
});
