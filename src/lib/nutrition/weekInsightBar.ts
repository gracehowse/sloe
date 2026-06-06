/** Per-day state for the TD3 weekly-insight week bar (mobile parity). */
export type WeekBarDayState = "onTarget" | "loggedOff" | "empty";

export function computeWeekBarStates(
  weekDailyKcal: number[],
  dailyKcalTarget: number,
): WeekBarDayState[] {
  const tolerance =
    dailyKcalTarget > 0 ? Math.max(40, dailyKcalTarget * 0.04) : 0;
  return weekDailyKcal.slice(0, 7).map((kcal) => {
    if (!(kcal > 0)) return "empty";
    if (dailyKcalTarget > 0 && Math.abs(kcal - dailyKcalTarget) <= tolerance) {
      return "onTarget";
    }
    return "loggedOff";
  });
}

export function computeDaysOnTarget(
  weekDailyKcal: number[],
  dailyKcalTarget: number,
): number {
  return computeWeekBarStates(weekDailyKcal, dailyKcalTarget).filter(
    (s) => s === "onTarget",
  ).length;
}
