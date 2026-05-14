/**
 * Activity bonus helper — single source of truth for the bonus value
 * added to the daily food budget when the user has enabled
 * `prefer_activity_adjusted_calories`.
 *
 * Adopts Lose It!'s projected-EOD model — see
 * `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md` for
 * the why. In short:
 *
 *   For TODAY:   bonus = max(0, projected_EOD_burn − maintenance)
 *   For PAST:    bonus = max(0, (resting + active) − maintenance)
 *
 * Projected EOD burn assumes the user does no further activity for the
 * rest of the day, only resting at the rate seen so far. This is
 * deliberately conservative so the value can be safely added to the
 * food budget without overeating risk.
 *
 * Returns 0 when `prefer` is false or `active === 0` (avoids
 * double-counting incidental movement already baked into the user's
 * maintenance estimate).
 */
export interface ActivityBonusInput {
  /** User has enabled `prefer_activity_adjusted_calories`. */
  prefer: boolean;
  /** Date key being computed (YYYY-MM-DD). */
  dateKey: string;
  /** Today's date key, in the same format. */
  todayDateKey: string;
  /** Resting (basal) energy burned so far, kcal. */
  restingKcal: number;
  /** Active energy burned so far, kcal. */
  activeKcal: number;
  /** Full-day maintenance TDEE, kcal. */
  maintenanceKcal: number;
  /** Fallback when no resting data: total logged workout calories. */
  workoutKcal?: number;
  /** Override `new Date()` for deterministic tests. */
  now?: Date;
}

export function computeActivityBonusKcal(input: ActivityBonusInput): number {
  const {
    prefer,
    dateKey,
    todayDateKey,
    restingKcal,
    activeKcal,
    maintenanceKcal,
    workoutKcal = 0,
    now = new Date(),
  } = input;
  if (!prefer) return 0;
  const active = Math.round(activeKcal);
  if (active <= 0) return 0;
  const basal = Math.round(restingKcal);
  if (basal > 0 && maintenanceKcal > 0) {
    if (dateKey === todayDateKey) {
      const hoursElapsed = Math.max(0.0001, now.getHours() + now.getMinutes() / 60);
      const hourlyResting = basal / hoursElapsed;
      const futureBurn = Math.round(hourlyResting * Math.max(0, 24 - hoursElapsed));
      const projected = basal + active + futureBurn;
      return Math.max(0, projected - maintenanceKcal);
    }
    return Math.max(0, basal + active - maintenanceKcal);
  }
  return Math.max(0, Math.round(workoutKcal));
}
