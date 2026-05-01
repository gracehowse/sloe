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
  const { tdeeDeltaKcal, weightDeltaKg, intakeVsExpected, direction } = input;

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
  } = input;

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

  // Confidence gate — too few weigh-ins to trust the delta.
  if (weighInsThisWeek < MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE) {
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
