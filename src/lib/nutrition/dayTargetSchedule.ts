/**
 * ENG-960 — weekday/weekend day-target schedules (training-day / rest-day
 * profiles, Julienne framing: "Lighter weekdays" / "A little more at
 * weekends" / "Same every day").
 *
 * The pure, headless-testable resolver behind per-day-class targets. Both
 * platforms (web ring/planner, mobile Today/planner via `@suppr/shared`) and
 * the daily_targets snapshot write share THIS one resolution so the effective
 * target for a date can never drift between surfaces.
 *
 * Product posture — strictly OPT-IN, nutrition-honest:
 *   - Storage reuses the existing (previously unused) `profiles`
 *     columns `calorie_schedule` (text preset id) + `high_days` (JSONB array
 *     of weekday indices, Sunday=0..Saturday=6). NULL / "same" / malformed →
 *     flat targets, identical to today's behaviour. No migration needed and
 *     no behaviour change for anyone who hasn't opted in.
 *   - Weekly-energy-NEUTRAL redistribution. A schedule never adds or removes
 *     energy from the week: high days get a boost, the remaining days are
 *     scaled down so the 7-day calorie total matches the flat plan. The
 *     user's goal pace is untouched — this is the honest version of
 *     "more at weekends", not a quiet target inflation.
 *   - Protein and fibre are held CONSTANT across the week. Protein targets
 *     are bodyweight-anchored, not energy-anchored — cycling them day-to-day
 *     has no evidential basis. The calorie delta is carried by carbs + fat,
 *     split pro-rata by their energy share in the base target (4 kcal/g carb,
 *     9 kcal/g fat) so the base carb:fat ratio is preserved.
 *   - Never bro-fitness framing: presets are calm day-class shapes, not
 *     "earn your food" mechanics. Copy lives with the pickers, not here.
 */

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Preset ids persisted in `profiles.calorie_schedule`. "same" (or NULL) is
 *  the default flat week — `parseDayTargetSchedule` returns null for it so
 *  every caller's no-schedule path stays byte-identical to today. */
export type DayTargetScheduleId = "weekend_lift" | "lighter_weekdays";

export type DayTargetSchedule = {
  id: DayTargetScheduleId;
  /** Weekday indices (Sunday=0..Saturday=6) that carry the HIGHER target. */
  highDays: WeekdayIndex[];
};

/** Default high-day set — the weekend. Stored explicitly on opt-in so the
 *  resolver always reads the DB value (a future UI can expose custom days
 *  without a data model change). */
export const DEFAULT_HIGH_DAYS: WeekdayIndex[] = [0, 6];

/**
 * Boost applied to a high day's calories per preset. The low-day factor is
 * DERIVED (weekly-neutral), never stored:
 *   lowFactor = (7 − boost·nHigh) / (7 − nHigh)
 * e.g. weekend_lift with 2 high days → high ×1.10, low ×0.96.
 *      lighter_weekdays with 2 high days → high ×1.20, low ×0.92.
 */
export const DAY_TARGET_SCHEDULE_BOOST: Record<DayTargetScheduleId, number> = {
  weekend_lift: 1.1,
  lighter_weekdays: 1.2,
};

/** Safety rail — a low day is never scaled below this factor, even for a
 *  pathological stored high-day set (e.g. 6 high days). The shipped UI only
 *  writes the 2-day weekend set, where this clamp is unreachable; when it
 *  does clamp, strict weekly neutrality is sacrificed for a sane floor. */
export const MIN_LOW_DAY_FACTOR = 0.7;

/**
 * Parse the persisted pair (`profiles.calorie_schedule`, `profiles.high_days`)
 * into a schedule, or null when the user hasn't opted in. Tolerant of
 * malformed values — anything unrecognised resolves to null (flat week)
 * rather than throwing or guessing:
 *   - unknown / "same" / empty schedule id → null
 *   - high_days not an array of 1..6 distinct in-range ints → fall back to
 *     the weekend default (the preset still means what the user picked).
 */
export function parseDayTargetSchedule(
  calorieScheduleRaw: unknown,
  highDaysRaw: unknown,
): DayTargetSchedule | null {
  if (calorieScheduleRaw !== "weekend_lift" && calorieScheduleRaw !== "lighter_weekdays") {
    return null;
  }
  const id = calorieScheduleRaw;

  const highDays = normaliseHighDays(highDaysRaw);
  return { id, highDays };
}

function normaliseHighDays(raw: unknown): WeekdayIndex[] {
  if (!Array.isArray(raw)) return [...DEFAULT_HIGH_DAYS];
  const seen = new Set<WeekdayIndex>();
  for (const v of raw) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6) {
      seen.add(v as WeekdayIndex);
    }
  }
  // 0 high days is "flat" and 7 is "flat at a different number" — neither is
  // a meaningful cycle, so both fall back to the weekend default.
  if (seen.size === 0 || seen.size === 7) return [...DEFAULT_HIGH_DAYS];
  return [...seen].sort((a, b) => a - b);
}

/** Local-date weekday for a `YYYY-MM-DD` date key (Sunday=0..Saturday=6).
 *  Date keys in this codebase are written in the user's local tz, so the
 *  weekday is derived calendar-only (UTC construction — no tz re-shift).
 *  Returns null for malformed keys so callers can fall back to flat. */
export function weekdayIndexFromDateKey(dateKey: string): WeekdayIndex | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  if (!Number.isFinite(t)) return null;
  return new Date(t).getUTCDay() as WeekdayIndex;
}

export type BaseDayTargets = {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number | null;
};

export type DayClass = "base" | "higher" | "lighter";

export type EffectiveDayTargets = {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** Which side of the schedule this day sits on ("base" = flat / no schedule). */
  dayClass: DayClass;
  /** True iff the schedule changed this day's numbers vs the flat base. */
  adjusted: boolean;
};

/**
 * Resolve the effective targets for one weekday under a schedule.
 *
 * Calories: high day → base × boost; low day → base × lowFactor (derived,
 * weekly-neutral, clamped at `MIN_LOW_DAY_FACTOR`). Rounded to the nearest
 * 5 kcal (calm display; the ≤2 kcal/day rounding drift is deliberate).
 *
 * Macros: protein + fibre pass through untouched. Carbs + fat absorb the
 * calorie delta pro-rata by base energy share; if the base has no carb/fat
 * grams to split against, macro targets pass through unchanged (the calorie
 * line still cycles).
 *
 * `schedule = null` (not opted in) returns the base values verbatim with
 * `dayClass: "base"` — the flat path is a pure identity.
 */
export function resolveEffectiveDayTargets(
  base: BaseDayTargets,
  schedule: DayTargetSchedule | null,
  weekday: WeekdayIndex,
): EffectiveDayTargets {
  const flat: EffectiveDayTargets = {
    calories: base.calories,
    proteinG: base.proteinG,
    carbsG: base.carbsG,
    fatG: base.fatG,
    fiberG: base.fiberG ?? null,
    dayClass: "base",
    adjusted: false,
  };
  if (!schedule) return flat;
  if (!Number.isFinite(base.calories) || base.calories <= 0) return flat;

  const nHigh = schedule.highDays.length;
  if (nHigh === 0 || nHigh === 7) return flat;

  const boost = DAY_TARGET_SCHEDULE_BOOST[schedule.id];
  const isHigh = schedule.highDays.includes(weekday);
  const lowFactor = Math.max(MIN_LOW_DAY_FACTOR, (7 - boost * nHigh) / (7 - nHigh));
  const factor = isHigh ? boost : lowFactor;

  const effCalories = roundTo5(base.calories * factor);
  const deltaKcal = effCalories - base.calories;

  let carbsG = base.carbsG;
  let fatG = base.fatG;
  const baseCarbKcal = (base.carbsG ?? 0) * 4;
  const baseFatKcal = (base.fatG ?? 0) * 9;
  const macroKcal = baseCarbKcal + baseFatKcal;
  if (macroKcal > 0) {
    const carbShare = baseCarbKcal / macroKcal;
    if (base.carbsG != null) {
      carbsG = Math.max(0, Math.round(base.carbsG + (deltaKcal * carbShare) / 4));
    }
    if (base.fatG != null) {
      fatG = Math.max(0, Math.round(base.fatG + (deltaKcal * (1 - carbShare)) / 9));
    }
  }

  return {
    calories: effCalories,
    proteinG: base.proteinG,
    carbsG,
    fatG,
    fiberG: base.fiberG ?? null,
    dayClass: isHigh ? "higher" : "lighter",
    adjusted: effCalories !== base.calories || carbsG !== base.carbsG || fatG !== base.fatG,
  };
}

/** Convenience wrapper — resolve for a `YYYY-MM-DD` date key. Malformed keys
 *  resolve flat (never throw, never guess a day). */
export function effectiveTargetsForDateKey(
  base: BaseDayTargets,
  schedule: DayTargetSchedule | null,
  dateKey: string,
): EffectiveDayTargets {
  const weekday = weekdayIndexFromDateKey(dateKey);
  if (weekday == null) return resolveEffectiveDayTargets(base, null, 0);
  return resolveEffectiveDayTargets(base, schedule, weekday);
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}
