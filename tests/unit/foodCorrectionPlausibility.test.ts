/**
 * F-138 Phase 2 — server-side plausibility gate. Tests cover every
 * BLOCK / WARN / PASS / AUTO_VERIFY branch from the nutrition-engine
 * spec.
 */
import { describe, it, expect } from "vitest";
import {
  checkSubmissionPlausibility,
  type FoodCorrectionSubmission,
} from "@/lib/foodCorrection/plausibility";

// Realistic-ish baseline: 1 boiled egg per 100g — calories 155, protein
// 13, carbs 1, fat 11. Atwater = 4×13 + 4×1 + 9×11 = 155. Clean pass.
function ok(): FoodCorrectionSubmission {
  return { calories: 155, protein: 13, carbs: 1, fat: 11, fiber: 0, sugar: 1, satFat: 3, sodium: 124 };
}

describe("F-138 plausibility — BLOCK tier (structural impossibilities)", () => {
  it("blocks when calories are negative", () => {
    const r = checkSubmissionPlausibility({ ...ok(), calories: -10 });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/calories is negative/);
  });

  it("blocks when macro sum > 100g/100g", () => {
    const r = checkSubmissionPlausibility({
      calories: 800,
      protein: 50,
      carbs: 50,
      fat: 50,
      fiber: 0,
      sugar: 0,
      satFat: 10,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/macros sum > 100/);
  });

  it("blocks when fat alone > 100g/100g", () => {
    const r = checkSubmissionPlausibility({
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 110,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/fat > 100g/);
  });

  it("blocks when sugar > carbs (subset violation)", () => {
    const r = checkSubmissionPlausibility({
      calories: 100,
      protein: 0,
      carbs: 5,
      fat: 0,
      fiber: 0,
      sugar: 20,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/sugar > carbs/);
  });

  it("blocks when saturated fat > total fat (label-field swap)", () => {
    const r = checkSubmissionPlausibility({
      calories: 200,
      protein: 0,
      carbs: 0,
      fat: 5,
      fiber: 0,
      sugar: 0,
      satFat: 10,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/saturated fat > total fat/);
  });

  it("blocks when calories > 900 kcal/100g (above pure-fat ceiling)", () => {
    const r = checkSubmissionPlausibility({
      calories: 1500,
      protein: 0,
      carbs: 0,
      fat: 50,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/calories > 900/);
  });

  it("blocks when sodium > 40,000 mg/100g (above pure-salt ceiling)", () => {
    const r = checkSubmissionPlausibility({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 50000,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/sodium > 40,000/);
  });
});

describe("F-138 plausibility — Atwater consistency", () => {
  it("blocks when Atwater is off by >30%", () => {
    // 50g protein + 50g carbs + 0g fat = 400 kcal expected. 200 kcal claim → -50%.
    const r = checkSubmissionPlausibility({
      calories: 200,
      protein: 50,
      carbs: 50,
      fat: 0,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/Atwater off.*>30%/);
  });

  it("warns when Atwater is off by 15-30%", () => {
    // 4×10 + 4×10 + 9×5 = 125 expected. 100 claim → 20% off.
    const r = checkSubmissionPlausibility({
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/Atwater off.*15-30%/);
  });

  it("passes within 15% Atwater tolerance (label rounding range)", () => {
    const r = checkSubmissionPlausibility(ok());
    expect(r.verdict).toBe("pass");
    expect(r.reasons).toHaveLength(0);
  });

  it("counts fiber at 2 kcal/g (FDA convention)", () => {
    // 4×0 + 4×(20-10) + 2×10 + 9×0 = 60 expected (NOT 80 if we'd
    // counted fiber at 4 kcal/g).
    const r = checkSubmissionPlausibility({
      calories: 60,
      protein: 0,
      carbs: 20,
      fat: 0,
      fiber: 10,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    });
    expect(r.verdict).toBe("pass");
  });
});

describe("F-138 plausibility — OFF baseline cross-check", () => {
  it("blocks when calories are >3× the OFF baseline (likely unit error)", () => {
    // Submission is per-serving fed into per-100g field.
    const r = checkSubmissionPlausibility(
      { calories: 600, protein: 50, carbs: 0, fat: 30, fiber: 0, sugar: 0, satFat: 0, sodium: 0 },
      null,
      { calories: 100 },
    );
    expect(r.verdict).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/× OFF baseline/);
  });

  it("warns when calories differ 50-200% from OFF baseline (reformulation possible)", () => {
    const r = checkSubmissionPlausibility(
      { calories: 250, protein: 13, carbs: 25, fat: 10, fiber: 0, sugar: 0, satFat: 0, sodium: 0 },
      null,
      { calories: 150 },
    );
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/differ >50% from OFF/);
  });
});

describe("F-138 plausibility — sodium / low-cal sanity (warns)", () => {
  it("warns when sodium > 5000 mg/100g (legitimate for bouillon but rare)", () => {
    const r = checkSubmissionPlausibility({
      calories: 100,
      protein: 5,
      carbs: 5,
      fat: 5,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 6000,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/sodium > 5000/);
  });

  it("warns when sodium < 1 mg/100g but macros present (g/mg unit error?)", () => {
    const r = checkSubmissionPlausibility({
      calories: 100,
      protein: 5,
      carbs: 5,
      fat: 5,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0.5,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/possible g\/mg unit error/);
  });

  it("warns when calories < 1 but macros present", () => {
    const r = checkSubmissionPlausibility({
      calories: 0.5,
      protein: 2,
      carbs: 2,
      fat: 1,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 100,
    });
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/calories near zero but macros/);
  });
});

describe("F-138 plausibility — cross-submission consensus (AUTO_VERIFY)", () => {
  it("auto-verifies when submission matches existing verified row within tolerance", () => {
    const r = checkSubmissionPlausibility(
      ok(),
      { calories: 158, protein: 13, carbs: 1, fat: 11, sodium: 130 },
    );
    expect(r.verdict).toBe("auto_verify");
    expect(r.reasons).toHaveLength(0);
  });

  it("warns when submission differs from existing verified row beyond tolerance", () => {
    const r = checkSubmissionPlausibility(
      ok(),
      { calories: 250, protein: 13, carbs: 1, fat: 11, sodium: 130 },
    );
    expect(r.verdict).toBe("warn");
    expect(r.reasons.join(" ")).toMatch(/differs from existing verified row/);
  });

  it("does NOT auto-verify when there's no existing verified row (single submission)", () => {
    const r = checkSubmissionPlausibility(ok());
    expect(r.verdict).toBe("pass");
  });

  it("does NOT auto-verify when consensus passes but Atwater warns", () => {
    // Submission matches existing row but Atwater is off → warn beats consensus
    const off = {
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
      fiber: 0,
      sugar: 0,
      satFat: 0,
      sodium: 0,
    };
    const r = checkSubmissionPlausibility(off, {
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
    });
    expect(r.verdict).toBe("warn");
  });
});

describe("F-138 plausibility — happy path", () => {
  it("passes a clean realistic submission with no issues", () => {
    const r = checkSubmissionPlausibility(ok());
    expect(r.verdict).toBe("pass");
    expect(r.reasons).toHaveLength(0);
  });
});
