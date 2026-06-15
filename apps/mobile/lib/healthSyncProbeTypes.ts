import { HEALTH_DIETARY_CORE_PERMISSION_KEYS } from "./healthDietaryNutrients";

export type NutritionImportProbeCoreCounts = Partial<
  Record<(typeof HEALTH_DIETARY_CORE_PERMISSION_KEYS)[number], { total: number; external: number }>
>;
