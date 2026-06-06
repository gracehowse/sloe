/**
 * Apple Health meal-import diagnostics (2026-06-04 audit).
 *
 * Pins user-facing copy for ambiguous zero-import outcomes and the
 * read-only probe contract — without importing the full healthSync module
 * (Expo Constants / Supabase / HealthKit bridge).
 */
import { describe, expect, it } from "vitest";

import {
  formatNutritionImportSummary,
  type NutritionImportResult,
} from "../../lib/nutritionImportSummary";

function baseResult(
  overrides: Partial<NutritionImportResult> = {},
): NutritionImportResult {
  return {
    imported: [],
    skippedOwn: 0,
    skippedNoName: 0,
    externalEnergyCount: 0,
    skippedDedup: 0,
    skippedNonPositive: 0,
    insertAttempted: 0,
    insertFailed: 0,
    healthKitUnavailable: false,
    ...overrides,
  };
}

describe("formatNutritionImportSummary", () => {
  it("explains HealthKit unavailable on Expo Go / simulator builds", () => {
    expect(
      formatNutritionImportSummary(baseResult({ healthKitUnavailable: true })),
    ).toMatch(/unavailable/i);
  });

  it("celebrates successful imports", () => {
    expect(
      formatNutritionImportSummary(
        baseResult({
          imported: [
            {
              dateKey: "2026-06-04",
              name: "MFP lunch",
              calories: 420,
              protein: 30,
              carbs: 40,
              fat: 12,
              sourceApp: "MyFitnessPal",
            },
          ],
        }),
      ),
    ).toMatch(/Imported 1 meal from Health/);
  });

  it("surfaces partial insert failures", () => {
    const msg = formatNutritionImportSummary(
      baseResult({
        imported: [{ dateKey: "2026-06-04", name: "a", calories: 1, protein: 0, carbs: 0, fat: 0, sourceApp: "MFP" }],
        insertFailed: 2,
      }),
    );
    expect(msg).toMatch(/failed to save/i);
  });

  it("guides user when Health has no external energy samples", () => {
    expect(formatNutritionImportSummary(baseResult())).toMatch(/MyFitnessPal/i);
  });

  it("explains all samples already deduped", () => {
    expect(
      formatNutritionImportSummary(
        baseResult({ externalEnergyCount: 3, skippedDedup: 3 }),
      ),
    ).toMatch(/already in your journal/i);
  });
});
