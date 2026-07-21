import { describe, expect, it } from "vitest";

import {
  confirmedLabelLogItem,
  labelScanResultToReview,
} from "../../src/lib/nutrition/labelLogging";

describe("nutrition-label logging model", () => {
  it("scales the endpoint's per-100 g values to the detected serving", () => {
    expect(
      labelScanResultToReview({
        ok: true,
        name: "Greek yoghurt",
        servingSizeG: 40,
        calories: 250,
        protein: 20,
        carbs: 10,
        fat: 15,
        fiberG: 5,
        sugarG: 7.5,
        saturatedFatG: 3,
        sodiumMg: 300,
        confidence: "high",
        implausible: false,
      }),
    ).toEqual({
      name: "Greek yoghurt",
      servingSizeG: 40,
      calories: 100,
      protein: 8,
      carbs: 4,
      fat: 6,
      fiberG: 2,
      sugarG: 3,
      saturatedFatG: 1.2,
      sodiumMg: 120,
      confidence: "high",
      implausible: false,
    });
  });

  it("uses an explicit 100 g review basis when the label has no serving size", () => {
    const review = labelScanResultToReview({
      ok: true,
      calories: 90,
      protein: 4,
      carbs: 12,
      fat: 3,
      confidence: "unexpected",
      implausible: true,
      plausibilityReason: "Atwater mismatch",
    });
    expect(review).toMatchObject({
      servingSizeG: 100,
      confidence: "low",
      implausible: true,
      plausibilityReason: "Atwater mismatch",
    });
  });

  it("rejects malformed scan payloads and incomplete user confirmations", () => {
    expect(labelScanResultToReview({ ok: true, calories: 100 })).toBeNull();
    const review = labelScanResultToReview({
      ok: true,
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 4,
      confidence: "medium",
      implausible: false,
    });
    expect(review).not.toBeNull();
    expect(
      confirmedLabelLogItem(
        {
          name: "",
          servingSizeG: "100",
          calories: "100",
          protein: "5",
          carbs: "10",
          fat: "4",
        },
        review!,
      ),
    ).toBeNull();
  });

  it("allows a confirmed zero-calorie label", () => {
    const review = labelScanResultToReview({
      ok: true,
      name: "Sparkling water",
      servingSizeG: 355,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidence: "high",
      implausible: false,
    })!;
    expect(
      confirmedLabelLogItem(
        {
          name: review.name,
          servingSizeG: "355",
          calories: "0",
          protein: "0",
          carbs: "0",
          fat: "0",
        },
        review,
      ),
    ).toMatchObject({ name: "Sparkling water", calories: 0 });
  });

  it("commits the user's corrected core macros while preserving scan trust metadata", () => {
    const review = labelScanResultToReview({
      ok: true,
      name: null,
      servingSizeG: 30,
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 8,
      fiberG: 6,
      sodiumMg: 300,
      confidence: "low",
      implausible: true,
    })!;
    expect(
      confirmedLabelLogItem(
        {
          name: "Corrected crackers",
          servingSizeG: "28",
          calories: "62.4",
          protein: "3.25",
          carbs: "6.75",
          fat: "2.55",
        },
        review,
      ),
    ).toMatchObject({
      name: "Corrected crackers",
      servingSizeG: 28,
      calories: 62,
      protein: 3.3,
      carbs: 6.8,
      fat: 2.6,
      fiberG: 1.7,
      sodiumMg: 84,
      confidence: "low",
      implausible: true,
    });
  });
});
