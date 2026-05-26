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
  checkScaledLogPlausibility,
  isPlausibleMacrosPer100g,
  isPlausibleScaledLog,
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

/**
 * P0 (2026-05-26) — post-scale log plausibility guard. Closes the
 * "Chobani Greek yogurt · 500 g · 1,325 kcal · 265 g protein" failure where
 * an OFF `nutrition_data_per:"serving"` row's per-serving (per-500g) values
 * masqueraded as per-100g, so the legitimate ×5 grams-scale became ×25.
 */
describe("checkScaledLogPlausibility — post-scale physical guard", () => {
  it("PASSES a normal 500 g pot of Greek yogurt (~300 kcal / 50 g protein)", () => {
    // 60 kcal/100g, 10 g protein/100g → ×5 = 300 kcal / 50 g protein.
    const v = checkScaledLogPlausibility(
      { calories: 300, protein: 50, carbs: 18, fat: 0 },
      500,
      { calories: 60, protein: 10, carbs: 3.6, fat: 0 },
    );
    expect(v.ok).toBe(true);
  });

  it("FAILS the bug case — 500 g · 1,325 kcal · 265 g protein", () => {
    // The per-100g panel is genuine (60/10/3.6/0) but the scaled row was
    // built from a per-500g base scaled again ×5. The source-basis cross-
    // check is the load-bearing catch: 1,325 kcal vs 60 × 5 = 300 kcal.
    const v = checkScaledLogPlausibility(
      { calories: 1325, protein: 265, carbs: 90, fat: 0 },
      500,
      { calories: 60, protein: 10, carbs: 3.6, fat: 0 },
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("source_basis_mismatch");
  });

  it("FAILS the bug case on density alone when no source panel is supplied", () => {
    // Without the panel, the kcal-per-gram + protein-mass arms still catch
    // it: 265 g protein from 500 g is 53% protein by mass (< 0.95, passes),
    // but 1,325 kcal / 500 g = 2.65 kcal/g (passes density)… so the absolute
    // catch here is protein/100g: 265 × (100/500) = 53 g/100g (passes 90
    // ceiling). The standalone guard is intentionally lenient — the panel
    // cross-check is what nails this exact shape. A grosser inflation does
    // trip the standalone arms:
    const grosslyInflated = checkScaledLogPlausibility(
      { calories: 6625, protein: 1325, carbs: 450, fat: 0 },
      500,
    );
    expect(grosslyInflated.ok).toBe(false);
  });

  it("PASSES pure oil — 884 kcal/100g, ~9 kcal/g (the generous-ceiling boundary)", () => {
    // 15 g olive oil ≈ 133 kcal, 15 g fat.
    expect(isPlausibleScaledLog({ calories: 133, protein: 0, carbs: 0, fat: 15 }, 15)).toBe(true);
    // 100 g oil ≈ 884 kcal, 100 g fat — must pass kcal/100g + fat/100g ceilings.
    expect(isPlausibleScaledLog({ calories: 884, protein: 0, carbs: 0, fat: 100 }, 100)).toBe(true);
  });

  it("PASSES protein isolate — ~90 g protein / 100g (the protein ceiling boundary)", () => {
    // 30 g scoop of whey isolate ≈ 27 g protein, ~110 kcal.
    expect(isPlausibleScaledLog({ calories: 110, protein: 27, carbs: 1, fat: 1 }, 30)).toBe(true);
    // 100 g isolate ≈ 90 g protein — must pass the 90 g/100g ceiling.
    expect(isPlausibleScaledLog({ calories: 370, protein: 90, carbs: 2, fat: 1 }, 100)).toBe(true);
  });

  it("FAILS when kcal-per-gram exceeds pure fat (> 9.1 kcal/g)", () => {
    const v = checkScaledLogPlausibility({ calories: 1000, protein: 0, carbs: 0, fat: 50 }, 100);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("kcal_per_gram");
  });

  it("FAILS when protein exceeds 95% of the food's mass", () => {
    const v = checkScaledLogPlausibility({ calories: 400, protein: 98, carbs: 0, fat: 0 }, 100);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("protein_exceeds_mass");
  });

  it("FAILS when derived protein/100g exceeds 90 (without tripping mass/density first)", () => {
    // 40 g portion with 38 g protein → 95 g protein/100g (> 90 ceiling), but
    // protein is only 95% of mass (boundary, passes) and kcal/g is fine.
    const v = checkScaledLogPlausibility({ calories: 160, protein: 38, carbs: 1, fat: 0 }, 40);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("protein_per_100g_ceiling");
  });

  it("FAILS when derived carbs/100g exceeds 100", () => {
    // 50 g portion, 60 g carbs → 120 g carbs/100g (impossible).
    const v = checkScaledLogPlausibility({ calories: 240, protein: 0, carbs: 60, fat: 0 }, 50);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("carbs_per_100g_ceiling");
  });

  it("treats zero grams and all-zero macros as plausible (can't reason / legit)", () => {
    expect(isPlausibleScaledLog({ calories: 100, protein: 5, carbs: 5, fat: 5 }, 0)).toBe(true);
    expect(isPlausibleScaledLog({ calories: 0, protein: 0, carbs: 0, fat: 0 }, 250)).toBe(true);
  });

  it("PASSES when scaled kcal agrees with the source panel within 25%", () => {
    // 200 g of a 150 kcal/100g food → 300 kcal; panel says 150/100g.
    const v = checkScaledLogPlausibility(
      { calories: 300, protein: 20, carbs: 30, fat: 8 },
      200,
      { calories: 150, protein: 10, carbs: 15, fat: 4 },
    );
    expect(v.ok).toBe(true);
  });
});
