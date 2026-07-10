/**
 * Weekly recap (Batch 4.11) — pure builder + gating for the Sunday-evening
 * recap card on the Progress dashboard.
 *
 * What this module owns:
 *   - `buildWeeklyRecap` — collapses a week of meals + weights into a
 *     display-ready summary (avg kcal, protein adherence %, streak, best
 *     day, weight delta).
 *   - `weekKeyFor` — stable ISO-week-ish key (`YYYY-Www`) that respects
 *     the user's `week_start_day` so Sunday-first users don't
 *     accidentally see Monday-first weeks.
 *   - `shouldShowRecap` — gate that decides whether the card renders
 *     this visit (week has ended + user hasn't dismissed it yet).
 *
 * Parity: consumed by both the web `WeeklyRecapCard` and the mobile
 * `WeeklyRecapCard`. All labels are factual and supportive — "3 days
 * logged this week" not "You missed 4 days".
 *
 * Pure module — no React, no network.
 */

import type { ByDayOf, MealMacros } from "./progressWeekReport";
import { buildWeekStats } from "./progressWeekReport";
import { dateKeyFromDate } from "./trackerStats";
import {
  availableFreezes,
  computeProtectedStreak,
  type FreezeLedger,
  type StreakByDay,
} from "./streakFreeze";
import {
  computeDayOfWeekPattern,
  isDayOfWeekPatternWithinLoggedWeek,
  type DayOfWeekPattern,
} from "./dayOfWeekPattern";

export type WeeklyRecap = {
  /** `YYYY-Www` key for the completed week this recap covers. */
  weekKey: string;
  /** "Apr 6 – Apr 12" human label, locale-free so tests are stable. */
  weekLabel: string;
  /** All 7 `YYYY-MM-DD` day-keys of the recap window, in order. Exposed
   *  (ENG-1476) so consumers like `buildDigestWeekView` can anchor on
   *  the week without re-running `buildWeekStats`. */
  weekDayKeys: string[];
  /** Subset of `weekDayKeys` with ≥1 meal logged (calories > 0). */
  loggedDayKeys: string[];
  /** Number of days with ≥1 meal logged in this 7-day window. */
  daysLogged: number;
  /** Average daily calories over days-with-food (not over all 7). */
  avgCalories: number;
  /** Average daily protein (g) over days-with-food. */
  avgProtein: number;
  /** `avgProtein / targets.protein * 100`, rounded. `0` if no target. */
  proteinAdherencePct: number;
  /** Protected streak length at the moment of recap generation. */
  streakLength: number;
  /** Freezes the user currently holds (after any streak protection). */
  freezesAvailable: number;
  /**
   * Action 13 Item #9 (2026-04-19) — renamed concept: was "best day"
   * (highest protein), now "closest to target" using a normalised L1
   * deviation across the day's macros.
   *
   * Selection rule (pinned by `tests/unit/weeklyRecap.test.ts`):
   *   - score = sum(|actual - target| / target) per macro where the
   *     target > 0. Lower = closer to target.
   *   - Day must have ≥80% of macro targets logged (i.e. at least
   *     `0.8 * macrosWithTarget` macros with non-zero actuals) to be
   *     eligible. A protein-only log doesn't crown the day just
   *     because the other macros are zero.
   *   - Lowest score wins; ties broken by most-recent date.
   *   - Returns `null` when no eligible day exists, or when no macro
   *     target is set (we don't surface a winner without a frame of
   *     reference).
   *
   * Field name kept as `bestDay` for back-compat with the share-string
   * formatter and existing analytics events; the user-facing label is
   * "Closest to target" everywhere it surfaces.
   */
  bestDay: {
    key: string;
    label: string;
    calories: number;
    protein: number;
    /**
     * ENG-740 — the per-day calorie target that was active on the
     * closest day (the snapshot target, falling back to the current
     * target when no snapshot exists). Surfaced so the blended
     * Week-Digest hero can render the day's calories on a
     * target-relative track (`calories / targetCalories`). `0` when no
     * calorie target was set — the hero track suppresses in that case.
     */
    targetCalories: number;
  } | null;
  /**
   * Weight change across the week in kg, rounded to 0.1. `null` if we
   * don't have ≥2 weigh-ins inside the window — we never show
   * "+0.0 kg" as a faux result.
   */
  weightDeltaKg: number | null;
  /**
   * Action 13 Item #13 (2026-04-19) — surface the first and last
   * weigh-in for the week so the WeeklyRecapCard can render an
   * honest "First → Last weigh-in: 78.4 → 77.8 kg (-0.6 kg)" line
   * instead of a misleading "Change this week" headline (which
   * implies an average rather than a noisy first-vs-last delta).
   *
   * Both `null` when fewer than 2 weigh-ins inside the window —
   * mirrors the `weightDeltaKg` rule. The card uses the presence /
   * absence of these to decide whether to render the explanatory
   * line vs the existing fallback ("No weigh-ins this week").
   */
  weightFirstKg: number | null;
  weightLastKg: number | null;
  /**
   * B1 (2026-04-27) — fibre + hydration adherence rollups, parallel to
   * the existing protein adherence percentage. All four fields default
   * to `0` when the user hasn't set the corresponding target — the
   * push-body formatter + Progress sub-card use that as the "suppress
   * the line" signal rather than rendering "0%". Spec:
   * docs/specs/2026-04-27-b1-weekly-fiber-hydration-rollups.md.
   */
  /** Average daily fibre (g) over days-with-food. */
  avgFiberG: number;
  /** `avgFiberG / targets.fiber * 100`, rounded. `0` when no target. */
  fiberAdherencePct: number;
  /** Average daily hydration (ml) across all 7 days (not gated on logged
   *  meals — hydration days don't require meal entries). */
  avgHydrationMl: number;
  /** Days where logged hydration ≥ 90% of target. `0` when no target. */
  hydrationDaysOnTarget: number;
};

/**
 * Build the recap for the *previous completed week* — i.e. the week
 * that ended just before `now`. Uses the user's `weekStartDay` so a
 * Sunday-start user sees Sun-to-Sat, and a Monday-start user sees
 * Mon-to-Sun.
 */
export function buildWeeklyRecap<M extends MealMacros>(params: {
  byDay: ByDayOf<M>;
  weightKgByDay: Record<string, number>;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** B1 (2026-04-27) — daily fibre target in g. Optional. 0 / undefined →
     *  fibre adherence reported as 0 and the recap UI suppresses the line. */
    fiber?: number;
    /** B1 — daily hydration target in ml. Optional. 0 / undefined →
     *  hydration adherence reported as 0 and the recap UI suppresses the line. */
    hydrationMl?: number;
  };
  weekStartDay: "monday" | "sunday";
  ledger: FreezeLedger;
  budgetMax: number;
  /** B1 — per-day fibre sums (g). Caller pre-aggregates from
   *  nutrition_entries so we don't have to widen MealMacros. Keys are
   *  `YYYY-MM-DD` matching `byDay`. Missing days treated as 0. */
  fiberByDay?: Record<string, number>;
  /** B1 — per-day hydration sums (ml) from profiles.extra_water_by_day.
   *  Missing days treated as 0 (hydration is intentionally rolled
   *  across all 7 days, not just days with logged meals). */
  hydrationByDay?: Record<string, number>;
  /**
   * Numbers audit 2026-05-04 #9 — per-day target snapshots from the
   * `daily_targets` table. When a user edits their target mid-week,
   * Progress + ProgressMetricDetail already feed snapshots into
   * `buildWeekStats` via the same arg, so past days are judged against
   * the target that was active *that day*. The recap was missing this
   * plumbing — same week, different "% adherence" between Recap (current
   * target only) and Progress (snapshot-aware). Now both surfaces share
   * the snapshot map. Caller fetches via `getDailyTargets()` for the 7
   * day-keys that span the recap window.
   */
  dayTargetOverrides?: Record<
    string,
    { targetCalories: number | null; targetProtein: number | null; targetCarbs: number | null; targetFat: number | null } | null | undefined
  >;
  now?: Date;
}): WeeklyRecap {
  const now = params.now ?? new Date();

  // Anchor on the *previous* week. We subtract 7 days from "now" and
  // then let buildWeekStats snap to the week containing that anchor.
  const previousWeekAnchor = new Date(now);
  previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);

  const bundle = buildWeekStats(
    params.byDay,
    params.targets,
    params.weekStartDay,
    previousWeekAnchor,
    params.dayTargetOverrides,
  );

  const daysLogged = bundle.days.filter((d) => d.calories > 0).length;
  // `buildWeekStats` returns 0 averages when no days were logged; keep
  // that behaviour so the UI can detect "nothing to recap" cleanly.
  const avgCalories = daysLogged > 0 ? bundle.avgCalories : 0;
  const avgProtein = daysLogged > 0 ? bundle.avgProtein : 0;
  const proteinAdherencePct =
    params.targets.protein > 0
      ? Math.round((avgProtein / params.targets.protein) * 100)
      : 0;

  // Action 13 Item #9 (2026-04-19) — "Closest to target" selection.
  // Replaces the prior "highest protein" rule, which crowned a high-
  // protein but otherwise-blown-budget day over a balanced one. The
  // new rule rewards effort: smallest summed normalised L1 deviation
  // across logged macros wins, gated on ≥80% of macro targets logged.
  // Tie → most recent day. Helper is invoked inline (not exported)
  // because the day-shape it consumes is internal to this module.
  const bestDay: WeeklyRecap["bestDay"] = selectClosestToTargetDay(bundle.days);

  // Weight delta across the same 7-day window. Need ≥2 entries; we
  // refuse to guess otherwise.
  const weightKeys = bundle.days.map((d) => d.key);
  const firstKey = weightKeys[0]!;
  const lastKey = weightKeys[weightKeys.length - 1]!;
  const withinWeek = Object.entries(params.weightKgByDay)
    .filter(([k]) => k >= firstKey && k <= lastKey)
    .sort(([a], [b]) => a.localeCompare(b));
  let weightDeltaKg: number | null = null;
  let weightFirstKg: number | null = null;
  let weightLastKg: number | null = null;
  if (withinWeek.length >= 2) {
    const first = withinWeek[0][1];
    const last = withinWeek[withinWeek.length - 1][1];
    if (Number.isFinite(first) && Number.isFinite(last)) {
      weightDeltaKg = Math.round((last - first) * 10) / 10;
      weightFirstKg = Math.round(first * 10) / 10;
      weightLastKg = Math.round(last * 10) / 10;
    }
  }

  const streak = computeProtectedStreak(
    params.byDay as unknown as StreakByDay,
    params.ledger,
    params.budgetMax,
    now,
  );
  const freezesAvailable = availableFreezes(params.ledger, params.budgetMax);

  // B1 (2026-04-27) — fibre + hydration adherence rollups.
  // Fibre: average over days-with-food, mirroring the protein rule so
  // a 3-days-logged user isn't punished for having 4 zero days. Target 0
  // / unset → 0 and the recap UI / push body suppress the line.
  const weekKeysList = bundle.days.map((d) => d.key);
  const fiberByDay = params.fiberByDay ?? {};
  const fiberSum = weekKeysList.reduce(
    (s, k) => s + (Number.isFinite(fiberByDay[k]) ? fiberByDay[k] : 0),
    0,
  );
  const fiberDaysLogged =
    weekKeysList.filter((k) => (fiberByDay[k] ?? 0) > 0).length;
  const avgFiberG =
    fiberDaysLogged > 0 ? Math.round((fiberSum / fiberDaysLogged) * 10) / 10 : 0;
  const fiberTarget = params.targets.fiber ?? 0;
  const fiberAdherencePct =
    fiberTarget > 0 ? Math.round((avgFiberG / fiberTarget) * 100) : 0;

  // Hydration: rolled across ALL 7 days (not just days-with-food). The
  // user might log only 3 days of meals but still drink water on the
  // other 4 — the average is the honest signal.
  // Days-on-target counts a day when hydrationByDay[k] ≥ 90% of target.
  const hydrationByDay = params.hydrationByDay ?? {};
  const hydrationSum = weekKeysList.reduce(
    (s, k) => s + (Number.isFinite(hydrationByDay[k]) ? hydrationByDay[k] : 0),
    0,
  );
  const avgHydrationMl =
    weekKeysList.length > 0
      ? Math.round(hydrationSum / weekKeysList.length)
      : 0;
  const hydrationTarget = params.targets.hydrationMl ?? 0;
  const hydrationDaysOnTarget =
    hydrationTarget > 0
      ? weekKeysList.filter(
          (k) => (hydrationByDay[k] ?? 0) >= 0.9 * hydrationTarget,
        ).length
      : 0;

  return {
    weekKey: weekKeyFor(previousWeekAnchor, params.weekStartDay),
    weekLabel: formatWeekLabel(firstKey, lastKey),
    weekDayKeys: weekKeysList,
    loggedDayKeys: bundle.days.filter((d) => d.calories > 0).map((d) => d.key),
    daysLogged,
    avgCalories,
    avgProtein,
    proteinAdherencePct,
    streakLength: streak.streakLength,
    freezesAvailable,
    bestDay,
    weightDeltaKg,
    weightFirstKg,
    weightLastKg,
    avgFiberG,
    fiberAdherencePct,
    avgHydrationMl,
    hydrationDaysOnTarget,
  };
}

/** `WeeklyRecap` plus the day-of-week pattern the digest is allowed to
 *  cite for the SAME displayed week — see `buildDigestWeekView`. */
export type DigestWeekView = WeeklyRecap & {
  /**
   * `null` when `computeDayOfWeekPattern`'s own gates failed OR when
   * `isDayOfWeekPatternWithinLoggedWeek` rejected it (pattern's cited
   * high/low weekdays don't both appear in THIS displayed week).
   */
  dayOfWeekPattern: DayOfWeekPattern | null;
  /** Present whenever `dayOfWeekPattern` is non-null — the rolling
   *  window the pattern was computed over, so copy can disclose it's a
   *  longer-run observation than the single week being shown
   *  ("last 4 weeks" vs. the digest's own 7-day `weekLabel`). */
  patternWindowLabel: string | null;
};

/**
 * ENG-1373 — single builder for everything a digest-week card renders.
 *
 * Root cause this closes: the digest week's own numbers
 * (`avgCalories`, `daysLogged`, `weekLabel`, all from `buildWeeklyRecap`
 * anchored on the *previous completed week*) and its day-of-week
 * pattern line (`computeDayOfWeekPattern`, previously called with no
 * explicit anchor and defaulting to wall-clock "today") were computed
 * from two DIFFERENT window anchors by two independent call sites in
 * the same render. That's how a digest could report "929 avg" while
 * citing "Fridays ran higher than Thursdays" for a week where Friday
 * was never logged — the pattern was silently describing a different
 * window than the headline numbers.
 *
 * This wraps `buildWeeklyRecap` (unchanged — correct in isolation) and
 * anchors `computeDayOfWeekPattern` on that SAME previous-week anchor,
 * then runs `isDayOfWeekPatternWithinLoggedWeek` so the pattern can
 * only survive into the render if both cited weekdays were actually
 * logged in the week the rest of the card is describing. Returns ONE
 * struct so no render site can mix a `weekLabel` from one call with a
 * `dayOfWeekPattern` from another.
 *
 * `patternWindowLabel` is a constant, not derived from `now` — the
 * rolling window length is a fixed product decision
 * (`DAY_OF_WEEK_PATTERN_WINDOW_DAYS` = 28 days = "last 4 weeks"), so
 * hard-coding the label avoids a second silent-default trap where a
 * future refactor of the window length forgets to update the label to
 * match.
 *
 * `windowEnd` for `computeDayOfWeekPattern` is derived from the digest
 * week's own LAST logged-week day-key (`weekBundle.days[6].key`), not
 * `previousWeekAnchor` (which is simply `now - 7 days` — a date that
 * can fall mid-week, e.g. Wednesday, when the digest is generated on a
 * Wednesday). Anchoring the 28-day pattern walk on a mid-week date
 * silently truncates the trailing days of the very week being
 * described (a Thu/Fri/Sat/Sun anchored mid-week would exclude up to
 * 6 tail days from the 28-day sample). Using the week's actual last
 * day as the walk-back start ensures the pattern window always fully
 * covers the displayed week plus the 3 weeks before it.
 */
export function buildDigestWeekView<M extends MealMacros>(
  params: Parameters<typeof buildWeeklyRecap<M>>[0],
): DigestWeekView {
  const recap = buildWeeklyRecap(params);

  // ENG-1476 — the recap now exposes its own week/logged day-keys, so
  // this no longer re-runs `buildWeekStats` to rediscover the window.
  const loggedDaysThisWeek = recap.loggedDayKeys.map((key) => ({ key }));

  // Anchor the pattern's 28-day walk-back on the digest week's actual
  // END date (its 7th/last day-key), parsed at local noon to dodge the
  // UTC-boundary day-shift — NOT `now - 7 days`, which is a mid-week
  // date whenever `now`'s day-of-week isn't 7 days past the week
  // boundary. See doc comment above for the failure this fixes.
  const lastDayKey = recap.weekDayKeys[recap.weekDayKeys.length - 1]!;
  const [lastY, lastM, lastD] = lastDayKey
    .split("-")
    .map((n) => Number.parseInt(n, 10)) as [number, number, number];
  const windowEnd = new Date(lastY, lastM - 1, lastD, 12, 0, 0, 0);

  const rawPattern = computeDayOfWeekPattern(params.byDay, windowEnd);
  const dayOfWeekPattern = isDayOfWeekPatternWithinLoggedWeek(
    rawPattern,
    loggedDaysThisWeek,
  )
    ? rawPattern
    : null;

  return {
    ...recap,
    dayOfWeekPattern,
    patternWindowLabel: dayOfWeekPattern ? "last 4 weeks" : null,
  };
}

/**
 * Action 13 Item #9 (2026-04-19) — pick the "Closest to target" day
 * from a weekly bundle.
 *
 * Score: per macro with `target > 0`, accumulate `|actual - target| /
 * target`. Smallest sum wins (lower deviation = closer to target).
 *
 * Eligibility:
 *   - Day must have at least one positive macro (must have food).
 *   - Day must log ≥80% of macros with a non-null target. e.g. when
 *     all four macros have targets, 4 × 0.8 = 3.2 → ≥4 macros must be
 *     non-zero (rounded up). When only protein + calories have
 *     targets, ≥2 macros must be non-zero.
 *   - At least one macro target must be > 0 across the bundle —
 *     otherwise no frame of reference, return null.
 *
 * Tie-break: most recent date (later `key` wins).
 *
 * Exported for unit tests; the recap builder is the only production
 * consumer.
 */
export function selectClosestToTargetDay(
  days: ReadonlyArray<{
    key: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
  }>,
): WeeklyRecap["bestDay"] {
  type DayScore = {
    key: string;
    label: string;
    calories: number;
    protein: number;
    targetCalories: number;
    score: number;
  };
  const scored: DayScore[] = [];

  for (const d of days) {
    if (d.calories <= 0) continue;

    const macroPairs = [
      { actual: d.calories, target: d.targetCalories },
      { actual: d.protein, target: d.targetProtein },
      { actual: d.carbs, target: d.targetCarbs },
      { actual: d.fat, target: d.targetFat },
    ];
    const macrosWithTarget = macroPairs.filter((m) => m.target > 0);
    if (macrosWithTarget.length === 0) continue;

    const macrosLogged = macrosWithTarget.filter((m) => m.actual > 0).length;
    const requiredLogged = Math.ceil(macrosWithTarget.length * 0.8);
    if (macrosLogged < requiredLogged) continue;

    let score = 0;
    for (const { actual, target } of macrosWithTarget) {
      score += Math.abs(actual - target) / target;
    }

    scored.push({
      key: d.key,
      label: d.label,
      calories: d.calories,
      protein: d.protein,
      targetCalories: d.targetCalories,
      score,
    });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Tie-break: most recent date wins (descending key).
    return b.key.localeCompare(a.key);
  });

  const winner = scored[0];
  return {
    key: winner.key,
    label: winner.label,
    calories: Math.round(winner.calories),
    protein: Math.round(winner.protein),
    targetCalories: Math.round(winner.targetCalories),
  };
}

/**
 * Human-readable "Apr 6 – Apr 12" range. Locale-free (uses hard-coded
 * English month abbreviations) so component snapshot tests and
 * screenshot QA match across CI machines.
 */
export function formatWeekLabel(firstKey: string, lastKey: string): string {
  const fmt = (key: string): string => {
    const [y, m, d] = key.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return key;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[m - 1]} ${d}`;
  };
  return `${fmt(firstKey)} – ${fmt(lastKey)}`;
}

/**
 * Week key `YYYY-Www` — "ISO-week-ish" because we honour the user's
 * `week_start_day` preference instead of the strict Mon-start ISO-8601
 * definition. For Monday-start users the result equals true ISO week
 * (modulo year-boundary rules in a handful of edge cases); for
 * Sunday-start the week can land one unit earlier at the boundary.
 *
 * The week number is 1-based on `(dayOfYearOfWeekStart / 7) + 1`, which
 * is stable enough for "have we shown this week's recap yet" gating.
 */
export function weekKeyFor(
  now: Date,
  weekStartDay: "monday" | "sunday",
): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const offset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + offset);
  // Week number is derived from the *week-start* date so year rollover
  // is consistent: if the week starts Dec 30 2024 (Mon), weekKey is
  // `2024-W53`, not `2025-W01`.
  const year = weekStart.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (weekStart.getTime() - jan1.getTime()) / 86_400_000,
  );
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Decide whether to surface the recap card this visit.
 *
 *   - Returns `false` until the *previous* week has ended — the card is
 *     a Sunday-evening (or Saturday-evening for Monday-start) moment,
 *     so showing it mid-week is premature.
 *   - Returns `false` when the user has already seen/dismissed this
 *     week's recap (matching `weekKeyFor(now)`).
 *
 * We compare the week-key of "now" against `lastSeenWeekKey`. When a
 * user dismisses, the caller writes `weekKeyFor(now)` into
 * `weekly_recap_last_seen_week_key`, which suppresses the card until
 * the next week-key flip.
 */
export function shouldShowRecap(
  lastSeenWeekKey: string | null | undefined,
  currentWeekKey: string,
  now: Date = new Date(),
  weekStartDay: "monday" | "sunday" = "monday",
): boolean {
  // Gate 1: already dismissed this week → don't re-show.
  if (lastSeenWeekKey && lastSeenWeekKey === currentWeekKey) return false;

  // Gate 2: end-of-week heuristic. The recap card describes the week
  // that just ended. For Sunday-start users, the week ends Saturday —
  // we show from Saturday 18:00 local. For Monday-start users, the
  // week ends Sunday — we show from Sunday 18:00 local. Before that
  // window in the first few days of the week, the previous week's
  // recap is still fresh to show; we only suppress the "mid-week
  // premature" case.
  const dow = now.getDay(); // 0=Sun..6=Sat
  const hour = now.getHours();
  if (weekStartDay === "sunday") {
    // Week runs Sun..Sat; recap window = Sat ≥18:00 OR Sun/Mon/Tue.
    const isWeekendEnd = dow === 6 && hour >= 18;
    const isEarlyNextWeek = dow === 0 || dow === 1 || dow === 2;
    if (!isWeekendEnd && !isEarlyNextWeek) return false;
  } else {
    // Week runs Mon..Sun; recap window = Sun ≥18:00 OR Mon/Tue/Wed.
    const isWeekendEnd = dow === 0 && hour >= 18;
    const isEarlyNextWeek = dow === 1 || dow === 2 || dow === 3;
    if (!isWeekendEnd && !isEarlyNextWeek) return false;
  }

  return true;
}

/**
 * Shareable plain-text summary — used by both platforms' "Share week"
 * button. Kept in the shared helper so the copy can't drift between
 * web (Clipboard) and mobile (Share API).
 */
export function formatRecapForShare(recap: WeeklyRecap): string {
  const lines: string[] = [
    `My week on Sloe (${recap.weekLabel})`,
    `• ${recap.daysLogged}/7 days logged`,
    `• Avg ${recap.avgCalories} kcal / day`,
    `• Avg ${recap.avgProtein}g protein (${recap.proteinAdherencePct}% of target)`,
    `• ${recap.streakLength}-day streak`,
  ];
  if (recap.bestDay) {
    // Action 13 Item #9 — relabelled from "Best day" to "Closest to
    // target" to match the new selection rule (smallest summed L1
    // deviation, not raw protein volume).
    lines.push(
      `• Closest to target: ${recap.bestDay.label} — ${recap.bestDay.protein}g protein`,
    );
  }
  if (recap.weightDeltaKg != null) {
    const sign = recap.weightDeltaKg > 0 ? "+" : "";
    lines.push(`• Weight: ${sign}${recap.weightDeltaKg} kg`);
  }
  return lines.join("\n");
}

/** Cheap helper to derive the current week's dateKeyFromDate-style labels. */
export function currentWeekKey(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): string {
  return weekKeyFor(now, weekStartDay);
}

/**
 * Compute the next Sunday-18:00 (Monday-start users) or Saturday-18:00
 * (Sunday-start users) date in the caller's local timezone. Used by
 * the mobile push scheduler; kept here in the shared helper so it has
 * platform-free unit coverage.
 */
export function nextRecapFireDate(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): Date {
  // Monday-start → recap lands Sunday (dow=0); Sunday-start → Saturday (dow=6).
  const targetDow = weekStartDay === "monday" ? 0 : 6;
  const next = new Date(now);
  next.setHours(18, 0, 0, 0);
  const dow = next.getDay();
  let daysAhead = (targetDow - dow + 7) % 7;
  if (daysAhead === 0 && now.getTime() >= next.getTime()) {
    daysAhead = 7;
  }
  next.setDate(next.getDate() + daysAhead);
  return next;
}

/** Back-compat re-export so callers can import all recap helpers from one place. */
export { dateKeyFromDate };

/**
 * Ship M1 (2026-04-18) — weekly recap "usual meals" growth-loop line.
 *
 * Keeps the core `WeeklyRecap` type unchanged (tests + share-string
 * callers shouldn't have to move) and adds a second pure builder that
 * decides which of three states the recap card should surface:
 *
 *   - `celebration` — user has ≥1 saved meal AND at least one was logged
 *     in the last 7 days. Format: "You logged {name} {n} times this week."
 *     Picks the most-logged saved meal in the window; ties break by most
 *     recently logged.
 *   - `prompt` — user has no saved meals AND has logged ≥5 distinct days.
 *     Format: "Got a usual breakfast? Save it once, log it in one tap."
 *     The prompt CTA seeds `SaveMealDialog` with the slot that has the
 *     largest item-count across the week (usually Breakfast).
 *   - `null` — neither gate passes. The recap card renders without the
 *     usual-meals line at all.
 *
 * Pure — no React, no storage. Both platforms call this and render the
 * three states in their own `WeeklyRecapCard`.
 */

export type UsualMealRecapInsight =
  | {
      kind: "celebration";
      /** Saved meal name, verbatim (may be user-entered mixed case). */
      name: string;
      /** Number of times this saved meal was logged in the 7-day window. */
      count: number;
    }
  | {
      kind: "prompt";
      /** Slot with the largest item-count across the week — the "pre-seed"
       * target when the user taps the prompt CTA. */
      suggestedSlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
      /**
       * Action 5 Item 8 (2026-04-19) — when the loosened gate fires
       * (user has saved meals but none for this slot, and the same
       * (title, kcal) was logged ≥3 distinct days in the 14-day
       * window), this carries the repeat count so the card can show
       * "You've logged the same one N times in 2 weeks." Omitted by
       * the original zero-saved-meals path.
       */
      repeats?: number;
    }
  | null;

export type UsualMealRecapInsightInput<M extends MealMacros> = {
  byDay: ByDayOf<M>;
  /** `YYYY-MM-DD` keys for the 7 days the recap covers. */
  weekKeys: readonly string[];
  /** User's saved meals. Empty array when the user has none. */
  savedMeals: ReadonlyArray<{
    id: string;
    name: string;
    defaultMealSlot?: string;
    lastLoggedAt?: string;
  }>;
  /**
   * Per-saved-meal log count over the 7-day window. Normally derived
   * from journal rows whose `source === "Saved meal"` or whose (title,
   * kcal) matches an item in a saved meal — the caller owns matching
   * because journal rows don't carry a `savedMealId` today. If the
   * caller has no signal, passing `{}` lands on `prompt` when the
   * distinct-days gate is met.
   */
  logCountBySavedMealId: Readonly<Record<string, number>>;
  /**
   * Action 5 Item 8 (2026-04-19) — extended 14-day window for the
   * loosened prompt gate. When supplied AND the user has saved meals
   * but none was logged this week, the helper checks whether any
   * unsaved slot has a (title, kcal) pattern repeated ≥3 times across
   * the 14 days. If so, it surfaces a prompt naming that slot.
   *
   * Optional for back-compat — older callers that omit this still get
   * the original gate (zero-saved-meals only).
   */
  extendedWeekKeys?: readonly string[];
};

/**
 * Action 5 Item 8 — minimum number of distinct-day repeats of the same
 * (title, kcal) pattern in a slot before we consider it a "usual". Below
 * this floor the signal is too weak to invite the user to save a combo.
 */
export const USUAL_MEAL_REPEAT_FLOOR = 3;

/**
 * Pure helper — see `UsualMealRecapInsight` for the three states.
 */
export function buildUsualMealRecapInsight<M extends MealMacros>(
  input: UsualMealRecapInsightInput<M>,
): UsualMealRecapInsight {
  const { byDay, weekKeys, savedMeals, logCountBySavedMealId, extendedWeekKeys } = input;

  // Celebration path — pick the most-logged saved meal in the window.
  if (savedMeals.length > 0) {
    let topId: string | null = null;
    let topCount = 0;
    for (const m of savedMeals) {
      const c = logCountBySavedMealId[m.id] ?? 0;
      if (c > topCount) {
        topId = m.id;
        topCount = c;
      } else if (c > 0 && c === topCount && topId && m.lastLoggedAt) {
        // Tie-break on most recently logged.
        const existing = savedMeals.find((x) => x.id === topId);
        const tExisting = existing?.lastLoggedAt
          ? Date.parse(existing.lastLoggedAt)
          : 0;
        const tCandidate = Date.parse(m.lastLoggedAt);
        if (tCandidate > tExisting) {
          topId = m.id;
        }
      }
    }
    if (topId && topCount > 0) {
      const name = savedMeals.find((m) => m.id === topId)?.name;
      if (name) {
        return { kind: "celebration", name, count: topCount };
      }
    }

    // Action 5 Item 8 (2026-04-19) — loosened gate. The user owns a
    // saved meal but didn't log it this week. Look at the last 14 days
    // for a *different* slot they've been logging the same item into.
    // If we find an unsaved slot with ≥USUAL_MEAL_REPEAT_FLOOR (=3)
    // distinct-day repeats of the same (title, kcal) pattern, surface
    // a prompt for that slot.
    if (!extendedWeekKeys || extendedWeekKeys.length === 0) return null;
    const savedSlotSet = collectSavedMealSlots(savedMeals);
    const unsavedSlotPattern = findMostRepeatedUnsavedSlot(
      byDay,
      extendedWeekKeys,
      savedSlotSet,
    );
    if (
      unsavedSlotPattern &&
      unsavedSlotPattern.repeats >= USUAL_MEAL_REPEAT_FLOOR
    ) {
      return {
        kind: "prompt",
        suggestedSlot: unsavedSlotPattern.slot,
        repeats: unsavedSlotPattern.repeats,
      };
    }

    // No qualifying unsaved slot — suppress.
    return null;
  }

  // Prompt path — no saved meals yet. Gate on ≥5 distinct logged days.
  const daysLogged = weekKeys.filter((k) => {
    const meals = byDay[k];
    return Array.isArray(meals) && meals.length > 0;
  }).length;
  if (daysLogged < 5) return null;

  // Suggest the slot with the highest item-count across the week.
  const slotCounts: Record<"Breakfast" | "Lunch" | "Dinner" | "Snacks", number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snacks: 0,
  };
  for (const k of weekKeys) {
    const meals = byDay[k] ?? [];
    for (const m of meals) {
      const slotName = ((m as unknown as { name?: string }).name ?? "").trim();
      if (slotName === "Breakfast" || slotName === "Lunch" || slotName === "Dinner" || slotName === "Snacks") {
        slotCounts[slotName] += 1;
      } else if (slotName === "Snack") {
        slotCounts.Snacks += 1;
      }
    }
  }
  const suggested = (Object.entries(slotCounts) as Array<
    [keyof typeof slotCounts, number]
  >).reduce<[keyof typeof slotCounts, number]>(
    (top, next) => (next[1] > top[1] ? next : top),
    ["Breakfast", 0],
  );
  return { kind: "prompt", suggestedSlot: suggested[0] };
}

/**
 * Action 5 Item 8 helper — bucket saved meals by their `defaultMealSlot`
 * so the loosened gate can ask "is there already a usual for this
 * slot?". Saved meals without a default slot don't cover any slot
 * (they're not tied to a specific time of day).
 */
function collectSavedMealSlots(
  savedMeals: ReadonlyArray<{ defaultMealSlot?: string }>,
): Set<"Breakfast" | "Lunch" | "Dinner" | "Snacks"> {
  const out = new Set<"Breakfast" | "Lunch" | "Dinner" | "Snacks">();
  for (const m of savedMeals) {
    const raw = (m.defaultMealSlot ?? "").trim();
    if (raw === "Breakfast" || raw === "Lunch" || raw === "Dinner" || raw === "Snacks") {
      out.add(raw);
    } else if (raw === "Snack") {
      out.add("Snacks");
    }
  }
  return out;
}

/**
 * Action 5 Item 8 helper — for each *unsaved* slot, count distinct-day
 * repeats of the dominant (title, kcal) pattern across the supplied
 * window of date-keys. Returns the slot with the highest such count
 * and the count itself. Ties broken deterministically by canonical
 * slot order (Breakfast < Lunch < Dinner < Snacks). Returns `null`
 * when no unsaved slot has any repeats at all.
 */
function findMostRepeatedUnsavedSlot<M extends MealMacros>(
  byDay: ByDayOf<M>,
  windowKeys: readonly string[],
  savedSlotSet: ReadonlySet<"Breakfast" | "Lunch" | "Dinner" | "Snacks">,
): { slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks"; repeats: number } | null {
  const slots: ReadonlyArray<"Breakfast" | "Lunch" | "Dinner" | "Snacks"> = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snacks",
  ];

  let best: { slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks"; repeats: number } | null = null;

  for (const slot of slots) {
    if (savedSlotSet.has(slot)) continue;
    // For this slot, build (title|kcal) → set of distinct days where
    // that pattern appeared. The dominant pattern's day-count is the
    // "repeats" value for the slot.
    const patternDays = new Map<string, Set<string>>();
    for (const dayKey of windowKeys) {
      const meals = byDay[dayKey] ?? [];
      for (const m of meals) {
        const slotName = ((m as unknown as { name?: string }).name ?? "").trim();
        const normalisedSlot =
          slotName === "Snack"
            ? "Snacks"
            : slotName === "Breakfast" ||
                slotName === "Lunch" ||
                slotName === "Dinner" ||
                slotName === "Snacks"
              ? slotName
              : null;
        if (normalisedSlot !== slot) continue;
        const title = ((m as unknown as { recipeTitle?: string | null }).recipeTitle ?? "")
          .trim()
          .toLowerCase();
        if (!title) continue;
        const cal = Math.round(
          (m as unknown as { calories?: number | null }).calories ?? 0,
        );
        const key = `${title}|${cal}`;
        const set = patternDays.get(key) ?? new Set<string>();
        set.add(dayKey);
        patternDays.set(key, set);
      }
    }
    let topRepeats = 0;
    for (const set of patternDays.values()) {
      if (set.size > topRepeats) topRepeats = set.size;
    }
    if (topRepeats === 0) continue;
    // Strict greater-than means canonical slot order wins ties (we
    // iterate Breakfast → Snacks).
    if (!best || topRepeats > best.repeats) {
      best = { slot, repeats: topRepeats };
    }
  }

  return best;
}
