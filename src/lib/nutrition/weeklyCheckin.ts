/**
 * Weekly check-in (MacroFactor parity) — Sunday-morning surface that
 * makes the silent adaptive-TDEE refresh visible.
 *
 * Authority: extended-competitor-audit task (2026-04-30). MacroFactor
 * sells the *weekly ritual* — "your TDEE moved from X to Y, here's
 * why" + a one-tap goal-pace re-tune. Suppr's
 * `refreshAdaptiveTdeeForUser` runs silently with confidence gating;
 * the math is there, only the surface was missing.
 *
 * What this module owns (pure, no React, no IO):
 *   - `buildWeeklyCheckin` collapses the inputs into the display
 *     payload: TDEE before/after, plain-English why-line, intake delta
 *     vs target, weight delta vs week-ago, and a confidence gate.
 *   - `formatTdeeDelta` produces the "2,340 → 2,410 kcal/day" string.
 *   - `buildWhyLine` produces the single observational sentence shown
 *     under the headline.
 *   - `MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE` is the gate the screen
 *     uses to decide whether to render the headline number or the
 *     "building confidence" placeholder.
 *
 * Posture rules (pinned by `tests/unit/weeklyCheckin.test.ts`):
 *   - Observational copy only. No "crushed it" / "amazing" / streak
 *     anxiety / 🔥 emoji / exclamation marks.
 *   - We never invent a TDEE delta. When the previous-week TDEE is
 *     unknown (first run, no snapshot yet) the screen shows the
 *     first-week placeholder — the cascade returns
 *     `kind: "first_week"`.
 *   - Confidence gate: `weighInsThisWeek < 3` → `kind: "low_confidence"`.
 *     We trust the number to the user only when there's enough signal.
 *
 * Mobile re-exports from `apps/mobile/lib/weeklyCheckin.ts`.
 */

/** Minimum weight datapoints in the recap window before we render the
 *  TDEE delta as a confident statement. Below this we surface the
 *  "building confidence" placeholder. Mirrors the
 *  `MIN_WEIGH_INS = 3` floor in `adaptiveTdee.ts` so a check-in that
 *  passes the gate has the same data the engine used. */
export const MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE = 3;

/** Threshold below which two TDEE values are considered "the same".
 *  At ±20 kcal/day the noise floor swamps any real signal — surfacing
 *  it as a directional change would mislead the user. */
export const TDEE_NOISE_FLOOR_KCAL = 20;

export type WeeklyCheckinKind =
  | "first_week"
  | "low_confidence"
  | "ready";

export type WeeklyCheckinDirection = "up" | "down" | "flat";

export interface WeeklyCheckinInput {
  /** Adaptive TDEE at the *start* of the week (snapshot 7 days ago).
   *  `null` when we don't have a value (first week, no snapshot, or the
   *  user just installed). The cascade returns `first_week` in that
   *  case — we never invent the previous value. */
  previousTdeeKcal: number | null;
  /** Adaptive TDEE *now* — the value the engine just computed (or the
   *  formula fallback when adaptive isn't ready). Required.
   *  When `null`, the cascade also returns `first_week`. */
  currentTdeeKcal: number | null;
  /** Total intake (kcal) over the recap window. Used for the why-line
   *  computation and the surfaced "intake this week" stat. */
  weeklyIntakeKcal: number;
  /** Daily calorie target during the recap window. Used to compute
   *  the intake-vs-target line. 0 → target line is suppressed. */
  dailyTargetKcal: number;
  /** Weight at start of the recap window in kg, or `null`. */
  weightStartKg: number | null;
  /** Weight at end of the recap window in kg, or `null`. */
  weightEndKg: number | null;
  /** Distinct weigh-ins inside the window. Drives the confidence gate
   *  — below `MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE` we suppress the
   *  delta and render the "building confidence" placeholder. */
  weighInsThisWeek: number;
  /** Number of days the user logged ≥1 meal in the window. Used by
   *  the intake-line phrasing — when this is 0 we suppress the
   *  intake-delta narrative entirely. */
  daysLogged: number;
  /**
   * F-129 (Grace, 2026-05-07): "this page is always stuck and or wrong" —
   * the screen kept rendering "Building confidence — needs more data"
   * even when the engine reported high confidence on the long-term
   * adaptive TDEE. Conflict mirror of F-124 on the Progress tab: the
   * weighInsThisWeek gate was second-guessing the engine's confidence.
   *
   * When the engine reports `"high"` confidence we trust it and skip
   * the weighInsThisWeek floor entirely — the engine already weights
   * data quality into its confidence. Medium / low / null still gate
   * on weighInsThisWeek as before, so a first-week user without an
   * adaptive history still sees the calibrating copy.
   *
   * Pass the value from `profiles.adaptive_tdee_confidence` directly;
   * any string other than `"low" | "medium" | "high"` is treated as
   * null (no engine signal yet).
   */
  adaptiveTdeeConfidence?: "low" | "medium" | "high" | null;
}

export interface WeeklyCheckin {
  kind: WeeklyCheckinKind;
  /** Direction of the TDEE change. `flat` when |delta| ≤
   *  `TDEE_NOISE_FLOOR_KCAL` or kind !== "ready". */
  direction: WeeklyCheckinDirection;
  /** Headline for the TDEE row. Always safe to render — the cascade
   *  picks the right copy for first_week / low_confidence / ready. */
  headline: string;
  /** Plain-English "why" line. Empty string when `kind !== "ready"`
   *  so the host can suppress the line cleanly. */
  whyLine: string;
  /** "2,340 → 2,410 kcal/day" — empty string when kind != "ready". */
  deltaLine: string;
  /** Intake stat line: "You ate 14,600 kcal this week — 100 under
   *  target." Empty string when daysLogged === 0 or no target. */
  intakeLine: string;
  /** Weight stat line: "Weight: 78.4 → 77.8 kg (-0.6 kg)." Empty
   *  string when we don't have ≥2 weigh-ins inside the window. */
  weightLine: string;
  /** Numeric change in TDEE (current - previous). `null` when
   *  kind !== "ready". Useful for analytics and the goal-pace
   *  preview. */
  tdeeDeltaKcal: number | null;
  /** Numeric weight change. `null` when we don't have both weight
   *  endpoints. */
  weightDeltaKg: number | null;
  /** Numeric intake delta vs target (intake - target * daysLogged).
   *  `null` when daysLogged === 0 or target === 0. */
  intakeDeltaKcal: number | null;
}

/** Round a kcal value to a sensible whole number for display. */
function roundKcal(n: number): number {
  return Math.round(n);
}

/** Format kcal with thousand separators. We use a hard-coded
 *  comma formatter so server-rendered web output and mobile output
 *  match without depending on the runtime's default locale. */
export function formatKcal(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(roundKcal(n));
  const s = String(abs);
  // Insert commas every 3 digits from the right.
  let withCommas = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) withCommas += ",";
    withCommas += s[i];
  }
  return `${sign}${withCommas}`;
}

/** "2,340 → 2,410 kcal/day". The arrow is the "rightwards arrow"
 *  (U+2192) — same glyph the Digest weight-line uses, so visual
 *  consistency holds. */
export function formatTdeeDelta(prevKcal: number, currentKcal: number): string {
  return `${formatKcal(prevKcal)} → ${formatKcal(currentKcal)} kcal/day`;
}

/** Resolve direction with the noise floor. */
function resolveDirection(deltaKcal: number): WeeklyCheckinDirection {
  if (Math.abs(deltaKcal) <= TDEE_NOISE_FLOOR_KCAL) return "flat";
  return deltaKcal > 0 ? "up" : "down";
}

/**
 * Pure why-line generator. The phrasing pairs the intake balance with
 * the weight trend — i.e. did the user eat below maintenance and lose,
 * or above maintenance and gain? Every branch is observational.
 *
 * Inputs:
 *   - `tdeeDeltaKcal` — current - previous
 *   - `weightDeltaKg` — null when ≥2 weigh-ins missing
 *   - `intakeVsExpected` — intake (kcal/day average) minus the
 *     PREVIOUS TDEE, i.e. how the user's actual eating compares to
 *     last week's expected burn. This is the cleanest "why" anchor:
 *     it asks "given last week's TDEE estimate, did the user eat
 *     more or less?" and the new TDEE gives the answer of whether
 *     the body is burning more / less than the engine thought.
 */
export function buildWhyLine(input: {
  tdeeDeltaKcal: number;
  weightDeltaKg: number | null;
  intakeVsExpected: number | null;
  direction: WeeklyCheckinDirection;
}): string {
  const { weightDeltaKg, intakeVsExpected, direction } = input;

  // Direction-flat branch — explicit "no meaningful change" copy. We
  // don't try to explain noise, we just say it.
  if (direction === "flat") {
    return "Your TDEE estimate held steady this week.";
  }

  const intakeKnown =
    intakeVsExpected != null && Number.isFinite(intakeVsExpected);
  const weightKnown = weightDeltaKg != null && Number.isFinite(weightDeltaKg);

  // Both signals known — the rich case. We can name the surplus or
  // deficit AND the weight change observation.
  if (intakeKnown && weightKnown) {
    const ate = intakeVsExpected as number; // negative = under, positive = over
    const weightDelta = weightDeltaKg as number;
    const weightAbs = Math.abs(weightDelta);
    const weightDir =
      weightDelta < -0.05 ? "less" : weightDelta > 0.05 ? "more" : "the same";

    // Direction up = burning MORE than the engine thought.
    if (direction === "up") {
      if (ate < 0 && weightDir === "less") {
        // Standard pattern — ate under, lost more than expected.
        return `You ate under your previous estimate and weighed ${weightAbs.toFixed(1)} kg less — your body is burning more than we thought.`;
      }
      if (ate > 0 && weightDir !== "more") {
        // Ate over, but didn't gain as much as expected.
        return `You ate above your previous estimate but didn't gain — your body is burning more than we thought.`;
      }
      return "Your body is burning more than the previous estimate.";
    }
    // direction === "down" — burning less than the engine thought.
    if (ate < 0 && weightDir !== "less") {
      // Ate under, but didn't lose.
      return `You ate under your previous estimate but didn't lose — your body is burning less than we thought.`;
    }
    if (ate > 0 && weightDir === "more") {
      return `You ate above your previous estimate and weighed ${weightAbs.toFixed(1)} kg more — your body is burning less than we thought.`;
    }
    return "Your body is burning less than the previous estimate.";
  }

  // Weight-only — common when the user weighs in but doesn't log every
  // meal. We can still describe the pattern.
  if (weightKnown) {
    const weightDelta = weightDeltaKg as number;
    const weightAbs = Math.abs(weightDelta);
    if (direction === "up") {
      return weightDelta < 0
        ? `You weighed ${weightAbs.toFixed(1)} kg less — your body is burning more than we thought.`
        : `Your body is burning more than the previous estimate.`;
    }
    return weightDelta > 0
      ? `You weighed ${weightAbs.toFixed(1)} kg more — your body is burning less than we thought.`
      : `Your body is burning less than the previous estimate.`;
  }

  // Intake-only — rarer (user logs but doesn't weigh) but possible.
  if (intakeKnown) {
    return direction === "up"
      ? `Your body is burning more than the previous estimate based on this week's intake.`
      : `Your body is burning less than the previous estimate based on this week's intake.`;
  }

  // Neither — should not happen at "ready" tier (the gate requires
  // weigh-ins) but be defensive.
  return direction === "up"
    ? "Your body is burning more than the previous estimate."
    : "Your body is burning less than the previous estimate.";
}

/**
 * Build the weekly check-in payload from the supplied inputs. Pure —
 * no IO, no time injection (the caller pre-aggregates the window).
 */
export function buildWeeklyCheckin(input: WeeklyCheckinInput): WeeklyCheckin {
  const {
    previousTdeeKcal,
    currentTdeeKcal,
    weeklyIntakeKcal,
    dailyTargetKcal,
    weightStartKg,
    weightEndKg,
    weighInsThisWeek,
    daysLogged,
    adaptiveTdeeConfidence,
  } = input;
  // F-129: when the engine reports "high" confidence we trust it and
  // skip the weighInsThisWeek floor below. See the field's docstring
  // on `WeeklyCheckinInput` for the conflict this resolves.
  const engineHighConfidence = adaptiveTdeeConfidence === "high";

  // Weight delta — only when both endpoints exist and are finite.
  const weightDeltaKg =
    weightStartKg != null &&
    weightEndKg != null &&
    Number.isFinite(weightStartKg) &&
    Number.isFinite(weightEndKg)
      ? Math.round((weightEndKg - weightStartKg) * 10) / 10
      : null;

  const weightLine =
    weightDeltaKg != null && weightStartKg != null && weightEndKg != null
      ? `Weight: ${formatKgFixed1(weightStartKg)} → ${formatKgFixed1(weightEndKg)} kg (${weightDeltaKg > 0 ? "+" : ""}${weightDeltaKg.toFixed(1)} kg).`
      : "";

  // Intake delta — only when at least one day is logged AND a target
  // exists. We compute against `daysLogged` rather than 7 because a
  // 3-days-logged user shouldn't be told they were 4 × target under.
  const intakeDeltaKcal =
    daysLogged > 0 && dailyTargetKcal > 0
      ? roundKcal(weeklyIntakeKcal - dailyTargetKcal * daysLogged)
      : null;

  const intakeLine = (() => {
    if (daysLogged === 0) return "";
    const totalStr = `${formatKcal(weeklyIntakeKcal)} kcal`;
    if (intakeDeltaKcal == null) {
      return `You ate ${totalStr} across ${daysLogged} day${daysLogged === 1 ? "" : "s"}.`;
    }
    const abs = Math.abs(intakeDeltaKcal);
    if (abs <= 50) {
      return `You ate ${totalStr} across ${daysLogged} day${daysLogged === 1 ? "" : "s"} — on target overall.`;
    }
    const direction = intakeDeltaKcal < 0 ? "under" : "over";
    return `You ate ${totalStr} across ${daysLogged} day${daysLogged === 1 ? "" : "s"} — ${formatKcal(abs)} ${direction} target.`;
  })();

  // First-week / no-current branch — surface a placeholder, no delta.
  if (
    previousTdeeKcal == null ||
    !Number.isFinite(previousTdeeKcal) ||
    previousTdeeKcal <= 0 ||
    currentTdeeKcal == null ||
    !Number.isFinite(currentTdeeKcal) ||
    currentTdeeKcal <= 0
  ) {
    return {
      kind: "first_week",
      direction: "flat",
      headline: "Your check-in starts after 7 days of data.",
      whyLine: "",
      deltaLine: "",
      intakeLine,
      weightLine,
      tdeeDeltaKcal: null,
      weightDeltaKg,
      intakeDeltaKcal,
    };
  }

  // Confidence gate — too few weigh-ins to trust the delta. F-129
  // carve-out: skip when the engine has already declared high
  // confidence (it has more signal than this weekly window alone).
  if (
    !engineHighConfidence &&
    weighInsThisWeek < MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE
  ) {
    return {
      kind: "low_confidence",
      direction: "flat",
      headline: "Building confidence — needs more data.",
      whyLine: "",
      deltaLine: formatTdeeDelta(previousTdeeKcal, currentTdeeKcal),
      intakeLine,
      weightLine,
      tdeeDeltaKcal: roundKcal(currentTdeeKcal - previousTdeeKcal),
      weightDeltaKg,
      intakeDeltaKcal,
    };
  }

  // Ready — confident render.
  const deltaKcal = roundKcal(currentTdeeKcal - previousTdeeKcal);
  const direction = resolveDirection(deltaKcal);

  // Intake-vs-expected anchor for the why-line: average daily intake
  // minus the *previous* TDEE estimate. This tells us "given last
  // week's expected burn, did the user eat more or less?".
  const avgDailyIntake = daysLogged > 0 ? weeklyIntakeKcal / daysLogged : null;
  const intakeVsExpected =
    avgDailyIntake != null ? avgDailyIntake - previousTdeeKcal : null;

  const whyLine = buildWhyLine({
    tdeeDeltaKcal: deltaKcal,
    weightDeltaKg,
    intakeVsExpected,
    direction,
  });

  // Headline copy — the headline is the "value" the user reads first.
  // For the flat branch we keep it observational, no celebration.
  const headline = (() => {
    if (direction === "flat") {
      return "Your TDEE held steady.";
    }
    if (direction === "up") {
      return `Your TDEE estimate moved up by ${formatKcal(Math.abs(deltaKcal))} kcal.`;
    }
    return `Your TDEE estimate moved down by ${formatKcal(Math.abs(deltaKcal))} kcal.`;
  })();

  return {
    kind: "ready",
    direction,
    headline,
    whyLine,
    deltaLine: formatTdeeDelta(previousTdeeKcal, currentTdeeKcal),
    intakeLine,
    weightLine,
    tdeeDeltaKcal: deltaKcal,
    weightDeltaKg,
    intakeDeltaKcal,
  };
}

function formatKgFixed1(n: number): string {
  return n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Weekly TDEE Check-in Ritual Modal (PR claude/weekly-checkin-ritual-v2,
// 2026-05-02 — rebuild of #26 on top of current main).
//
// The Suppr math pipeline (`adaptiveTdee.ts` + `refreshAdaptiveTdee.ts`)
// runs silently — adaptive TDEE updates after each weigh-in or log without
// ever surfacing the change to the user. MacroFactor's hook is the *moment*:
// a weekly modal that says "your real burn just changed, here is your new
// target, accept or keep current".
//
// This block owns the pure logic for that ritual:
//   - `shouldShowWeeklyCheckin` — gate that decides whether the modal
//     renders this visit.
//   - `buildWeeklyCheckinContent` — collapses a profile + last-week's
//     intake/weight into the display-ready content for the modal.
//
// Pure module — no React, no I/O, no `Date.now()` outside the injected
// clock. Mobile re-exports from `apps/mobile/lib/weeklyCheckin.ts` so
// both platforms hit the same code path.
//
// Decisions pinned by tests:
//   - Gate fires only when adaptive TDEE confidence is medium or high
//     (low confidence = math doesn't trust itself, no ritual).
//   - Gate fires only when the user has logged ≥ 5 days in the current
//     calendar week (otherwise the "expenditure changed" claim is built
//     on too little data).
//   - Cooldown: 6 days between shown timestamps. 6 not 7 so a Sunday
//     check-in slot doesn't drift past the next Sunday on a long week.
//   - The suggested target preserves the user's current deficit/surplus
//     by adding the *delta between adaptive and prior TDEE* to the
//     current target. We never recommend a target below 1200 kcal.
//
// Naming note: this module already exports `WeeklyCheckin*` types for
// the *Digest cascade* surface (above). The modal-ritual additions
// below use the `WeeklyCheckinModal*` / `*Content` / `*Gate*` namespacing
// so the two surfaces' types never collide.
// ---------------------------------------------------------------------------

export type WeeklyCheckinConfidence = "low" | "medium" | "high";

export interface WeeklyCheckinGateInput {
  /** Adaptive TDEE confidence as written by `refreshAdaptiveTdee`. */
  adaptiveTdeeConfidence: WeeklyCheckinConfidence | null;
  /** Adaptive TDEE kcal value (only fired when confidence ≥ medium). */
  adaptiveTdee: number | null;
  /** Number of days with non-zero calories logged in the current week
   *  (Sun-to-Sat or Mon-to-Sun, per the user's `week_start_day`). */
  daysLoggedThisWeek: number;
  /** ISO timestamp of the last shown check-in modal (any decision).
   *  `null` when the user has never seen one. */
  lastShownAt: string | null;
  /** Injectable clock for tests. Defaults to `new Date()`. */
  now?: Date;
}

/** Minimum days between shown check-ins. 6 days = "next Sunday is fine". */
const COOLDOWN_DAYS = 6;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** Minimum days logged in the current week to claim "expenditure changed". */
export const MIN_DAYS_LOGGED_FOR_CHECKIN = 5;

/** Floor for any suggested target — never recommend below this. */
const MIN_SUGGESTED_TARGET_KCAL = 1200;

/**
 * Decide whether to show the weekly check-in modal on this Today
 * first-load.
 *
 * Returns `false` when any of these are true (in priority order):
 *   1. Adaptive TDEE confidence is null or "low".
 *   2. Adaptive TDEE value is missing / non-finite / non-positive.
 *   3. The user has logged fewer than 5 days in the current week.
 *   4. The modal was shown within the last 6 days.
 */
export function shouldShowWeeklyCheckin(input: WeeklyCheckinGateInput): boolean {
  const {
    adaptiveTdeeConfidence,
    adaptiveTdee,
    daysLoggedThisWeek,
    lastShownAt,
  } = input;

  if (adaptiveTdeeConfidence !== "medium" && adaptiveTdeeConfidence !== "high") {
    return false;
  }
  if (
    adaptiveTdee == null ||
    !Number.isFinite(adaptiveTdee) ||
    adaptiveTdee <= 0
  ) {
    return false;
  }
  if (
    !Number.isFinite(daysLoggedThisWeek) ||
    daysLoggedThisWeek < MIN_DAYS_LOGGED_FOR_CHECKIN
  ) {
    return false;
  }

  if (lastShownAt) {
    const shownAt = Date.parse(lastShownAt);
    if (Number.isFinite(shownAt)) {
      const now = (input.now ?? new Date()).getTime();
      if (now - shownAt < COOLDOWN_MS) {
        return false;
      }
    }
  }

  return true;
}

export interface WeeklyCheckinContentInput {
  /** Adaptive TDEE kcal value (post-gate, guaranteed finite + positive). */
  adaptiveTdee: number;
  /** Static / prior TDEE kcal value used as the comparison baseline.
   *  Typically the formula-only Mifflin TDEE. `null` when not available
   *  — content still renders but the delta line is suppressed. */
  priorTdee: number | null;
  /** Current daily calorie target the user is on. */
  currentTargetKcal: number;
  /** Average daily calories logged this week (over days-with-food). */
  avgCaloriesThisWeek: number;
  /** Weight delta in kg over the last 7 days, rounded to 0.1.
   *  `null` when fewer than 2 weigh-ins in the window — we never
   *  fabricate a "+0.0 kg" delta. */
  weightDeltaKg: number | null;
}

export interface WeeklyCheckinContent {
  /** Full TDEE delta (adaptive − prior). `null` when prior is missing. */
  tdeeDeltaKcal: number | null;
  /** Suggested new daily target. Preserves the user's current
   *  deficit/surplus by adding `tdeeDeltaKcal` to the current target.
   *  Falls back to the current target when `tdeeDeltaKcal` is null.
   *  Never returns a value below `MIN_SUGGESTED_TARGET_KCAL`. */
  suggestedTargetKcal: number;
  /**
   * 2026-05-08 (build-47 follow-up, Grace `APPzhqLXgb64_9reZ44rGk4`):
   * "If my tdee is lower why is my target higher?". When the math says
   * `currentTargetKcal + tdeeDeltaKcal` would land below the safety
   * floor, the suggestion is bumped up. Surface this fact + the raw
   * (pre-clamp) value so the modal can render an honest explainer
   * instead of leaving the user to guess. `null` when no clamp was
   * applied (math result already at or above the floor).
   */
  floorAppliedKcal: number | null;
  /** Headline copy. Calm, factual — no exclamation marks, no
   *  performance adjectives. */
  headline: string;
  /** "Why" subline — one sentence explaining what changed. */
  whyLine: string;
  /** Tabular-ready label for the avg-this-week line. */
  avgThisWeekLabel: string;
  /** Tabular-ready label for the weight-delta line. `null` when
   *  weightDeltaKg is null (we suppress rather than render "+0.0 kg"). */
  weightDeltaLabel: string | null;
}

function formatSignedKcalRow(n: number): string {
  if (n === 0) return "0 kcal";
  const sign = n > 0 ? "+" : "−"; // unicode minus
  return `${sign}${Math.abs(Math.round(n))} kcal`;
}

function formatSignedKgRow(n: number): string {
  if (n === 0) return "0.0 kg";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

/**
 * Build the display content for the modal. Pure — caller is responsible
 * for assembling inputs from the profile + journal + weight series.
 */
export function buildWeeklyCheckinContent(
  input: WeeklyCheckinContentInput,
): WeeklyCheckinContent {
  const {
    adaptiveTdee,
    priorTdee,
    currentTargetKcal,
    avgCaloriesThisWeek,
    weightDeltaKg,
  } = input;

  const tdeeDeltaKcal =
    priorTdee != null && Number.isFinite(priorTdee)
      ? Math.round(adaptiveTdee - priorTdee)
      : null;

  const rawTargetKcal =
    tdeeDeltaKcal == null
      ? Math.round(currentTargetKcal)
      : Math.round(currentTargetKcal + tdeeDeltaKcal);
  const suggestedTargetKcal = Math.max(MIN_SUGGESTED_TARGET_KCAL, rawTargetKcal);
  const floorAppliedKcal =
    rawTargetKcal < MIN_SUGGESTED_TARGET_KCAL ? rawTargetKcal : null;

  const headline = "Your weekly check-in is ready";

  const whyLine = (() => {
    if (tdeeDeltaKcal == null) {
      return `Your real burn this week is ${Math.round(adaptiveTdee).toLocaleString("en-GB")} kcal a day.`;
    }
    if (tdeeDeltaKcal === 0) {
      return "Your real burn held steady this week.";
    }
    const direction = tdeeDeltaKcal > 0 ? "higher" : "lower";
    return `Your real burn is ${formatSignedKcalRow(tdeeDeltaKcal)} ${direction} than the formula.`;
  })();

  const avgThisWeekLabel = `${Math.round(avgCaloriesThisWeek).toLocaleString("en-GB")} kcal/day`;

  const weightDeltaLabel =
    weightDeltaKg == null ? null : formatSignedKgRow(weightDeltaKg);

  return {
    tdeeDeltaKcal,
    suggestedTargetKcal,
    floorAppliedKcal,
    headline,
    whyLine,
    avgThisWeekLabel,
    weightDeltaLabel,
  };
}

/** Stable type for the persisted decision. Keep in sync with the
 *  CHECK constraint on `profiles.last_weekly_checkin_decision`. */
export type WeeklyCheckinDecision = "accepted" | "kept_current" | "dismissed";
