/**
 * Tests for src/lib/nutrition/aiLogging.ts (Batch 5.13).
 *
 * The helper is the single source of truth for how voice and
 * AI-photo logged items are classified, summed and sanitised on
 * both web and mobile. Regressions here break parity.
 */
import { describe, it, expect } from "vitest";
import {
  aggregateTotals,
  aiLoggingSourceLabel,
  AI_PHOTO_SOURCE,
  AI_VOICE_SOURCE,
  averageConfidence,
  classifyConfidence,
  isLowConfidence,
  isMeaningfulPhotoCorrection,
  LOW_CONFIDENCE_THRESHOLD,
  sanitiseAiItem,
  sanitiseAiItems,
  type AiLoggedItem,
} from "@/lib/nutrition/aiLogging";

describe("classifyConfidence", () => {
  it("0.4 is low", () => {
    expect(classifyConfidence(0.4)).toBe("low");
  });

  it("0.6 is medium", () => {
    expect(classifyConfidence(0.6)).toBe("medium");
  });

  it("0.9 is high", () => {
    expect(classifyConfidence(0.9)).toBe("high");
  });

  it("0.5 boundary is medium (>=0.5)", () => {
    expect(classifyConfidence(0.5)).toBe("medium");
  });

  it("0.75 boundary is high (>=0.75)", () => {
    expect(classifyConfidence(0.75)).toBe("high");
  });

  it("1 is high", () => {
    expect(classifyConfidence(1)).toBe("high");
  });

  it("0 is low", () => {
    expect(classifyConfidence(0)).toBe("low");
  });

  it("NaN is low (never trusts malformed)", () => {
    expect(classifyConfidence(Number.NaN)).toBe("low");
  });

  it("negative values clamp to 0 → low", () => {
    expect(classifyConfidence(-0.5)).toBe("low");
  });

  it("values greater than 1 clamp to 1 → high", () => {
    expect(classifyConfidence(2)).toBe("high");
  });
});

describe("isLowConfidence / LOW_CONFIDENCE_THRESHOLD", () => {
  it("threshold is exactly 0.5", () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.5);
  });

  it("0.49 is low", () => {
    expect(isLowConfidence({ confidence: 0.49 })).toBe(true);
  });

  it("0.5 is NOT low (boundary: >=0.5 passes)", () => {
    expect(isLowConfidence({ confidence: 0.5 })).toBe(false);
  });

  it("NaN treated as 0 → low", () => {
    expect(isLowConfidence({ confidence: Number.NaN })).toBe(true);
  });
});

describe("aggregateTotals", () => {
  it("empty list yields zero totals and no fiber", () => {
    const totals = aggregateTotals([]);
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(totals.fiber).toBeUndefined();
  });

  it("single item is echoed (rounded)", () => {
    const item: AiLoggedItem = {
      name: "toast",
      calories: 79.4,
      protein: 3.1,
      carbs: 14.6,
      fat: 1.2,
      confidence: 0.8,
      source: "voice",
    };
    const totals = aggregateTotals([item]);
    expect(totals).toEqual({ calories: 79, protein: 3, carbs: 15, fat: 1 });
    expect(totals.fiber).toBeUndefined();
  });

  it("multiple items sum and round", () => {
    const items: AiLoggedItem[] = [
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 0.9, source: "voice" },
      { name: "toast", calories: 79, protein: 3, carbs: 15, fat: 1, confidence: 0.8, source: "voice" },
      { name: "butter", calories: 36, protein: 0, carbs: 0, fat: 4, confidence: 0.7, source: "voice" },
    ];
    expect(aggregateTotals(items)).toEqual({
      calories: 271,
      protein: 16,
      carbs: 16,
      fat: 16,
    });
  });

  it("fiber present only when at least one item has it", () => {
    const noFiber: AiLoggedItem[] = [
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 0.9, source: "voice" },
    ];
    expect(aggregateTotals(noFiber).fiber).toBeUndefined();

    const withFiber: AiLoggedItem[] = [
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 0.9, source: "voice" },
      { name: "broccoli", calories: 55, protein: 4, carbs: 11, fat: 0.6, fiber: 5, confidence: 0.9, source: "voice" },
    ];
    expect(aggregateTotals(withFiber).fiber).toBe(5);
  });

  it("fiber sums across items that report it", () => {
    const items: AiLoggedItem[] = [
      { name: "oats", calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, confidence: 0.9, source: "voice" },
      { name: "berries", calories: 60, protein: 1, carbs: 15, fat: 0, fiber: 3.6, confidence: 0.9, source: "voice" },
    ];
    expect(aggregateTotals(items).fiber).toBe(8); // 4 + 3.6 → 7.6 → 8
  });

  it("non-finite macros coerce to 0, never NaN", () => {
    const items: AiLoggedItem[] = [
      // @ts-expect-error — intentional bad input
      { name: "broken", calories: Number.NaN, protein: 5, carbs: 0, fat: 0, confidence: 0.8, source: "voice" },
    ];
    const totals = aggregateTotals(items);
    expect(totals.calories).toBe(0);
    expect(totals.protein).toBe(5);
    expect(Number.isNaN(totals.calories)).toBe(false);
  });
});

describe("averageConfidence", () => {
  it("empty list returns 0", () => {
    expect(averageConfidence([])).toBe(0);
  });

  it("computes mean clamped into [0, 1]", () => {
    const items: AiLoggedItem[] = [
      { name: "a", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 0.9, source: "voice" },
      { name: "b", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 0.5, source: "voice" },
    ];
    expect(averageConfidence(items)).toBe(0.7);
  });

  it("clamps individual malformed confidences", () => {
    const items: AiLoggedItem[] = [
      // @ts-expect-error — intentional bad input
      { name: "a", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 5, source: "voice" },
      // @ts-expect-error — intentional bad input
      { name: "b", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: Number.NaN, source: "voice" },
    ];
    // 5 clamps to 1, NaN clamps to 0; mean = 0.5
    expect(averageConfidence(items)).toBe(0.5);
  });
});

describe("sanitiseAiItem", () => {
  it("returns null for non-object input", () => {
    expect(sanitiseAiItem(null, "voice")).toBeNull();
    expect(sanitiseAiItem(undefined, "voice")).toBeNull();
    expect(sanitiseAiItem("oops", "voice")).toBeNull();
    expect(sanitiseAiItem(42, "voice")).toBeNull();
  });

  it("returns null when name is missing or empty", () => {
    expect(
      sanitiseAiItem(
        { calories: 100, protein: 5, carbs: 10, fat: 2, confidence: 0.8 },
        "voice",
      ),
    ).toBeNull();
    expect(
      sanitiseAiItem(
        { name: "   ", calories: 100, protein: 5, carbs: 10, fat: 2, confidence: 0.8 },
        "voice",
      ),
    ).toBeNull();
  });

  it("returns null when a macro is non-numeric", () => {
    expect(
      sanitiseAiItem(
        { name: "eggs", calories: "lots", protein: 5, carbs: 10, fat: 2, confidence: 0.8 },
        "voice",
      ),
    ).toBeNull();
  });

  it("returns null when a macro is negative", () => {
    expect(
      sanitiseAiItem(
        { name: "eggs", calories: -5, protein: 5, carbs: 10, fat: 2, confidence: 0.8 },
        "voice",
      ),
    ).toBeNull();
  });

  it("NaN confidence clamps to 0 (low)", () => {
    const item = sanitiseAiItem(
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: Number.NaN },
      "voice",
    );
    expect(item).not.toBeNull();
    expect(item!.confidence).toBe(0);
    expect(isLowConfidence(item!)).toBe(true);
  });

  it("missing confidence defaults to 0 (treated as low)", () => {
    const item = sanitiseAiItem(
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11 },
      "ai_photo",
    );
    expect(item).not.toBeNull();
    expect(item!.confidence).toBe(0);
    expect(item!.source).toBe("ai_photo");
  });

  it("confidence > 1 clamps to 1", () => {
    const item = sanitiseAiItem(
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 1.4 },
      "voice",
    );
    expect(item!.confidence).toBe(1);
  });

  it("preserves fiber when provided and non-negative", () => {
    const item = sanitiseAiItem(
      { name: "oats", calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, confidence: 0.9 },
      "voice",
    );
    expect(item!.fiber).toBe(4);
  });

  it("drops fiber when negative", () => {
    const item = sanitiseAiItem(
      { name: "oats", calories: 150, protein: 5, carbs: 27, fat: 3, fiber: -2, confidence: 0.9 },
      "voice",
    );
    expect(item!.fiber).toBeUndefined();
  });

  it("preserves string 'quantity' as unit when numeric parse fails", () => {
    // Matches the current voice-log API shape: `quantity: "2 large"`.
    const item = sanitiseAiItem(
      { name: "eggs", quantity: "2 large", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 0.9 },
      "voice",
    );
    expect(item).not.toBeNull();
    expect(item!.quantity).toBeUndefined();
    expect(item!.unit).toBe("2 large");
  });

  it("accepts numeric quantity + unit separately", () => {
    const item = sanitiseAiItem(
      { name: "rice", quantity: 1, unit: "cup", grams: 186, calories: 242, protein: 4, carbs: 53, fat: 0.4, confidence: 0.85 },
      "voice",
    );
    expect(item!.quantity).toBe(1);
    expect(item!.unit).toBe("cup");
    expect(item!.grams).toBe(186);
  });

  it("rounds macros to whole numbers", () => {
    const item = sanitiseAiItem(
      { name: "egg", calories: 78.6, protein: 6.3, carbs: 0.6, fat: 5.3, confidence: 0.9 },
      "voice",
    );
    expect(item!.calories).toBe(79);
    expect(item!.protein).toBe(6);
    expect(item!.carbs).toBe(1);
    expect(item!.fat).toBe(5);
  });
});

describe("aiLoggingSourceLabel (M10, 2026-04-18)", () => {
  // Contract test: new writes must use the canonical human-readable
  // tags. The detector in foodHistory.ts is permissive and keeps
  // recognising legacy strings — but strict writes stop the pile from
  // growing.
  it("voice source → canonical 'AI voice'", () => {
    expect(aiLoggingSourceLabel("voice")).toBe("AI voice");
    expect(aiLoggingSourceLabel("voice")).toBe(AI_VOICE_SOURCE);
  });

  it("ai_photo source → canonical 'AI photo'", () => {
    expect(aiLoggingSourceLabel("ai_photo")).toBe("AI photo");
    expect(aiLoggingSourceLabel("ai_photo")).toBe(AI_PHOTO_SOURCE);
  });

  it("exposes the canonical constants as string literals", () => {
    // Pins the exact spelling + casing — a typo here would flip every
    // new AI-logged row's Quick Add badge off silently.
    expect(AI_VOICE_SOURCE).toBe("AI voice");
    expect(AI_PHOTO_SOURCE).toBe("AI photo");
  });
});

describe("sanitiseAiItems", () => {
  it("drops null items and keeps valid ones", () => {
    const raw = [
      { name: "eggs", calories: 156, protein: 13, carbs: 1, fat: 11, confidence: 0.9 },
      { name: "", calories: 50, protein: 1, carbs: 5, fat: 1, confidence: 0.5 }, // dropped
      null,
      { name: "toast", calories: 79, protein: 3, carbs: 15, fat: 1, confidence: 0.7 },
    ];
    const out = sanitiseAiItems(raw, "voice");
    expect(out).toHaveLength(2);
    expect(out.map((i) => i.name)).toEqual(["eggs", "toast"]);
  });

  it("non-array input returns empty", () => {
    expect(sanitiseAiItems("not an array" as unknown, "voice")).toEqual([]);
    expect(sanitiseAiItems(undefined, "voice")).toEqual([]);
  });
});

describe("isMeaningfulPhotoCorrection", () => {
  /**
   * Pins the detection thresholds used by the photo-correction
   * persistence loop (round 4 user-sentiment audit, 2026-04-30 — Cal
   * AI's failure pattern). Anything within rounding noise is "no
   * change"; anything beyond it (or any name diff) is a correction.
   */
  const base = (overrides: Partial<AiLoggedItem> = {}): AiLoggedItem => ({
    name: "Salmon",
    calories: 200,
    protein: 25,
    carbs: 0,
    fat: 12,
    confidence: 0.7,
    source: "ai_photo",
    ...overrides,
  });

  it("identical items return false", () => {
    const a = base();
    expect(isMeaningfulPhotoCorrection(a, { ...a })).toBe(false);
  });

  it("a name change always counts as meaningful", () => {
    expect(isMeaningfulPhotoCorrection(base(), base({ name: "Tuna" }))).toBe(true);
  });

  it("calorie delta within rounding noise (<=2) is no-change", () => {
    expect(isMeaningfulPhotoCorrection(base(), base({ calories: 201 }))).toBe(false);
    expect(isMeaningfulPhotoCorrection(base(), base({ calories: 198 }))).toBe(false);
  });

  it("calorie delta beyond noise floor flips meaningful", () => {
    expect(isMeaningfulPhotoCorrection(base(), base({ calories: 250 }))).toBe(true);
    expect(isMeaningfulPhotoCorrection(base(), base({ calories: 197 }))).toBe(true);
  });

  it("protein / carbs / fat each scrutinised at 0.5 g threshold", () => {
    expect(isMeaningfulPhotoCorrection(base(), base({ protein: 25.4 }))).toBe(false);
    expect(isMeaningfulPhotoCorrection(base(), base({ protein: 26 }))).toBe(true);
    expect(isMeaningfulPhotoCorrection(base(), base({ carbs: 0.4 }))).toBe(false);
    expect(isMeaningfulPhotoCorrection(base(), base({ carbs: 5 }))).toBe(true);
    expect(isMeaningfulPhotoCorrection(base(), base({ fat: 12.3 }))).toBe(false);
    expect(isMeaningfulPhotoCorrection(base(), base({ fat: 14 }))).toBe(true);
  });

  it("name comparison is trim + case-insensitive", () => {
    expect(
      isMeaningfulPhotoCorrection(base(), base({ name: "  salmon  " })),
    ).toBe(false);
    expect(isMeaningfulPhotoCorrection(base(), base({ name: "SALMON" }))).toBe(false);
  });

  it("fiber added by the user counts as meaningful", () => {
    const orig = base(); // no fiber
    const corrected = base({ fiber: 3 });
    expect(isMeaningfulPhotoCorrection(orig, corrected)).toBe(true);
  });

  it("fiber within noise floor is not meaningful", () => {
    const orig = base({ fiber: 3 });
    const corrected = base({ fiber: 3.3 });
    expect(isMeaningfulPhotoCorrection(orig, corrected)).toBe(false);
  });
});
