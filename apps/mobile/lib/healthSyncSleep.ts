/**
 * Apple Health `SleepAnalysis` → per-local-day "minutes actually asleep".
 * ENG-1584.
 *
 * Pulled out of `healthSync.ts` (mirrors the file's existing pattern of
 * giving non-trivial HealthKit-adjacent logic its own module —
 * `healthSyncCorrelation.ts`, `healthDietaryNutrients.ts`,
 * `nutritionImportDedup.ts` — so it can be unit-tested without a native
 * bridge or a Supabase mock).
 *
 * ─── Why not just sum every sample's duration? ────────────────────────
 * `react-native-health`'s `getSleepSamples` bridges `HKCategorySample`s
 * for `HKCategoryTypeIdentifierSleepAnalysis` and maps the raw
 * `HKCategoryValueSleepAnalysis` integer to a STRING (see
 * `node_modules/react-native-health/RCTAppleHealthKit/RCTAppleHealthKit+Queries.m`,
 * `fetchSleepCategorySamplesForPredicate`) — unlike every other
 * `get*Samples` call in `healthSync.ts`, whose `HealthValue.value` is a
 * plain number. The values are:
 *
 *   INBED  — device/user marked "in bed", not necessarily asleep
 *   ASLEEP — legacy undifferentiated bucket (pre-iOS 16 sources, or any
 *            source that doesn't report sleep stages)
 *   CORE / DEEP / REM — iOS 16 + watchOS 9 sleep-stage detail
 *   AWAKE  — awake within a tracked sleep session (e.g. a night waking)
 *   UNKNOWN — native bridge default for an HKCategoryValue it doesn't
 *            recognise
 *
 * Treating every sample as "asleep" would count time spent lying awake
 * in bed (INBED) and time awake mid-session (AWAKE) as sleep — a
 * meaningfully wrong number, not a rounding error. Only ASLEEP / CORE /
 * DEEP / REM count. UNKNOWN is excluded rather than guessed at (the
 * project's "if uncertain, do not guess" rule extended from nutrition
 * to this data too).
 *
 * ─── Why merge overlapping intervals? ─────────────────────────────────
 * A single night commonly has more than one contributing source (an
 * Apple Watch's actual sleep-stage tracking *and* an iPhone's
 * motion-based "in bed" estimate, or a second HealthKit-writing app).
 * `getSleepSamples` returns raw per-source samples, not a deduplicated
 * HealthKit statistics collection — naively summing every asleep-typed
 * sample's duration double-counts any night with more than one source,
 * which is the common case, not an edge case. Overlapping/adjacent
 * asleep intervals are merged (interval union) before their durations
 * are summed.
 *
 * ─── Day bucketing ─────────────────────────────────────────────────────
 * A merged asleep interval that spans local midnight (the normal case —
 * most sleep sessions do) is split at each local-midnight boundary it
 * crosses, and each fragment's minutes are credited to the local
 * calendar day it falls in (`dateKeyFromDate`, the shared local-day
 * helper — ENG-717 / ENG-1540). This differs from `workouts_by_day`
 * (bucketed by the sample's raw `startDate` only) because a workout
 * rarely spans midnight and a duration-weighted split isn't needed
 * there; a sleep session almost always spans it.
 */
import { dateKeyFromDate } from "@suppr/shared/datetime/dateKey";

/** Raw shape `hk.getSleepSamples` hands back per element (see module docblock). */
export type RawSleepSample = {
  id?: string;
  /** One of INBED/ASLEEP/CORE/DEEP/REM/AWAKE/UNKNOWN — see module docblock. */
  value: string;
  startDate: string;
  endDate: string;
  sourceName?: string;
  sourceId?: string;
};

/** `HKCategoryValueSleepAnalysis` strings that represent genuine sleep time. */
const ASLEEP_VALUES: ReadonlySet<string> = new Set([
  "ASLEEP",
  "CORE",
  "DEEP",
  "REM",
]);

/** True for the sleep-stage values that count as time asleep (not in-bed/awake/unknown). */
export function isAsleepSampleValue(value: string): boolean {
  return ASLEEP_VALUES.has(value.toUpperCase());
}

export type MsInterval = { startMs: number; endMs: number };

/**
 * Sort ascending by start, then merge any interval that overlaps or
 * touches the previous one. Multiple HealthKit sources reporting the
 * same (or overlapping) stretch of a night collapse into one interval
 * instead of having their durations double-counted.
 */
export function mergeIntervals(intervals: MsInterval[]): MsInterval[] {
  const valid = intervals.filter(
    (iv) =>
      Number.isFinite(iv.startMs) &&
      Number.isFinite(iv.endMs) &&
      iv.endMs > iv.startMs,
  );
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => a.startMs - b.startMs);
  const merged: MsInterval[] = [{ ...sorted[0]! }];
  for (const iv of sorted.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (iv.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, iv.endMs);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/**
 * Split `[startMs, endMs)` at every local-midnight boundary it crosses,
 * crediting each fragment's minutes to the local calendar day
 * (`dateKeyFromDate`) it falls in. Guarded against a pathological
 * multi-week sample (a bad HealthKit write, not a real night) with a
 * hard iteration cap rather than looping unbounded.
 */
export function splitIntervalIntoLocalDayMinutes(
  startMs: number,
  endMs: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return out;
  }
  let cursor = startMs;
  let guard = 0;
  const MAX_DAY_SPLITS = 64;
  while (cursor < endMs && guard < MAX_DAY_SPLITS) {
    guard += 1;
    const cursorDate = new Date(cursor);
    const nextLocalMidnightMs = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      cursorDate.getDate() + 1,
      0,
      0,
      0,
      0,
    ).getTime();
    const segmentEndMs = Math.min(endMs, nextLocalMidnightMs);
    const minutes = (segmentEndMs - cursor) / 60_000;
    const key = dateKeyFromDate(cursorDate);
    out[key] = (out[key] ?? 0) + minutes;
    cursor = segmentEndMs;
  }
  return out;
}

/**
 * Full pipeline: raw HealthKit sleep samples → per-local-day minutes
 * actually asleep. Filters to genuine asleep states, merges overlapping
 * multi-source intervals, splits across local-midnight boundaries, sums,
 * and rounds to the nearest minute.
 */
export function aggregateAsleepMinutesByDay(
  samples: readonly RawSleepSample[],
): Record<string, number> {
  const asleepIntervals: MsInterval[] = samples
    .filter((s) => isAsleepSampleValue(s.value))
    .map((s) => ({
      startMs: new Date(s.startDate).getTime(),
      endMs: new Date(s.endDate).getTime(),
    }));

  const merged = mergeIntervals(asleepIntervals);

  const totals: Record<string, number> = {};
  for (const iv of merged) {
    const perDay = splitIntervalIntoLocalDayMinutes(iv.startMs, iv.endMs);
    for (const [key, minutes] of Object.entries(perDay)) {
      totals[key] = (totals[key] ?? 0) + minutes;
    }
  }

  const rounded: Record<string, number> = {};
  for (const [key, minutes] of Object.entries(totals)) {
    rounded[key] = Math.round(minutes);
  }
  return rounded;
}
