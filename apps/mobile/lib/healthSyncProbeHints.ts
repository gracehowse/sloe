import { HEALTH_DIETARY_CORE_PERMISSION_KEYS } from "./healthDietaryNutrients";
import type { NutritionImportProbeCoreCounts } from "./healthSyncProbeTypes";

/** ENG-1023 — surface misaligned Health read toggles in the import probe alert. */
export function formatCoreDietaryProbeAlignmentHint(
  counts: NutritionImportProbeCoreCounts,
): string | null {
  const energyExt = counts.EnergyConsumed?.external ?? 0;
  if (energyExt > 0) return null;
  const withExternal = HEALTH_DIETARY_CORE_PERMISSION_KEYS.filter(
    (key) => key !== "EnergyConsumed" && (counts[key]?.external ?? 0) > 0,
  );
  if (withExternal.length === 0) return null;
  return `\n\nHealth returned ${withExternal.join(", ")} samples but zero Dietary Energy — enable Dietary Energy read in Settings → Health → Sloe.`;
}
