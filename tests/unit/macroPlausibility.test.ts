/**
 * F-77 (2026-04-25) — pin the Atwater plausibility gate.
 *
 * TestFlight session 2026-04-25 (Grace, internal observation): food search
 * for "eggs" returned an OFF row with "1 egg / 40 g · 210 kcal · 3 g
 * protein". A 40 g egg is ~62 kcal / 5–6 g protein. The poisoned row was
 * a user-uploaded OFF document for an unrelated food named "Eggs", which
 * outranked verified USDA generics because there was no plausibility gate
 * at ingest. This test pins the gate so the failure mode cannot regress.
 */
import { describe, expect, it } from "vitest";
import {
  checkMacroPlausibility,
  isPlausibleMacrosPer100g,
} from "@/lib/nutrition/macroPlausibility";

describe("macroPlausibility — Atwater gate", () => {
  it("accepts a real whole-egg row (per 100 g)", () => {
    // USDA SR Legacy 'Egg, whole, raw, fresh' — 143 kcal, 12.6 P, 0.7 C, 9.5 F
    expect(isPlausibleMacrosPer100g({ calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 })).toBe(true);
  });

  it("accepts a high-fat condiment (chili crisp) — fat-only is fine when kcal matches", () => {
    // OFF Fly By Jing chili crisp ~ 600 kcal/100g, ~65 g fat, low P/C
    expect(isPlausibleMacrosPer100g({ calories: 600, protein: 5, carbs: 8, fat: 60 })).toBe(true);
  });

  it("accepts a high-protein milk shake (fairlife Core Power)", () => {
    // 232 kcal / 414 ml bottle, 42P / 9C / 3F → per 100g ≈ 56 / 10 / 2 / 0.7
    expect(isPlausibleMacrosPer100g({ calories: 56, protein: 10, carbs: 2.2, fat: 0.7 })).toBe(true);
  });

  it("rejects the screenshot bug — 210 kcal claimed from 3 g protein alone", () => {
    // The OFF row that was outranking USDA in the testers's "eggs" search.
    // 3 g protein = 12 kcal Atwater; claiming 210 kcal is impossible.
    const v = checkMacroPlausibility({ calories: 210, protein: 3, carbs: 0, fat: 0 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("single_macro_only");
  });

  it("rejects rows whose kcal exceeds 900 / 100g (above pure fat)", () => {
    expect(isPlausibleMacrosPer100g({ calories: 1200, protein: 10, carbs: 5, fat: 50 })).toBe(false);
  });

  it("rejects rows whose kcal disagrees with Atwater sum beyond 20% tolerance", () => {
    // Atwater = 4*5 + 4*10 + 9*2 = 78 kcal. Claiming 200 kcal is 156% off.
    const v = checkMacroPlausibility({ calories: 200, protein: 5, carbs: 10, fat: 2 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("atwater_mismatch");
  });

  it("rejects rows where every macro AND kcal is zero", () => {
    const v = checkMacroPlausibility({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("all_zero");
  });

  it("tolerates real-world rounding (within 20% or 25 kcal)", () => {
    // OFF rounds aggressively — a 100 kcal row whose macros Atwater to 85
    // should still pass (within 20%).
    expect(isPlausibleMacrosPer100g({ calories: 100, protein: 5, carbs: 10, fat: 2.5 })).toBe(true);
  });

  it("does NOT flag low-kcal single-macro rows (e.g. fibre supplement, plain spice)", () => {
    // A small kcal value with one macro is a real shape (e.g. 30 kcal /
    // 3g fat for a chili crisp serving) and shouldn't trigger the
    // single-macro guard.
    expect(isPlausibleMacrosPer100g({ calories: 30, protein: 0, carbs: 0, fat: 3 })).toBe(true);
  });
});
