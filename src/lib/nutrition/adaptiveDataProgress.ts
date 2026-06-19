/**
 * adaptiveDataProgress — honest "how close am I to an adaptive maintenance
 * number?" status for the Progress Maintenance card.
 *
 * ENG-1189 (persona-feedback bug). The web Maintenance card used to render two
 * progress bars hardcoded to `Weigh-ins X/7` and `Logging days X/21`, counting
 * **lifetime any-entry days** and **all weigh-ins on file**. Both numbers were
 * wrong on two axes:
 *
 *   1. **Wrong thresholds.** `/7` weigh-ins and `/21` logging days are the
 *      *high*-confidence tier. Adaptive *surfaces* as Maintenance at MEDIUM
 *      confidence (the persistence writer skips low-confidence results and
 *      `resolveMaintenance` rejects low), which needs 14 gated logging days +
 *      5 weigh-ins. So the bars demanded far more than the engine does.
 *   2. **Wrong counting.** The engine counts only **R1-complete full days**
 *      (`kcal ≥ max(1000, 0.8 × BMR)`, and ≥2 entries when entry counts are
 *      known) within the trailing 28-day **window**. The card counted every
 *      day with any entry, ever. A user with sparse-but-old logging could read
 *      "21/21" while the engine saw a handful of gated in-window days.
 *
 * Result: the persona saw `Weigh-ins 10/7` and `Logging days 21/21` — both
 * "full" — yet the card still said "Formula estimate · your adaptive
 * maintenance will activate once enough data accumulates." The UI was lying
 * about what's required.
 *
 * This module reports the SAME counts the engine gates on, against the SAME
 * window and completeness rule, and the SAME medium-confidence engage
 * thresholds. Pure — no React, no I/O. Shared across web + mobile so the two
 * platforms can't drift.
 *
 * It does NOT touch the kcal math (that lives in `adaptiveTdee.ts`). It only
 * makes the "what's needed" display honest.
 */

import {
  computeAdaptiveDataCounts,
  MEDIUM_CONFIDENCE_LOGGING_DAYS,
  MEDIUM_CONFIDENCE_WEIGH_INS,
  type AdaptiveTdeeInput,
} from "./adaptiveTdee";
import { calculateBMR, type Sex } from "./tdee";

/** Minimal meal shape both platforms share (`LoggedMeal` / `JournalMeal`). */
type MealLike = { calories?: number | null };

export type AdaptiveDataProgress = {
  /** Gated full logging days within the trailing window. */
  loggingDays: number;
  /** The logging-days count needed for adaptive to engage (medium tier). */
  loggingDaysTarget: number;
  /** Weigh-ins within the trailing window. */
  weighIns: number;
  /** The weigh-in count needed for adaptive to engage (medium tier). */
  weighInsTarget: number;
  /** Days with any kcal logged in the window that didn't clear the full-day gate. */
  excludedPartialDays: number;
  /** The trailing window (days) the counts were measured over. */
  windowDays: number;
  /** Both requirements met → adaptive should engage on the next recompute. */
  ready: boolean;
  /**
   * The single honest blocking line for the card. Names the *real* missing
   * requirement (weigh-ins and/or full logging days), or, when both are met,
   * says the value is on its way. Never the old contradictory "once enough
   * data accumulates" with full bars.
   */
  message: string;
};

function remaining(have: number, need: number): number {
  return Math.max(0, need - have);
}

/**
 * `loggingDaysTarget` / `weighInsTarget` are the **medium**-confidence
 * thresholds because that's the bar at which adaptive becomes the displayed
 * Maintenance source. (A `low`-confidence result is computed but never
 * persisted or shown — surfacing the `MIN_*` floor would still leave the user
 * staring at "Formula estimate" after hitting it, which is the same dishonesty
 * in a new place.)
 */
export function computeAdaptiveDataProgress(
  input: Pick<
    AdaptiveTdeeInput,
    "intakeByDay" | "weightByDay" | "entryCountByDay" | "bmrKcal" | "windowDays"
  >,
): AdaptiveDataProgress {
  const counts = computeAdaptiveDataCounts(input);

  const loggingDaysTarget = MEDIUM_CONFIDENCE_LOGGING_DAYS;
  const weighInsTarget = MEDIUM_CONFIDENCE_WEIGH_INS;

  const daysShort = remaining(counts.loggingDays, loggingDaysTarget);
  const weighInsShort = remaining(counts.weighInCount, weighInsTarget);
  const ready = daysShort === 0 && weighInsShort === 0;

  return {
    loggingDays: counts.loggingDays,
    loggingDaysTarget,
    weighIns: counts.weighInCount,
    weighInsTarget,
    excludedPartialDays: counts.excludedPartialDays,
    windowDays: counts.windowDays,
    ready,
    message: buildMessage({
      ready,
      daysShort,
      weighInsShort,
      excludedPartialDays: counts.excludedPartialDays,
      windowDays: counts.windowDays,
    }),
  };
}

/**
 * Convenience adapter for the Progress card call sites: takes the meals-by-day
 * map the card already holds + the weight-by-day map + profile basics, and
 * returns the honest progress. Centralises the intake/entry-count derivation so
 * web and mobile can't compute it two different ways.
 *
 * BMR scales the R1 full-day floor (`max(1000, 0.8 × BMR)`). When the body
 * stats are incomplete the floor falls back to the flat 1,000 — the same
 * graceful degradation `computeAdaptiveTDEE` applies — so the count never
 * silently over- or under-reports.
 */
export function computeAdaptiveDataProgressFromMeals(args: {
  mealsByDay: Record<string, MealLike[]>;
  weightByDay: Record<string, number>;
  sex?: Sex | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  windowDays?: number;
}): AdaptiveDataProgress {
  const intakeByDay: Record<string, number> = {};
  const entryCountByDay: Record<string, number> = {};
  for (const [day, meals] of Object.entries(args.mealsByDay)) {
    if (!Array.isArray(meals) || meals.length === 0) continue;
    let total = 0;
    let count = 0;
    for (const m of meals) {
      const c = typeof m?.calories === "number" ? m.calories : 0;
      if (c > 0) total += c;
      count += 1;
    }
    if (total > 0) {
      intakeByDay[day] = total;
      entryCountByDay[day] = count;
    }
  }

  let bmrKcal: number | null = null;
  if (
    args.sex &&
    typeof args.weightKg === "number" && args.weightKg > 0 &&
    typeof args.heightCm === "number" && args.heightCm > 0 &&
    typeof args.age === "number" && args.age > 0
  ) {
    bmrKcal = calculateBMR(args.sex, args.weightKg, args.heightCm, args.age);
  }

  return computeAdaptiveDataProgress({
    intakeByDay,
    weightByDay: args.weightByDay,
    entryCountByDay,
    bmrKcal,
    windowDays: args.windowDays,
  });
}

function dayWord(n: number): string {
  return n === 1 ? "day" : "days";
}

function weighInWord(n: number): string {
  return n === 1 ? "weigh-in" : "weigh-ins";
}

function buildMessage(args: {
  ready: boolean;
  daysShort: number;
  weighInsShort: number;
  excludedPartialDays: number;
  windowDays: number;
}): string {
  const { ready, daysShort, weighInsShort, excludedPartialDays } = args;

  if (ready) {
    // Both requirements met. The recompute is throttled (≤6h) + fires on the
    // next journal/weight write, so "shortly" is honest, not "once enough data
    // accumulates" (which is false — enough HAS accumulated).
    return "You have enough data — your adaptive maintenance will appear after the next recompute.";
  }

  const needs: string[] = [];
  if (weighInsShort > 0) {
    needs.push(`${weighInsShort} more ${weighInWord(weighInsShort)}`);
  }
  if (daysShort > 0) {
    needs.push(`${daysShort} more full logging ${dayWord(daysShort)}`);
  }

  const lead =
    needs.length === 2
      ? `${needs[0]} and ${needs[1]}`
      : needs[0] ?? "more data";

  // When the partial-day gate is what's holding logging days back, say so —
  // otherwise a user logging a snack a day reads "more full logging days" with
  // no idea their days *are* being logged, just not as full days.
  if (daysShort > 0 && excludedPartialDays > 0) {
    return `Need ${lead}. A full day clears a real day of eating (not a single snack), so partial days don't count yet.`;
  }

  return `Need ${lead} for an adaptive maintenance value that adjusts to your real burn.`;
}
