/**
 * deriveWeeklyRecapStats — the shared derivation behind the shareable Weekly
 * Recap card (ENG-1225 #4), so web (`use-weekly-recap.tsx`) and mobile
 * (`components/recap/useWeeklyRecapShare`) compute the SAME on-target count,
 * sparkline series, and narrative from the week strip. Narrative is derived from
 * the real on-target count — never fabricated.
 */
export interface RecapWeekDayTotals {
  totals: { calories: number };
}

export interface WeeklyRecapStats {
  /** 7 daily calories (Mon→Sun); null = no log that day. */
  dailyCalories: (number | null)[];
  /** Days logged and at/under target. */
  onTargetDays: number;
  /** Days with any log. */
  loggedDays: number;
  /** Derived one-line narrative. */
  narrative: string;
}

export function deriveWeeklyRecapStats(
  days: RecapWeekDayTotals[],
  targetCalories: number,
): WeeklyRecapStats {
  const dailyCalories = days.map((d) =>
    d.totals.calories > 0 ? Math.round(d.totals.calories) : null,
  );
  const onTargetDays = days.filter(
    (d) => d.totals.calories > 0 && d.totals.calories <= targetCalories,
  ).length;
  const loggedDays = dailyCalories.filter((c) => c != null).length;
  const narrative =
    loggedDays === 0
      ? "A fresh week ahead."
      : onTargetDays >= 5
        ? "A steady, consistent week."
        : onTargetDays >= 3
          ? "Solid progress this week."
          : "Every logged day counts.";
  return { dailyCalories, onTargetDays, loggedDays, narrative };
}
