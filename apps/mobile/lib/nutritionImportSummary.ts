import type { ImportedMeal } from "./healthSyncTypes";

/** Rich import outcome for Health Sync UI + audits (2026-06-04). */
export type NutritionImportResult = {
  imported: ImportedMeal[];
  skippedOwn: number;
  skippedNoName: number;
  externalEnergyCount: number;
  skippedDedup: number;
  skippedNonPositive: number;
  insertAttempted: number;
  insertFailed: number;
  healthKitUnavailable: boolean;
};

/** User-facing summary for Health Sync `lastResult` copy. */
export function formatNutritionImportSummary(result: NutritionImportResult): string {
  if (result.healthKitUnavailable) {
    return "Meal import unavailable (HealthKit not loaded on this build).";
  }
  if (result.insertFailed > 0) {
    return `Imported ${result.imported.length} meal${result.imported.length === 1 ? "" : "s"}, but ${result.insertFailed} failed to save. Check your connection and try again.`;
  }
  if (result.imported.length > 0) {
    return `Imported ${result.imported.length} meal${result.imported.length === 1 ? "" : "s"} from Health.`;
  }
  if (result.externalEnergyCount === 0) {
    return "No meals from other apps in the lookback window. Log food in MyFitnessPal (Health sharing on), confirm per-food rows under Health → Browse → Nutrition → Dietary Energy (not only a day total), then Sync Now. If empty there too, open Settings → Health → Sloe and turn on Dietary Energy read.";
  }
  if (result.skippedDedup >= result.externalEnergyCount) {
    return `No new meals to import (${result.externalEnergyCount} Health sample${result.externalEnergyCount === 1 ? "" : "s"} already in your journal).`;
  }
  return "No new meals to import from Health.";
}
