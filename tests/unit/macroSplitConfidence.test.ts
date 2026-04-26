/**
 * F-82 (2026-04-25) — pin macro-split data-confidence gate.
 *
 * Closes the "Fly By Jing chili crisp = 100% fat" failure mode where the
 * meal-detail screen drew a confident donut showing 100% fat for an OFF
 * entry whose only published macro was fat. Real food but misleading
 * presentation when other macros are unpublished.
 */
import { describe, expect, it } from "vitest";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "@/lib/nutrition/macroSplitConfidence";

describe("macroSplitConfidence", () => {
  it("returns 'complete' when at least two macros are non-zero", () => {
    expect(macroSplitConfidence({ calories: 400, protein: 20, carbs: 40, fat: 10 })).toEqual({ state: "complete" });
    expect(macroSplitConfidence({ calories: 100, protein: 5, carbs: 0, fat: 8 })).toEqual({ state: "complete" });
  });

  it("returns 'empty' when every macro is zero", () => {
    expect(macroSplitConfidence({ calories: 0, protein: 0, carbs: 0, fat: 0 }).state).toBe("empty");
  });

  it("treats a tiny single-macro entry as complete (e.g. a 30 kcal chili crisp serving)", () => {
    // 3g fat at OFF for a 1-tbsp chili crisp serving — kcal is too small
    // to be misleading.
    expect(
      macroSplitConfidence({ calories: 30, protein: 0, carbs: 0, fat: 3 }).state,
    ).toBe("complete");
  });

  it("returns 'single_macro' for a substantial single-macro entry that disagrees with Atwater (the screenshot bug)", () => {
    // OFF row that claims 200 kcal but only published 3g fat.
    // Atwater(3g fat) = 27 kcal — wildly off from claimed 200. Incomplete.
    const v = macroSplitConfidence({ calories: 200, protein: 0, carbs: 0, fat: 3 });
    expect(v.state).toBe("single_macro");
    if (v.state === "single_macro") expect(v.presentMacro).toBe("fat");
  });

  it("treats a real single-macro food (kcal matches Atwater) as complete", () => {
    // Pure olive oil — 100 kcal claimed, 11g fat = 99 kcal Atwater. Match.
    expect(macroSplitConfidence({ calories: 100, protein: 0, carbs: 0, fat: 11 }).state).toBe("complete");
    // Pure sugar — 96 kcal, 24g carbs Atwater = 96. Match.
    expect(macroSplitConfidence({ calories: 96, protein: 0, carbs: 24, fat: 0 }).state).toBe("complete");
  });

  it("identifies the right presentMacro for the explainer copy", () => {
    const proteinOnly = macroSplitConfidence({ calories: 200, protein: 5, carbs: 0, fat: 0 });
    if (proteinOnly.state === "single_macro") expect(proteinOnly.presentMacro).toBe("protein");

    const carbsOnly = macroSplitConfidence({ calories: 200, protein: 0, carbs: 5, fat: 0 });
    if (carbsOnly.state === "single_macro") expect(carbsOnly.presentMacro).toBe("carbs");
  });

  it("explainer copy names the present macro and what's missing", () => {
    expect(macroSplitIncompleteCopy("fat")).toBe("Only fat reported — protein and carbs not published by source.");
    expect(macroSplitIncompleteCopy("protein")).toBe("Only protein reported — carbs and fat not published by source.");
    expect(macroSplitIncompleteCopy("carbs")).toBe("Only carbs reported — protein and fat not published by source.");
  });
});
