import { dateKeyFromDate } from "./nutrition/trackerStats";

/**
 * Weight projection utility.
 *
 * Uses the 3500-calorie rule (rough estimate):
 *   - 3500 kcal surplus ≈ +0.45 kg (1 lb)
 *   - 3500 kcal deficit ≈ -0.45 kg (1 lb)
 *
 * Also provides a timeline-based projection using recent weight trend data.
 */

const KCAL_PER_KG = 7700; // ~3500 kcal/lb * 2.2 lb/kg

/**
 * ENG-1029 — hard horizon for the LINEAR 7700 kcal/kg projection.
 *
 * The flat `(intake − TDEE) / 7700` rule is the universal consumer
 * convention and is correctly mitigated here (5-week cap, observed-trend
 * override, water/glycogen caveat in the copy). But the linear rule
 * over-estimates loss over long horizons — body weight does not fall in a
 * straight line because energy expenditure adapts as you lose (Hall et
 * al., Int J Obes 2013). So the linear path must NEVER feed a display
 * longer than this. Longer horizons need the observed scale trend or a
 * decaying model — not this function.
 *
 * Enforced by `assertLinearHorizon` below: in development a `weeksOut`
 * past this cap on the FORMULA path throws (so a new caller that wires a
 * longer horizon trips a test immediately); in production it is clamped
 * defensively rather than rendering a misleading number. The observed-
 * trend path is exempt — a measured rate over a longer window is a real
 * signal, not the linear extrapolation this guards.
 */
export const MAX_LINEAR_PROJECTION_WEEKS = 5;

/**
 * ENG-1029 — dev-time guard. Throws in development when the linear
 * formula path is asked to project past `MAX_LINEAR_PROJECTION_WEEKS`, so
 * a future surface that stretches the horizon fails loudly in tests
 * rather than silently shipping a biased long-range number. Pure (no I/O
 * beyond the throw) and a no-op in production builds — the caller clamps
 * the horizon there.
 */
export function assertLinearHorizon(weeksOut: number, usingObservedTrend: boolean): void {
  if (usingObservedTrend) return; // observed rate is a measured signal, not the linear rule
  if (weeksOut > MAX_LINEAR_PROJECTION_WEEKS && process.env.NODE_ENV !== "production") {
    throw new Error(
      `[weightProjection] linear 7700 kcal/kg projection requested for ${weeksOut} ` +
        `weeks, past the ${MAX_LINEAR_PROJECTION_WEEKS}-week cap. The linear rule ` +
        `over-estimates loss over long horizons (Hall 2013) — use the observed ` +
        `scale trend or a decaying model for longer displays.`,
    );
  }
}

/**
 * Action 13 Item #8 (2026-04-19) — minimum number of recent food-logged
 * days required before the "On track for X kg in N weeks" projection is
 * shown to the user.
 *
 * Below this floor the average is too noisy to project from honestly
 * (a 2-day average can be 700 kcal off the user's real average). The
 * Progress dashboard renders the projection block only when the input
 * has ≥`MIN_DAYS_FOR_PROJECTION` days; below the floor it suppresses
 * the line entirely rather than back-filling with placeholder copy.
 *
 * Pinned by `tests/unit/weightProjectionFloor.test.ts`.
 */
export const MIN_DAYS_FOR_PROJECTION = 5;

/**
 * Pure gate — returns `true` when the projection block can render.
 * Wraps the floor so both web and mobile can ask the same question
 * with one helper call (and a future change to the floor lands in one
 * place).
 */
export function shouldRenderDailyProjection(daysWithFood: number): boolean {
  return Number.isFinite(daysWithFood) && daysWithFood >= MIN_DAYS_FOR_PROJECTION;
}

/**
 * Most recent logged body weight: latest calendar day in `weight_kg_by_day`, otherwise profile `weight_kg`.
 * (Profile alone can lag behind Health / manual map entries.)
 */
export function resolveLatestWeightKg(
  weightKgByDay: Record<string, number>,
  weightKg: number | null,
): number | null {
  const entries = Object.entries(weightKgByDay).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v),
  ) as [string, number][];
  if (entries.length === 0) {
    return weightKg != null && Number.isFinite(weightKg) ? weightKg : null;
  }
  entries.sort(([a], [b]) => b.localeCompare(a));
  return entries[0][1];
}

export type DailyProjection = {
  /** Projected weight in kg if every day matched today's intake */
  projectedWeightKg: number;
  /** Number of weeks for the projection */
  projectionWeeks: number;
  /** Daily calorie surplus/deficit vs TDEE */
  dailySurplusDeficit: number;
  /** Whether user is in deficit or surplus */
  direction: "deficit" | "surplus" | "maintenance";
};

/**
 * Project weight change based on today's calorie intake vs TDEE/target.
 *
 * @param currentWeightKg    - User's current weight.
 * @param todayCalories      - Total calories consumed today.
 * @param targetCalories     - Daily calorie target (adjusted TDEE for the goal).
 * @param maintenanceTdeeKcal - **Preferred input** — the user's actual
 *   maintenance TDEE (static Mifflin or adaptive). When provided and > 0 this
 *   is used as the break-even number. Callers should always pass it when
 *   available (see `getEffectiveTDEE` in `src/lib/calcTargets.ts`).
 * @param goal               - User's goal: "lose", "gain", or "maintain".
 *   Only used when `maintenanceTdeeKcal` is missing as a crude fallback
 *   (target + 500 for "lose", target − 300 for "gain", target otherwise).
 *   Fallback is intentionally coarse — pass the real TDEE instead of
 *   relying on it. Bug history: before 2026-04-18 this was the only path,
 *   which flagged users whose actual burn exceeded `target + 500` as
 *   gaining weight even when they were in a real deficit (TestFlight
 *   feedback `ALkK-XrcMz_V-D6NrjuVYbo`).
 * @param weeksOut           - How many weeks to project (default 5).
 */
export function projectWeight(opts: {
  currentWeightKg: number;
  todayCalories: number;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  weeksOut?: number;
  /**
   * F-126 (Grace, 2026-05-07): observed weight rate from the trend
   * line (kg/week, signed — negative = losing). When provided AND
   * non-trivial (|rate| ≥ 0.05 kg/week) AND the direction matches
   * the deficit-implied direction, this OVERRIDES the formula
   * projection. The formula uses (intake - TDEE) / 7700 which under-
   * estimates loss when the user's actual maintenance is higher than
   * the engine's estimate (or above the engine's confidence floor).
   * Trusting the observed scale is the correct call: the scale is
   * ground truth, the formula is a model.
   */
  observedKgPerWeek?: number | null;
}): DailyProjection {
  const {
    currentWeightKg,
    todayCalories,
    targetCalories,
    maintenanceTdeeKcal,
    goal,
    weeksOut = 5,
    observedKgPerWeek,
  } = opts;

  let estimatedTdee: number;
  if (
    typeof maintenanceTdeeKcal === "number" &&
    Number.isFinite(maintenanceTdeeKcal) &&
    maintenanceTdeeKcal > 0
  ) {
    estimatedTdee = maintenanceTdeeKcal;
  } else if (goal === "lose") {
    estimatedTdee = targetCalories + 500;
  } else if (goal === "gain") {
    estimatedTdee = targetCalories - 300;
  } else {
    estimatedTdee = targetCalories;
  }

  const dailySurplusDeficit = todayCalories - estimatedTdee;

  // F-126: prefer the observed weekly rate when it's reliable + agrees
  // in direction with the formula. "Agrees" guards against using a
  // noise spike (e.g. one week of water-weight loss) that contradicts
  // the user's actual eating pattern. When the observed rate is
  // non-trivial and direction-aligned, use it; otherwise fall back to
  // the formula projection so first-week users still get a number.
  const formulaWeeklyKg = (dailySurplusDeficit * 7) / KCAL_PER_KG;
  const observed =
    typeof observedKgPerWeek === "number" && Number.isFinite(observedKgPerWeek)
      ? observedKgPerWeek
      : 0;
  const observedReliable = Math.abs(observed) >= 0.05;
  const directionMatches =
    formulaWeeklyKg === 0 ||
    Math.sign(formulaWeeklyKg) === Math.sign(observed) ||
    observed === 0;
  const useObserved = observedReliable && directionMatches;

  // ENG-1029 — never let the linear 7700 rule project past the 5-week cap.
  // Dev: throw (a longer-horizon caller trips this in tests). Production:
  // clamp the horizon defensively so we never render a biased long-range
  // linear number. The observed-trend path is exempt — it's a measured
  // rate, not the linear extrapolation this guards.
  assertLinearHorizon(weeksOut, useObserved);
  const effectiveWeeksOut = useObserved
    ? weeksOut
    : Math.min(weeksOut, MAX_LINEAR_PROJECTION_WEEKS);

  const weeklyKg = useObserved ? observed : formulaWeeklyKg;
  const totalKgChange = weeklyKg * effectiveWeeksOut;
  const projectedWeightKg = Math.round((currentWeightKg + totalKgChange) * 10) / 10;

  const direction: DailyProjection["direction"] =
    Math.abs(dailySurplusDeficit) < 50
      ? "maintenance"
      : dailySurplusDeficit < 0
        ? "deficit"
        : "surplus";

  return {
    projectedWeightKg: Math.max(projectedWeightKg, 30), // floor at 30kg for sanity
    // ENG-1029 — report the horizon actually used (clamped on the linear
    // path in production) so the display never claims a longer reach than
    // the projection covers.
    projectionWeeks: effectiveWeeksOut,
    dailySurplusDeficit: Math.round(dailySurplusDeficit),
    direction,
  };
}

/**
 * ENG-741 — average calories over the most recent `windowDays` calendar
 * days that actually have logged food. Both the Progress "Journey" card
 * and the new Trajectory card project from this number, so it lives in
 * one place to guarantee the two surfaces (and web ↔ mobile) can't drift.
 *
 * Behaviour mirrors the prior inline derivations exactly:
 *   - keys are sorted ascending, the trailing `windowDays` *food-logged*
 *     days are taken (slice(-windowDays))
 *   - per-day calories sum each entry's `calories`, flooring negatives at
 *     0 so a malformed entry can't drag the average down
 *   - returns `{ avgCalories, daysWithFood }`. `avgCalories` is `0` when
 *     there are no food-logged days (callers gate on `daysWithFood`).
 *
 * Generic over the entry shape — only `calories` is read — so it works
 * with both the mobile `ByDay` meal shape and the web `nutritionByDay`
 * shape without coupling to either.
 */
export function avgCaloriesOverRecentLoggedDays(
  byDay: Record<string, Array<{ calories?: number | null }>>,
  windowDays = 7,
): { avgCalories: number; daysWithFood: number } {
  const loggedKeys = Object.keys(byDay)
    .filter((k) => (byDay[k] ?? []).length > 0)
    .sort();
  const recent = windowDays > 0 ? loggedKeys.slice(-windowDays) : loggedKeys;
  if (recent.length === 0) return { avgCalories: 0, daysWithFood: 0 };
  const total = recent.reduce(
    (sum, k) =>
      sum +
      (byDay[k] ?? []).reduce(
        (a, m) => a + Math.max(0, Number(m.calories) || 0),
        0,
      ),
    0,
  );
  return {
    avgCalories: Math.round(total / recent.length),
    // `daysWithFood` is the TOTAL count of food-logged days (not just the
    // windowed slice) — that's the value the ≥5-day projection floor is
    // measured against, matching the inline Journey-card behaviour.
    daysWithFood: loggedKeys.length,
  };
}

/**
 * ENG-741 — signed observed weekly rate (kg/week) derived from a
 * `WeightGoalTimeline`. Negative = losing, positive = gaining, 0 =
 * stalled. Extracted from the identical inline expression both Progress
 * surfaces used before feeding `projectWeight({ observedKgPerWeek })`.
 */
export function signedObservedKgPerWeek(timeline: WeightGoalTimeline): number {
  if (typeof timeline.weeklyRateKg !== "number") return 0;
  if (timeline.trendDirection === "losing") return -Math.abs(timeline.weeklyRateKg);
  if (timeline.trendDirection === "gaining") return Math.abs(timeline.weeklyRateKg);
  return 0;
}

export type TrajectoryState =
  | {
      kind: "projection";
      /** Projected weight in kg if the recent pace holds. */
      projectedKg: number;
      /** Projection horizon in weeks (matches `projectWeight`'s `weeksOut`). */
      weeks: number;
      /** Average kcal/day over the recent food-logged window. */
      avgCalories: number;
      /** The user's daily calorie target. */
      targetCalories: number;
    }
  | {
      kind: "placeholder";
      /** How many more food-logged days are needed to cross the floor. */
      daysRemaining: number;
      /** Days logged so far (for the thin progress bar). */
      daysLogged: number;
      /** The floor itself (denominator for the progress bar). */
      daysRequired: number;
    };

/**
 * ENG-741 — single source of truth for the Trajectory card's state.
 *
 * Reuses `avgCaloriesOverRecentLoggedDays`, `shouldRenderDailyProjection`,
 * `signedObservedKgPerWeek`, and `projectWeight` — the same maths the
 * Journey card runs inline — so the new card never re-derives a number.
 *
 * Returns:
 *   - `projection`  when ≥`MIN_DAYS_FOR_PROJECTION` food-logged days exist
 *                   AND a real average + current weight are available.
 *   - `placeholder` when below the floor (shows exact days remaining).
 *   - `null`        when there's no current weight at all — we never
 *                   invent a projection from a missing input.
 *
 * Hiding when weight tracking is opted out is the *caller's* job (same
 * `weightSurfaceMode === "show"` gate the Journey card uses) — this helper
 * is pure maths and doesn't know about the surface mode.
 */
export function computeTrajectory(opts: {
  byDay: Record<string, Array<{ calories?: number | null }>>;
  latestWeightKg: number | null;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  timeline?: WeightGoalTimeline | null;
  weeksOut?: number;
}): TrajectoryState | null {
  const {
    byDay,
    latestWeightKg,
    targetCalories,
    maintenanceTdeeKcal,
    goal,
    timeline,
    weeksOut = 5,
  } = opts;

  if (latestWeightKg == null || !Number.isFinite(latestWeightKg)) return null;

  const { avgCalories, daysWithFood } = avgCaloriesOverRecentLoggedDays(byDay, 7);

  if (!shouldRenderDailyProjection(daysWithFood)) {
    return {
      kind: "placeholder",
      daysRemaining: Math.max(0, MIN_DAYS_FOR_PROJECTION - daysWithFood),
      daysLogged: daysWithFood,
      daysRequired: MIN_DAYS_FOR_PROJECTION,
    };
  }

  // Eligible but no real average to project from (e.g. all recent days
  // logged 0 kcal). Don't fabricate — fall back to placeholder copy.
  if (avgCalories <= 0) {
    return {
      kind: "placeholder",
      daysRemaining: 0,
      daysLogged: daysWithFood,
      daysRequired: MIN_DAYS_FOR_PROJECTION,
    };
  }

  const projection = projectWeight({
    currentWeightKg: latestWeightKg,
    todayCalories: avgCalories,
    targetCalories,
    maintenanceTdeeKcal,
    goal,
    weeksOut,
    observedKgPerWeek: timeline ? signedObservedKgPerWeek(timeline) : null,
  });

  return {
    kind: "projection",
    projectedKg: projection.projectedWeightKg,
    weeks: projection.projectionWeeks,
    avgCalories,
    targetCalories,
  };
}

/** Default window for journey peak/trough — ignores very old Health rows that blow up “lost”. */
export const WEIGHT_JOURNEY_LOOKBACK_DAYS = 540;

function parseDayKeyMs(key: string): number | null {
  const k = key.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const t = new Date(`${k}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Weights whose calendar day falls within the last `lookbackDays` (by wall-clock `Date.now()`). */
export function weightsInLookbackKg(
  weightKgByDay: Record<string, number>,
  lookbackDays: number,
): number[] {
  const cutoff = Date.now() - lookbackDays * 86400000;
  const out: number[] = [];
  for (const [k, v] of Object.entries(weightKgByDay)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const t = parseDayKeyMs(k);
    if (t == null || t < cutoff) continue;
    out.push(v);
  }
  return out;
}

/** Upper anchor with Tukey fence — drops extreme high spikes (bad units, duplicate imports). */
export function tukeyRobustMaxKg(values: number[]): number | null {
  const s = [...values].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  if (s.length < 4) return s[s.length - 1]!;
  const n = s.length;
  const q1 = s[Math.floor(0.25 * (n - 1))]!;
  const q3 = s[Math.floor(0.75 * (n - 1))]!;
  const iqr = q3 - q1;
  if (iqr < 1e-6) return s[s.length - 1]!;
  const upper = q3 + 3 * iqr;
  const kept = s.filter((x) => x <= upper);
  return kept.length ? kept[kept.length - 1]! : s[s.length - 1]!;
}

/** Lower anchor with Tukey fence — drops extreme low spikes when gaining. */
export function tukeyRobustMinKg(values: number[]): number | null {
  const s = [...values].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  if (s.length < 4) return s[0]!;
  const n = s.length;
  const q1 = s[Math.floor(0.25 * (n - 1))]!;
  const q3 = s[Math.floor(0.75 * (n - 1))]!;
  const iqr = q3 - q1;
  if (iqr < 1e-6) return s[0]!;
  const lower = q1 - 3 * iqr;
  const kept = s.filter((x) => x >= lower);
  return kept.length ? kept[0]! : s[0]!;
}

/**
 * Baseline weight for journey/progress bars: peak when losing, trough when gaining.
 * Uses **recent** history (lookback) plus Tukey IQR fences so one bogus max/min does not
 * inflate “kg lost” (e.g. summing-like effect from a 150 kg typo vs a true 75 kg line).
 */
export function weightJourneyBaselineKg(opts: {
  goalKg: number | null | undefined;
  latestKg: number | null | undefined;
  weightKgByDay: Record<string, number>;
  /** Only consider weights from this many recent days; falls back to all-time if none in window. */
  lookbackDays?: number;
}): number | null {
  const { goalKg, latestKg, weightKgByDay } = opts;
  const lookbackDays = opts.lookbackDays ?? WEIGHT_JOURNEY_LOOKBACK_DAYS;
  if (goalKg == null || latestKg == null || !Number.isFinite(goalKg) || !Number.isFinite(latestKg)) return null;

  const inWindow = weightsInLookbackKg(weightKgByDay, lookbackDays);
  const allVals = Object.values(weightKgByDay).filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
  const pool = inWindow.length > 0 ? inWindow : allVals;
  if (pool.length === 0) return latestKg;

  if (goalKg < latestKg - 0.01) {
    const robust = tukeyRobustMaxKg([...pool, latestKg]);
    return robust != null ? Math.max(robust, latestKg) : latestKg;
  }
  if (goalKg > latestKg + 0.01) {
    const robust = tukeyRobustMinKg([...pool, latestKg]);
    return robust != null ? Math.min(robust, latestKg) : latestKg;
  }
  return latestKg;
}

/** Progress from baseline toward goal (0–1 `pct`). */
export function weightJourneyProgress(opts: {
  goalKg: number;
  latestKg: number;
  weightKgByDay: Record<string, number>;
}): { baselineKg: number; lostKg: number; totalKg: number; pct: number; remainingKg: number } | null {
  const baseline = weightJourneyBaselineKg({
    goalKg: opts.goalKg,
    latestKg: opts.latestKg,
    weightKgByDay: opts.weightKgByDay,
  });
  if (baseline == null) return null;
  const total = Math.abs(baseline - opts.goalKg);
  if (total < 0.1) return null;
  const moved =
    opts.goalKg < baseline
      ? Math.max(0, baseline - opts.latestKg)
      : Math.max(0, opts.latestKg - baseline);
  const pct = Math.min(1, moved / total);
  const remaining = Math.abs(opts.latestKg - opts.goalKg);
  return { baselineKg: baseline, lostKg: moved, totalKg: total, pct, remainingKg: remaining };
}

export type WeightGoalTimeline = {
  /** Estimated days to reach goal weight (null if not achievable or no goal) */
  daysToGoal: number | null;
  /**
   * Audit 2026-04-29 papercut #8 — when `cappedAtMaxDays` is true the
   * rate-based projection ran past the 1-year cap; the UI used to
   * collapse this to a vague "more than a year at current rate"
   * fragment, which premium-feel reviewers flagged as deflating
   * (TestFlight feedback: "tells me nothing actionable"). This field
   * preserves the uncapped projection so the UI can show a concrete
   * date with a "1+ years out" qualifier — concrete projected dates
   * feel closer than abstract "more than a year". Null when the rate
   * is too low to project at all (matches `daysToGoal`'s null path).
   */
  daysToGoalUncapped: number | null;
  /** Weekly rate of change in kg based on recent trend */
  weeklyRateKg: number;
  /** Current weight */
  currentKg: number;
  /** Goal weight */
  goalKg: number;
  /** Remaining kg to goal */
  remainingKg: number;
  /** Direction: losing, gaining, or stalled */
  trendDirection: "losing" | "gaining" | "stalled";
  /**
   * Action 13 Item #15 (2026-04-19) — `true` when the rate-based
   * projection ran but landed past the `MAX_DAYS_TO_GOAL` cap. The UI
   * uses this to render "More than 1 year at current rate" copy
   * instead of an empty space. Distinct from `daysToGoal === null`
   * caused by stalled / wrong-direction movement (where the rate alone
   * can't get the user there).
   */
  cappedAtMaxDays: boolean;
};

/**
 * Action 13 Item #15 (2026-04-19) — projection cap. Beyond this many
 * days the rate-based projection isn't meaningful (a 0.05 kg/wk rate
 * over 5 years is just noise), and the UI should fall back to a
 * "more than 1 year" copy with the current rate surfaced separately.
 */
export const MAX_DAYS_TO_GOAL = 365;

/**
 * Calculate timeline to goal weight based on recent weight trend.
 */
export function calcGoalTimeline(opts: {
  currentWeightKg: number;
  goalWeightKg: number;
  weightKgByDay: Record<string, number>;
}): WeightGoalTimeline {
  const { currentWeightKg, goalWeightKg, weightKgByDay } = opts;

  const remainingKg = Math.round((currentWeightKg - goalWeightKg) * 10) / 10;

  const keys = Object.keys(weightKgByDay).sort();
  let weeklyRateKg = 0;

  if (keys.length >= 2) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = dateKeyFromDate(cutoff);
    const recentKeys = keys.filter((k) => k >= cutoffStr);
    const useKeys = recentKeys.length >= 2 ? recentKeys : keys;
    const firstKey = useKeys[0];
    const lastKey = useKeys[useKeys.length - 1];
    const first = weightKgByDay[firstKey];
    const last = weightKgByDay[lastKey];
    const daySpan = Math.max(
      1,
      Math.round(
        (new Date(`${lastKey}T12:00:00`).getTime() - new Date(`${firstKey}T12:00:00`).getTime()) / 86400000,
      ),
    );
    weeklyRateKg = Math.round(((last - first) / daySpan) * 7 * 10) / 10;
  }

  const trendDirection: WeightGoalTimeline["trendDirection"] =
    Math.abs(weeklyRateKg) < 0.1
      ? "stalled"
      : weeklyRateKg < 0
        ? "losing"
        : "gaining";

  let daysToGoal: number | null = null;
  let daysToGoalUncapped: number | null = null;
  let cappedAtMaxDays = false;
  if (Math.abs(weeklyRateKg) >= 0.1) {
    const dailyRateKg = weeklyRateKg / 7;
    const needsToLose = remainingKg > 0;
    const isMovingRight = needsToLose ? dailyRateKg < 0 : dailyRateKg > 0;

    if (isMovingRight) {
      const computed = Math.round(Math.abs(remainingKg / dailyRateKg));
      // Always preserve the raw projection in `daysToGoalUncapped` so
      // the new (audit 2026-04-29 papercut #8) copy path can surface
      // a concrete date even past the 1-year cap.
      daysToGoalUncapped = computed;
      if (computed > MAX_DAYS_TO_GOAL) {
        // Item #15 — past the cap, surface the cap signal so the UI
        // can render "More than 1 year at current rate" rather than an
        // empty time-to-goal space. We deliberately keep `daysToGoal`
        // null so callers that haven't adopted the cap signal yet
        // continue to suppress the days-to-goal headline (their
        // existing behaviour); only the new copy path opts in.
        cappedAtMaxDays = true;
      } else {
        daysToGoal = computed;
      }
    }
  }

  return {
    daysToGoal,
    daysToGoalUncapped,
    weeklyRateKg,
    currentKg: currentWeightKg,
    goalKg: goalWeightKg,
    remainingKg: Math.abs(remainingKg),
    trendDirection,
    cappedAtMaxDays,
  };
}

/**
 * Filter a by-day map (weights, steps, water) to the trailing
 * `maxDays` window ending today, inclusive.
 *
 * Single source of truth for the Weight & Trends chart range buttons
 * (3M / 6M / 9M / 1Y / All). Previously lived inline in
 * `apps/mobile/app/weight-tracker.tsx` which made the "range buttons
 * don't actually change the months shown" bug (TestFlight
 * `ACoMvhUoe_riUvOp5XZ3Sow`, 2026-04-18) impossible to unit-test at
 * the filter level. Extracted so
 * `apps/mobile/tests/unit/weightChartRangeFilter.test.ts` can pin
 * the behaviour per-range.
 *
 * @param map      raw `{ "YYYY-MM-DD": number }` record
 * @param maxDays  trailing window in days. Values >= today - maxDays
 *                 are kept. `Infinity` / very large numbers → keep all.
 * @param now      injectable for tests; defaults to `new Date()`.
 * @returns        a new record containing only the entries whose date
 *                 key is >= the cutoff, sorted chronologically.
 */
export function filterByDateRangeDays(
  map: Record<string, number>,
  maxDays: number,
  now: Date = new Date(),
): Record<string, number> {
  if (!Number.isFinite(maxDays) || maxDays < 0) return { ...map };
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffStr = dateKeyFromDate(cutoff);
  const entries = Object.entries(map)
    .filter(([k]) => k >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b));
  const out: Record<string, number> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}

/**
 * Weight-journey progress as a 0–1 fraction using the canonical formula:
 *
 *   pct = (start - current) / (start - goal)
 *
 * Clamped to `[0, 1]`. Direction-aware: works for "lose" journeys
 * (start > goal) and "gain" journeys (start < goal). Returns `null`
 * when start and goal are within 0.1 kg of each other (no meaningful
 * journey to measure — avoids a divide-by-near-zero blow-up that
 * previously showed "3% progress" to a user whose start equals their
 * current weight, TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`, 2026-04-18).
 *
 * Shared by mobile `progress.tsx` + `weight-tracker.tsx` and web
 * `ProgressDashboard.tsx` so the number and the copy agree on every
 * surface.
 */
export function computeWeightJourneyProgressPct(opts: {
  startKg: number;
  currentKg: number;
  goalKg: number;
}): number | null {
  const { startKg, currentKg, goalKg } = opts;
  if (!Number.isFinite(startKg) || !Number.isFinite(currentKg) || !Number.isFinite(goalKg)) {
    return null;
  }
  const span = startKg - goalKg;
  if (Math.abs(span) < 0.1) return null;
  const moved = startKg - currentKg;
  // Single expression works for both lose (span>0) and gain (span<0) cases:
  //   lose  span>0, moved>0 when current<start
  //   gain  span<0, moved<0 when current>start
  const raw = moved / span;
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Human-readable copy for the weight-journey progress bar. Avoids the
 * "0% of the way" that looked like a bug to the tester in
 * `AHEeeC9a4-lKIyW5n7HgJxs` — at exactly 0% we render "Just starting"
 * instead of a meaningless percentage.
 */
export function formatWeightJourneyProgressCopy(pct: number | null): string {
  if (pct == null) return "";
  const rounded = Math.round(pct * 100);
  if (rounded <= 0) return "Just starting";
  if (rounded >= 100) return "Goal reached";
  return `${rounded}% of the way there`;
}

/**
 * Compute the y-axis domain for the Weight & Trends chart.
 *
 * G-3 (TestFlight `AGJmliHTxnmt7sC1VpTZz5E`, 2026-04-19, build 11):
 * when the goal weight (e.g. 50 kg) sat far below the visible data
 * (e.g. 54.2–55.5 kg) the previous implementation included the goal
 * in the min/max directly, anchoring the chart to ~50 kg and squishing
 * the real data into the top ~20% of the plot. The fix: compute min
 * and max from the plotted data points only (primary + projected),
 * pad by ~10% of the span (≥ 0.5 unit headroom), then include the
 * goal in the domain only when it sits within the padded range plus
 * one extra span either side. When the goal is outside that window,
 * the caller should render a muted "off-chart" hint instead of
 * dragging the y-axis down to meet it.
 *
 * @param values   plotted data values (kg or lb — units-agnostic)
 * @param goal     optional goal value in the same unit
 * @returns        `{ yMin, yMax, includesGoal }`. Always finite, always
 *                 `yMin < yMax`.
 */
export function computeWeightChartDomain(
  values: readonly number[],
  goal?: number | null,
): { yMin: number; yMax: number; includesGoal: boolean } {
  const finiteValues = values.filter((v) => Number.isFinite(v));
  if (finiteValues.length === 0) {
    if (goal != null && Number.isFinite(goal)) {
      return { yMin: goal - 1, yMax: goal + 1, includesGoal: true };
    }
    return { yMin: 0, yMax: 1, includesGoal: false };
  }
  const dataMin = Math.min(...finiteValues);
  const dataMax = Math.max(...finiteValues);
  const span = dataMax - dataMin;
  // At least 0.5 unit headroom so a single-value / flat series still
  // renders a visible line instead of collapsing onto the axis.
  const padding = Math.max(span * 0.1, 0.5);
  let yMin = dataMin - padding;
  let yMax = dataMax + padding;
  let includesGoal = false;
  if (goal != null && Number.isFinite(goal)) {
    // "Reasonable range" = the data span on either side of the padded
    // window. Goal lands on-chart only when it is within one extra
    // data-span of the visible data — i.e. close enough that pulling
    // the axis down a little still leaves the data legible.
    const proximity = Math.max(span, padding * 2);
    if (goal >= yMin - proximity && goal <= yMax + proximity) {
      yMin = Math.min(yMin, goal - 0.5);
      yMax = Math.max(yMax, goal + 0.5);
      includesGoal = true;
    }
  }
  if (yMax - yMin < 1e-6) {
    yMax = yMin + 1;
  }
  return { yMin, yMax, includesGoal };
}
