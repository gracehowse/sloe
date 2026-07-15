/**
 * ENG-1421 — plausibility soft-flag on the photo-log path (the only
 * previously-ungated AI logging path). The parser cross-checks each item's
 * own kcal against its macros (scale-invariant Atwater), and on failure flags
 * `implausible` + drops the item to "low" confidence so the existing amber
 * verify-before-logging treatment fires. Items are never dropped.
 *
 * Source: 2026-07-05 deep audit, stage 3 item 7.
 */

import { describe, it, expect } from "vitest";

import { checkItemMacroConsistency } from "../../src/lib/nutrition/macroPlausibility";
import { parsePhotoLogRangedResponse } from "../../src/lib/nutrition/photoLogRanges";

describe("checkItemMacroConsistency (scale-invariant Atwater)", () => {
  it("passes a real food whose kcal matches its macros", () => {
    // 100g grilled chicken breast: 165 kcal | P31 C0 F3.6 → Atwater ≈ 156
    expect(checkItemMacroConsistency({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }).ok).toBe(true);
  });

  it("passes a large whole-plate item (NO per-100g ceiling misfire)", () => {
    // 1,200 kcal plate | P60 C120 F40 → Atwater = 1,080, within tolerance.
    // checkMacroPlausibility would falsely trip its 900 kcal/100g ceiling here.
    expect(checkItemMacroConsistency({ calories: 1200, protein: 60, carbs: 120, fat: 40 }).ok).toBe(true);
  });

  it("flags single_macro_only when kcal is claimed from one macro that can't support it", () => {
    const v = checkItemMacroConsistency({ calories: 300, protein: 3, carbs: 0, fat: 0 });
    expect(v).toEqual({ ok: false, reason: "single_macro_only" });
  });

  it("flags atwater_mismatch when kcal disagrees with the macro sum", () => {
    const v = checkItemMacroConsistency({ calories: 500, protein: 10, carbs: 10, fat: 5 });
    expect(v).toEqual({ ok: false, reason: "atwater_mismatch" });
  });

  it("passes (nothing to falsify) when no macros are given", () => {
    expect(checkItemMacroConsistency({ calories: 200, protein: 0, carbs: 0, fat: 0 }).ok).toBe(true);
  });
});

describe("parsePhotoLogRangedResponse — plausibility soft-flag", () => {
  const parseOne = (item: Record<string, unknown>) => {
    const outcome = parsePhotoLogRangedResponse({ items: [item] }, "test-model");
    if (outcome.kind !== "ok") throw new Error(`expected ok, got ${outcome.kind}`);
    return outcome.response.items[0];
  };

  it("flags an internally-inconsistent item and drops it to low confidence", () => {
    const item = parseOne({
      name: "Mystery item",
      calories: { low: 300, high: 300 },
      protein: { low: 3, high: 3 },
      confidence: "high",
      category: "Protein",
    });
    expect(item.implausible).toBe(true);
    expect(item.plausibilityReason).toBe("single_macro_only");
    expect(item.confidence).toBe("low"); // downgraded from "high"
  });

  it("leaves a consistent item untouched (no flag, confidence preserved)", () => {
    const item = parseOne({
      name: "Grilled chicken",
      calories: { low: 160, high: 170 },
      protein: { low: 30, high: 32 },
      fat: { low: 3, high: 4 },
      confidence: "high",
      category: "Protein",
    });
    expect(item.implausible).toBeFalsy();
    expect(item.confidence).toBe("high");
  });

  it("does not flag an item the model declined to break down (no macros)", () => {
    const item = parseOne({
      name: "Mixed sauce",
      calories: { low: 80, high: 100 },
      confidence: "medium",
      category: "Sauce + dressing",
    });
    expect(item.implausible).toBeFalsy();
    expect(item.confidence).toBe("medium");
  });
});
