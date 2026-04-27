/**
 * Polish (2026-04-25) — pin the new portion-clamp shape and the zero-cal
 * rejection guard added to the FatSecret matching path.
 *
 * Tester feedback: portions like 0.3× and 1.2× read as nonsense; "always do
 * 1× where possible" is the right default. Tightening the clamp from
 * {0.2, 2.5, 0.1} (23 legal positions) to {0.5, 2.0, 0.5} (4 legal positions)
 * forces the optimizer to reach for sensible whole/half portions.
 */
import { describe, it, expect } from "vitest";
import {
  PORTION_MULTIPLIER_CLAMP,
  clampPlannerMultiplier,
} from "../../src/lib/nutrition/mealPlanAlgo";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PORTION_MULTIPLIER_CLAMP (polish — sensible-portions clamp)", () => {
  it("min is 0.5, max is 2.0, step is 0.5 (only 4 legal positions)", () => {
    expect(PORTION_MULTIPLIER_CLAMP.min).toBe(0.5);
    expect(PORTION_MULTIPLIER_CLAMP.max).toBe(2.0);
    expect(PORTION_MULTIPLIER_CLAMP.step).toBe(0.5);
  });

  it("clampPlannerMultiplier snaps to {0.5, 1, 1.5, 2}", () => {
    expect(clampPlannerMultiplier(0.3)).toBe(0.5); // below min → min
    expect(clampPlannerMultiplier(0.4)).toBe(0.5);
    expect(clampPlannerMultiplier(0.6)).toBe(0.5); // closer to 0.5 step
    expect(clampPlannerMultiplier(0.8)).toBe(1.0);
    expect(clampPlannerMultiplier(1.0)).toBe(1.0);
    expect(clampPlannerMultiplier(1.2)).toBe(1.0); // 1.2 → 1 (no longer legal)
    expect(clampPlannerMultiplier(1.4)).toBe(1.5);
    expect(clampPlannerMultiplier(1.7)).toBe(1.5);
    expect(clampPlannerMultiplier(2.5)).toBe(2.0); // above max → max
    expect(clampPlannerMultiplier(99)).toBe(2.0);
  });

  it("rejects NaN gracefully (default 1×)", () => {
    expect(clampPlannerMultiplier(Number.NaN)).toBe(1);
    expect(clampPlannerMultiplier(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("FatSecret zero-cal rejection guard (polish)", () => {
  // Read the source so we don't have to wire a full FatSecret mock — pin the
  // structural fix at the source level.
  const SRC = readFileSync(
    resolve(__dirname, "..", "..", "src/lib/nutrition/verifyIngredients.ts"),
    "utf8",
  );

  it("verifyIngredients.ts has the sourceIsAllZero guard that skips placeholder rows", () => {
    expect(SRC).toMatch(/sourceIsAllZero/);
    expect(SRC).toMatch(/perServing\.calories\s*<=\s*0/);
    expect(SRC).toMatch(/perServing\.protein\s*<=\s*0/);
    expect(SRC).toMatch(/perServing\.carbs\s*<=\s*0/);
    expect(SRC).toMatch(/perServing\.fat\s*<=\s*0/);
  });

  it("the guard short-circuits before scaling/return so the placeholder isn't accepted as a 0-cal match", () => {
    // sourceIsAllZero block must precede the FatSecret return statement.
    const guardIdx = SRC.indexOf("sourceIsAllZero");
    const fsReturnIdx = SRC.indexOf('source: "FatSecret"');
    expect(guardIdx).toBeGreaterThan(0);
    expect(fsReturnIdx).toBeGreaterThan(0);
    expect(guardIdx).toBeLessThan(fsReturnIdx);
  });
});
