/**
 * Shared activity budget addon calculation.
 * Used by both web NutritionTracker and mobile Today screen.
 *
 * bonus = max(0, (resting + active) − maintenance)
 * Fallback: workout calories only when no resting data.
 */
export function activityBudgetAddon(opts: {
  prefer: boolean;
  activityBurn: number;
  basalBurn: number;
  maintenanceKcal: number;
  workoutCalories?: number;
}): number {
  if (!opts.prefer || opts.activityBurn <= 0) return 0;
  if (opts.basalBurn > 0 && opts.maintenanceKcal > 0) {
    return Math.max(0, opts.basalBurn + opts.activityBurn - opts.maintenanceKcal);
  }
  // No resting data: use logged workout calories only
  return Math.max(0, opts.workoutCalories ?? 0);
}
