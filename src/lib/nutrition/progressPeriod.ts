/**
 * Progress-tab time-period model — Apple Health range grammar (ENG-1030).
 *
 * Replaces the old `rangeKey` ("7d" | "30d" | "90d" | "all") relative-window
 * model with Apple Health's calendar-anchored grammar: **D / W / M / 6M / Y**,
 * plus horizontal *period paging* (swipe / chevrons move prev↔next period).
 *
 * Apple has no "All" range — Y + paging covers history — so "all" is removed
 * here too (superseded by paging).
 *
 * Shared so mobile (`apps/mobile/app/(tabs)/progress.tsx`) and web
 * (`src/app/components/ProgressDashboard.tsx`) compute identical windows and
 * labels. Mobile imports this via the `@suppr/shared/nutrition/progressPeriod`
 * alias (metro maps `@suppr/shared` → `src/lib`).
 *
 * Everything here is pure, React-free, platform-free, and operates on **local
 * calendar dates** (never UTC) so a period boundary lands on the user's
 * midnight, DST transitions included. The `Date` arithmetic uses
 * `getFullYear/getMonth/getDate` + the day-of-month constructor, which is the
 * repo's canonical DST-safe local-date pattern (see `journalNavigation.ts`,
 * `trackerDate.ts`). We never add raw milliseconds across a boundary.
 *
 * Unit-tested exhaustively via `tests/unit/progressPeriod.test.ts`.
 */

export type PeriodType = "D" | "W" | "M" | "6M" | "Y";

export type WeekStartDay = "monday" | "sunday";

/**
 * A selected period on the Progress tab.
 * - `type` is the granularity (Apple's D/W/M/6M/Y).
 * - `offset` is signed and `<= 0`: `0` is the period containing `now`,
 *   `-1` is the previous period, etc. Positive offsets (the future) are
 *   never allowed — the picker clamps right-swipes at `0`.
 */
export interface ProgressPeriod {
  type: PeriodType;
  /** Number of whole periods back from "now". `0` = current, negative = past. */
  offset: number;
}

/** Inclusive local-calendar window for a period: [startKey, endKey] "YYYY-MM-DD". */
export interface PeriodWindow {
  startKey: string;
  endKey: string;
}

/** The full default selection on first render: the current week. */
export const DEFAULT_PERIOD: ProgressPeriod = { type: "W", offset: 0 };

/** The five segments in Apple's left→right order. */
export const PERIOD_TYPES: readonly PeriodType[] = ["D", "W", "M", "6M", "Y"] as const;

/** Short segment label shown on the segmented control. */
export function periodTypeLabel(type: PeriodType): string {
  // Apple renders these as single glyphs (D / W / M / 6M / Y).
  return type;
}

/** Accessible long label for the segmented control + screen readers. */
export function periodTypeAccessibilityLabel(type: PeriodType): string {
  switch (type) {
    case "D":
      return "Day";
    case "W":
      return "Week";
    case "M":
      return "Month";
    case "6M":
      return "Six months";
    case "Y":
      return "Year";
  }
}

/* ------------------------------------------------------------------ *
 * Local-date primitives (DST-safe — calendar arithmetic, never ms).  *
 * ------------------------------------------------------------------ */

/** Local "YYYY-MM-DD" for a Date (its own timezone, midnight-insensitive). */
export function periodDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight Date for a "YYYY-MM-DD" key. */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Strip a Date to local midnight (new instance). */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Add `n` whole calendar days in local time (DST-safe). */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Add `n` whole calendar months in local time; clamps overflow days. */
function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  // `new Date(y, m, 1)` normalises the month; we keep day = 1 because every
  // call site here works from a month's first day. (Month-length safe — Feb,
  // 30/31-day months, and year wrap all fall out of JS's own normalisation.)
  return new Date(y, m, 1);
}

/** First day (local midnight) of the week containing `d`, honouring weekStart. */
function startOfWeek(d: Date, weekStart: WeekStartDay): Date {
  const x = atMidnight(d);
  const dow = x.getDay(); // 0 = Sun … 6 = Sat
  const offset = weekStart === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  return addDays(x, offset);
}

/** First day (local midnight) of the calendar month containing `d`. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** First day (local midnight) of the calendar year containing `d`. */
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/**
 * First month of the half-year block containing `d`.
 * Apple anchors 6M on Jan and Jul: block 0 = Jan–Jun, block 1 = Jul–Dec.
 */
function startOfHalfYear(d: Date): Date {
  const half = d.getMonth() < 6 ? 0 : 6;
  return new Date(d.getFullYear(), half, 1);
}

/* ------------------------------------------------------------------ *
 * Window computation.                                                *
 * ------------------------------------------------------------------ */

/**
 * Inclusive local window for a period, relative to `now`.
 *
 * For each type we anchor the *current* period to the calendar unit
 * containing `now`, then shift by `offset` whole units:
 *  - D  → a single day
 *  - W  → 7 days from the week start (weekStart-aware)
 *  - M  → the calendar month
 *  - 6M → the 6 calendar months of the Jan–Jun / Jul–Dec block
 *  - Y  → the calendar year
 *
 * `offset` is clamped at `0` (no future) by the caller's paging guard; this
 * function honours whatever offset it's given, so a positive offset would
 * return a future window. Use {@link clampOffsetToPresent} at the edges.
 */
export function periodWindow(
  period: ProgressPeriod,
  weekStart: WeekStartDay,
  now: Date = new Date(),
): PeriodWindow {
  const { type, offset } = period;
  const base = atMidnight(now);

  switch (type) {
    case "D": {
      const start = addDays(base, offset);
      return { startKey: periodDateKey(start), endKey: periodDateKey(start) };
    }
    case "W": {
      const thisWeek = startOfWeek(base, weekStart);
      const start = addDays(thisWeek, offset * 7);
      const end = addDays(start, 6);
      return { startKey: periodDateKey(start), endKey: periodDateKey(end) };
    }
    case "M": {
      const thisMonth = startOfMonth(base);
      const start = addMonths(thisMonth, offset);
      const end = addDays(addMonths(start, 1), -1); // last day of the month
      return { startKey: periodDateKey(start), endKey: periodDateKey(end) };
    }
    case "6M": {
      const thisBlock = startOfHalfYear(base);
      const start = addMonths(thisBlock, offset * 6);
      const end = addDays(addMonths(start, 6), -1);
      return { startKey: periodDateKey(start), endKey: periodDateKey(end) };
    }
    case "Y": {
      const thisYear = startOfYear(base);
      const start = addMonths(thisYear, offset * 12);
      const end = addDays(addMonths(start, 12), -1);
      return { startKey: periodDateKey(start), endKey: periodDateKey(end) };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Paging.                                                            *
 * ------------------------------------------------------------------ */

/**
 * Clamp an offset to the present: never allow paging into the future.
 * The current period's offset is `0`; anything `> 0` snaps back to `0`.
 */
export function clampOffsetToPresent(offset: number): number {
  return offset > 0 ? 0 : offset;
}

/**
 * Whether the period is the most-recent one (paging right is disabled).
 * True whenever `offset >= 0`.
 */
export function isCurrentPeriod(period: ProgressPeriod): boolean {
  return period.offset >= 0;
}

/**
 * Move one period **earlier** (older). Always allowed (history is bounded
 * only by data availability, which the chart handles by rendering empty).
 */
export function previousPeriod(period: ProgressPeriod): ProgressPeriod {
  return { type: period.type, offset: period.offset - 1 };
}

/**
 * Move one period **later** (newer), clamped so the offset never exceeds 0.
 * Returns the same period when already current (the caller should disable the
 * forward affordance via {@link isCurrentPeriod}).
 */
export function nextPeriod(period: ProgressPeriod): ProgressPeriod {
  return { type: period.type, offset: clampOffsetToPresent(period.offset + 1) };
}

/**
 * Switch segment (D→W→M→6M→Y) while keeping the user roughly where they were
 * in time. Apple resets to the *current* period of the new granularity, which
 * is the least surprising behaviour (offset 0). We mirror that: changing the
 * segment snaps `offset` back to 0.
 */
export function withPeriodType(_period: ProgressPeriod, type: PeriodType): ProgressPeriod {
  return { type, offset: 0 };
}

/* ------------------------------------------------------------------ *
 * Labels.                                                            *
 * ------------------------------------------------------------------ */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Human label rendered above the charts for a period — Apple-style:
 *  - D  → "Wed 10 Jun"
 *  - W  → "15–21 Jun" (or "29 Jun – 5 Jul" / "29 Dec 2025 – 4 Jan 2026" across boundaries)
 *  - M  → "June 2026"
 *  - 6M → "Jan – Jun 2026"
 *  - Y  → "2026"
 *
 * Years are shown only when they add information (cross-year weeks, or any
 * window whose year differs from `now`'s year) so the common case stays terse.
 */
export function periodLabel(
  period: ProgressPeriod,
  weekStart: WeekStartDay,
  now: Date = new Date(),
): string {
  const { startKey, endKey } = periodWindow(period, weekStart, now);
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  const nowYear = now.getFullYear();

  switch (period.type) {
    case "D": {
      const wd = WEEKDAYS_SHORT[start.getDay()];
      const yearSuffix = start.getFullYear() !== nowYear ? ` ${start.getFullYear()}` : "";
      return `${wd} ${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}${yearSuffix}`;
    }
    case "W": {
      const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
      const sameYear = start.getFullYear() === end.getFullYear();
      const crossesYear = !sameYear;
      // Show the year on each end only when the week straddles a year change,
      // or when the whole week sits in a non-current year.
      const startYearSuffix = crossesYear ? ` ${start.getFullYear()}` : "";
      const endYearSuffix =
        crossesYear || end.getFullYear() !== nowYear ? ` ${end.getFullYear()}` : "";
      if (sameMonth) {
        // "15–21 Jun" (+ year suffix when not the current year)
        const yr = start.getFullYear() !== nowYear ? ` ${start.getFullYear()}` : "";
        return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[start.getMonth()]}${yr}`;
      }
      // "29 Jun – 5 Jul" / "29 Dec 2025 – 4 Jan 2026"
      return (
        `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}${startYearSuffix}` +
        ` – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}${endYearSuffix}`
      );
    }
    case "M": {
      return `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`;
    }
    case "6M": {
      // "Jan – Jun 2026" / "Jul – Dec 2026"
      return `${MONTHS_SHORT[start.getMonth()]} – ${MONTHS_SHORT[end.getMonth()]} ${start.getFullYear()}`;
    }
    case "Y": {
      return `${start.getFullYear()}`;
    }
  }
}

/**
 * Overline label describing the *averaging window* for the adherence card,
 * e.g. "THIS WEEK" / "JUNE" / "2026" — past tense / present aware copy is the
 * caller's job; this returns the neutral window descriptor.
 */
export function periodAdherenceOverline(
  period: ProgressPeriod,
  weekStart: WeekStartDay,
  now: Date = new Date(),
): string {
  const current = isCurrentPeriod(period);
  switch (period.type) {
    case "D":
      return current ? "TODAY" : periodLabel(period, weekStart, now).toUpperCase();
    case "W":
      return current ? "THIS WEEK" : periodLabel(period, weekStart, now).toUpperCase();
    case "M": {
      const { startKey } = periodWindow(period, weekStart, now);
      const start = dateFromKey(startKey);
      return current ? "THIS MONTH" : MONTHS_LONG[start.getMonth()].toUpperCase();
    }
    case "6M":
      return current ? "LAST 6 MONTHS" : periodLabel(period, weekStart, now).toUpperCase();
    case "Y": {
      const { startKey } = periodWindow(period, weekStart, now);
      const start = dateFromKey(startKey);
      return current ? "THIS YEAR" : `${start.getFullYear()}`;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Window filtering helpers (replacing the old `rangeKey` cutoff).    *
 * ------------------------------------------------------------------ */

/**
 * Filter a map keyed by "YYYY-MM-DD" to the inclusive period window.
 * String comparison is correct because keys are zero-padded ISO dates.
 */
export function filterMapToPeriod<T>(
  map: Record<string, T>,
  period: ProgressPeriod,
  weekStart: WeekStartDay,
  now: Date = new Date(),
): [string, T][] {
  const { startKey, endKey } = periodWindow(period, weekStart, now);
  return Object.entries(map).filter(([k]) => k >= startKey && k <= endKey);
}

/* ------------------------------------------------------------------ *
 * Weight-chart bridge.                                               *
 * ------------------------------------------------------------------ */

/**
 * The `WeightChart` / `computeWeightTrend` range union (mirrors
 * `src/lib/progress/weightTrend.ts` `WeightRange`, declared here so this file
 * stays import-cycle-free and mobile-importable without an `@/` alias).
 */
export type WeightChartRange = "1w" | "1m" | "3m" | "1y" | "all";

/**
 * Map a period to the `WeightChart` bucketing range. The chart computes its
 * own trailing window of N days ending at its `nowISO` anchor, so the bucket
 * strategy is what matters here:
 *   D  → 1w  (a single day still renders the surrounding week's daily dots)
 *   W  → 1w  (daily dots)
 *   M  → 1m  (daily dots, ~30-day window)
 *   6M → 3m  (weekly buckets — closest readable smoothing for a half-year)
 *   Y  → 1y  (monthly buckets)
 *
 * Pair with {@link periodChartAnchorISO} so paged periods end the trailing
 * window at the period boundary, not at "today".
 */
export function progressPeriodToWeightRange(type: PeriodType): WeightChartRange {
  switch (type) {
    case "D":
      return "1w";
    case "W":
      return "1w";
    case "M":
      return "1m";
    case "6M":
      return "3m";
    case "Y":
      return "1y";
  }
}

/**
 * The ISO date the weight chart should treat as "now" for this period — the
 * period's inclusive end day. Passing this as `computeWeightTrend`'s `nowISO`
 * anchors the trailing window to the period boundary so paging back actually
 * moves the chart's window (otherwise every page would still end today).
 */
export function periodChartAnchorISO(
  period: ProgressPeriod,
  weekStart: WeekStartDay,
  now: Date = new Date(),
): string {
  const { endKey } = periodWindow(period, weekStart, now);
  const todayKey = periodDateKey(now);
  // Never anchor the chart in the future — clamp the current period's end
  // (e.g. the rest of this month) back to today.
  return endKey > todayKey ? todayKey : endKey;
}
