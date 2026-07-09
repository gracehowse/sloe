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
 *   1. Walk back `WINDOW_DAYS` days from `windowEnd` (inclusive).
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
 *
 * `windowEnd` has no default (ENG-1373). A defaulted `now = new Date()`
 * let two call sites in the same render — one anchored on the digest's
 * *previous completed week* via `buildWeeklyRecap`, the other silently
 * anchored on wall-clock "today" via this function's old default — cite
 * weekdays that fell outside the week the digest was actually showing
 * ("Fridays ran higher than Thursdays" naming two days the digest said
 * were never logged). Forcing every caller to pass an explicit
 * `windowEnd` makes that mismatch a code-review-visible choice instead
 * of an invisible footgun. Callers that want "the rolling window ending
 * today" pass `new Date()` explicitly; `buildDigestWeekView` passes the
 * same anchor `buildWeeklyRecap` used for the week it's describing.
 */
export function computeDayOfWeekPattern<M extends MealMacros>(
  byDay: ByDayOf<M>,
  windowEnd: Date,
): DayOfWeekPattern | null {
  // Per-weekday bucket: list of kcal sums, one entry per logged day.
  const buckets: number[][] = [[], [], [], [], [], [], []];
  let totalDaysLogged = 0;

  // Walk back WINDOW_DAYS days inclusive of windowEnd.
  for (let offset = 0; offset < DAY_OF_WEEK_PATTERN_WINDOW_DAYS; offset++) {
    const d = new Date(windowEnd);
    d.setDate(windowEnd.getDate() - offset);
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

/** English weekday label → `Date#getDay()` index (0=Sun..6=Sat), for
 *  matching a pattern's `highDay`/`lowDay` label against the weekday
 *  of a `YYYY-MM-DD` key without re-parsing full Date objects. */
const WEEKDAY_LABEL_TO_INDEX: Readonly<Record<string, number>> =
  Object.freeze(
    FULL_WEEKDAY_LABELS.reduce<Record<string, number>>((acc, label, idx) => {
      acc[label] = idx;
      return acc;
    }, {}),
  );

/**
 * ENG-1373 — "both operands exist" gate for the day-of-week pattern.
 *
 * `computeDayOfWeekPattern` scans a rolling 28-day window that is
 * intentionally wider than any single displayed week (4 weeks of
 * samples are needed to trust a per-weekday mean). That is correct for
 * computing the pattern, but it means the pattern's `highDay`/`lowDay`
 * can legitimately name weekdays that never appear among the *specific*
 * week a digest card is currently showing — the exact bug in the
 * ticket ("Fridays ran higher than Thursdays" citing two days the
 * digest said were never logged for the displayed week).
 *
 * This gate answers a narrower question than `computeDayOfWeekPattern`
 * itself: given the pattern AND the digest week's own logged date-keys,
 * were BOTH the cited high day and low day actually logged in *this*
 * displayed week? If not, the narrative line would reference days the
 * reader can't see in the week they're looking at — suppress it.
 *
 * Returns `false` (suppress) when:
 *   - `pattern` is `null` (nothing to check), or
 *   - either `highDay` or `lowDay`'s weekday does not appear among
 *     `daysLoggedThisWeek`'s keys.
 *
 * `daysLoggedThisWeek` should be the digest week's own logged-day list
 * (e.g. `WeeklyRecap`'s underlying `bundle.days` filtered to
 * `calories > 0`, or equivalently any `{ key: "YYYY-MM-DD" }[]` of days
 * that actually had food logged in the displayed week) — NOT the full
 * 28-day pattern window.
 */
export function isDayOfWeekPatternWithinLoggedWeek(
  pattern: DayOfWeekPattern | null,
  daysLoggedThisWeek: ReadonlyArray<{ key: string }>,
): boolean {
  if (!pattern) return false;

  const loggedWeekdays = new Set<number>();
  for (const { key } of daysLoggedThisWeek) {
    // `key` is `YYYY-MM-DD`; parse as local-noon to avoid UTC-boundary
    // day-shift the same way `dayOfWeekPattern`'s own window walk does.
    const parts = key.split("-").map((n) => Number.parseInt(n, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) continue;
    const [y, m, d] = parts as [number, number, number];
    const parsed = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) continue;
    loggedWeekdays.add(parsed.getDay());
  }

  const highIdx = WEEKDAY_LABEL_TO_INDEX[pattern.highDay];
  const lowIdx = WEEKDAY_LABEL_TO_INDEX[pattern.lowDay];
  if (highIdx == null || lowIdx == null) return false;

  return loggedWeekdays.has(highIdx) && loggedWeekdays.has(lowIdx);
}
