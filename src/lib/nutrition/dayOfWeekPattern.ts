/**
 * dayOfWeekPattern — pure helper that computes the highest-vs-lowest
 * average-kcal weekday across a rolling 4-week window.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" persona — speed
 * loggers like seeing "you eat 200 more on Saturdays" patterns).
 *
 * Surface: the optional `dayOfWeekPattern` field on `DigestStoryInput`.
 * The Digest narrative card renders it as a calm, observational line
 * ("You eat about 250 more kcal on Saturdays than Tuesdays.") — see
 * `digestStory.ts`.
 *
 * Gates (host SHOULD respect — this helper only does the math):
 *   - Suppressed when < 14 days of logged data (not enough signal).
 *   - Suppressed when high/low delta < 200 kcal (not meaningful).
 *
 * The gates live in `computeDayOfWeekPattern` itself so callers don't
 * have to repeat them across web + mobile. Returns `null` when either
 * gate fires; the consumer just passes the result through to
 * `DigestStoryInput.dayOfWeekPattern`.
 *
 * Pure module — no React, no I/O, no Date access (caller supplies
 * `now` for the rolling-window cutoff so tests are deterministic).
 */

import type { ByDayOf, MealMacros } from "./progressWeekReport";
import { dateKeyFromDate } from "./trackerStats";

/** Resolved pattern shape — matches `DigestStoryInput.dayOfWeekPattern`
 *  so the digest narrative can pass it straight through. */
export interface DayOfWeekPattern {
  /** Full English weekday label of the high-kcal day, e.g. "Saturday". */
  highDay: string;
  /** Full English weekday label of the low-kcal day, e.g. "Tuesday". */
  lowDay: string;
  /** Pre-rounded positive delta (high - low) in kcal. Always > 0 when
   *  the pattern is returned (pattern is null otherwise). */
  deltaKcal: number;
  /**
   * ENG-740 — pre-rounded mean kcal for the high day. Surfaced so the
   * blended Week-Digest PATTERN row can render a two-bar comparison
   * (Sun vs Fri). These are the same means the delta is derived from —
   * surfaced, never re-invented. Always > 0 when the pattern is
   * returned.
   */
  highDayAvg: number;
  /** ENG-740 — pre-rounded mean kcal for the low day (see `highDayAvg`). */
  lowDayAvg: number;
}

/** Minimum logged days inside the window before we surface a pattern.
 *  Below this we don't have enough days-per-weekday-bucket to trust
 *  the average and risk noise like "Wednesday 3500 kcal" from a single
 *  outlier day. */
export const DAY_OF_WEEK_PATTERN_MIN_DAYS = 14;

/** Minimum gap between the highest and lowest weekday averages before
 *  we surface a pattern. Below this the difference is within
 *  measurement / log-completeness noise and the line would feel
 *  arbitrary. */
export const DAY_OF_WEEK_PATTERN_MIN_DELTA_KCAL = 200;

/** Rolling-window length we sample (in days). 28 days = 4 weeks gives
 *  4 samples per weekday on average, which is enough to smooth out
 *  one-off events. */
export const DAY_OF_WEEK_PATTERN_WINDOW_DAYS = 28;

const FULL_WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Compute the day-of-week pattern from a `nutritionByDay` map.
 *
 * Algorithm:
 *   1. Walk back `WINDOW_DAYS` days from `now` (inclusive of today).
 *   2. For each day with ≥1 logged meal, compute its kcal sum and
 *      bucket it under that day's weekday (Sun..Sat).
 *   3. After the walk, drop weekdays with zero samples (otherwise a
 *      weekday the user has never logged on would tie with a real
 *      low-kcal day).
 *   4. Require ≥ `MIN_DAYS` total days logged across the window.
 *   5. For each remaining weekday compute the mean kcal across its
 *      samples.
 *   6. Pick the weekday with the highest mean and the weekday with
 *      the lowest mean. If they're the same weekday, return null.
 *   7. Require `(high - low) ≥ MIN_DELTA_KCAL`. Otherwise return null.
 *
 * Returns `null` when ANY gate fails — the caller passes the result
 * directly to `DigestStoryInput.dayOfWeekPattern` and the digest
 * narrative suppresses the line on null.
 */
export function computeDayOfWeekPattern<M extends MealMacros>(
  byDay: ByDayOf<M>,
  now: Date = new Date(),
): DayOfWeekPattern | null {
  // Per-weekday bucket: list of kcal sums, one entry per logged day.
  const buckets: number[][] = [[], [], [], [], [], [], []];
  let totalDaysLogged = 0;

  // Walk back WINDOW_DAYS days inclusive of today.
  for (let offset = 0; offset < DAY_OF_WEEK_PATTERN_WINDOW_DAYS; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const key = dateKeyFromDate(d);
    const meals = byDay[key];
    if (!meals || meals.length === 0) continue;

    // Sum kcal — clamp negatives to 0 to match `sumDay` in
    // `progressWeekReport.ts` so "weird" upstream rows don't
    // skew the pattern in the opposite direction.
    let kcal = 0;
    for (const m of meals) {
      if (Number.isFinite(m.calories) && m.calories > 0) {
        kcal += m.calories;
      }
    }
    if (kcal <= 0) continue;

    // d.getDay(): 0 = Sunday, 6 = Saturday.
    const dow = d.getDay();
    buckets[dow]!.push(kcal);
    totalDaysLogged += 1;
  }

  if (totalDaysLogged < DAY_OF_WEEK_PATTERN_MIN_DAYS) {
    return null;
  }

  // Compute mean kcal per weekday-with-samples. We deliberately exclude
  // weekdays with zero samples so a "never-logged Tuesday" doesn't
  // become the artificial low.
  let highIdx = -1;
  let highMean = -Infinity;
  let lowIdx = -1;
  let lowMean = Infinity;

  for (let i = 0; i < 7; i++) {
    const samples = buckets[i]!;
    if (samples.length === 0) continue;
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    if (mean > highMean) {
      highMean = mean;
      highIdx = i;
    }
    if (mean < lowMean) {
      lowMean = mean;
      lowIdx = i;
    }
  }

  // Need at least two distinct weekdays-with-samples.
  if (highIdx < 0 || lowIdx < 0 || highIdx === lowIdx) {
    return null;
  }

  const deltaKcal = Math.round(highMean - lowMean);
  if (deltaKcal < DAY_OF_WEEK_PATTERN_MIN_DELTA_KCAL) {
    return null;
  }

  return {
    highDay: FULL_WEEKDAY_LABELS[highIdx]!,
    lowDay: FULL_WEEKDAY_LABELS[lowIdx]!,
    deltaKcal,
    highDayAvg: Math.round(highMean),
    lowDayAvg: Math.round(lowMean),
  };
}
