/**
 * whyThisNumber — pure helper that explains how today's calorie target
 * was derived. Used by the "Why this number?" sheet on Today (mobile)
 * and the equivalent dialog (web).
 *
 * Closes audit gap #10 (transparency moat). Every competitor —
 * MacroFactor, Lose It, MyFitnessPal — is opaque about WHY today's
 * target is X kcal. Suppr already computes the maintenance TDEE
 * (`adaptive_tdee` or formula fallback) and the goal/pace stored on
 * the profile; this helper turns those into plain-English copy.
 *
 * Pure function — no I/O, no Date access, no React. Safe to call from
 * both platforms and from tests.
 *
 * Voice rules (production design spec §1.7):
 *   - UK English where natural, but "calories" stays "calories" (the
 *     user-facing unit is kcal).
 *   - Second person.
 *   - No exclamation marks. Restrained, factual.
 *   - Always-on per D-2026-04-27-12: we never refuse to render. When
 *     confidence is low we say so in plain English instead of hiding.
 */

export type WhyThisNumberGoal = "lose" | "maintain" | "gain";

export interface WhyThisNumberInput {
  /** Today's calorie target as it appears on the ring. Required. */
  targetCalories: number;
  /** Maintenance TDEE — adaptive when we have it, formula fallback
   *  otherwise. `null` means we have no estimate yet (calibrating). */
  maintenanceTdee: number | null;
  /** TDEE confidence from the adaptive engine. `null` when no estimate. */
  confidence: "low" | "medium" | "high" | null;
  /** Days of logging behind the maintenance estimate. Used to qualify
   *  the "adaptive" wording — < 14 days reads "early estimate". */
  loggingDays?: number | null;
  /** User's stated goal direction. */
  goal: WhyThisNumberGoal;
  /**
   * Weekly weight-change pace target in kg/week. Negative for losing,
   * positive for gaining, 0 for explicit maintain.
   *
   * IMPORTANT: this field has three distinct states and the renderer
   * relies on all three:
   *   - non-zero number → "Lose / Gain X kg/wk"
   *   - exactly 0       → "Maintain" (explicitly chosen by the user)
   *   - null            → "Goal not set" (no plan_pace stored on the
   *                        profile yet — we cannot infer direction)
   *
   * Callers MUST pass `null` when the source is genuinely unknown
   * (e.g. profile.plan_pace is null and the user hasn't picked a
   * preset). Returning 0 in that case would mislabel the user as
   * maintaining when they're actually mid-onboarding.
   */
  paceKgPerWeek: number | null;
  /**
   * Optional context to give a SPECIFIC calibrating ask when the
   * adaptive TDEE gate hasn't fired yet. Both fields are independent
   * — pass either, both, or neither. When both are absent we fall
   * back to generic "calibrating — keep logging" copy.
   *
   * Numbers reflect the calendar window the adaptive engine looks at
   * (default 28-day rolling). Caller pre-computes from the byDay
   * shapes it already hydrates (`nutritionByDay`, `weight_kg_by_day`).
   */
  mealLogDays?: number | null;
  weightLogCount?: number | null;
  /**
   * Whether the user has a connected wearable (Apple Health) feeding
   * activity + resting-burn data. Controls the "Your Watch" story beat:
   * we only tell the watch story to people who actually have one,
   * otherwise it reads as a feature they don't have. Defaults to
   * `false` (no watch beat) when omitted, so web — which has no native
   * Health integration — never shows it unless a caller opts in.
   */
  hasWearable?: boolean;
}

export interface WhyThisNumberLine {
  /** Stable id for keyed list rendering. */
  key: "tdee" | "goal" | "result";
  /** Short label on the left of the row (e.g. "TDEE"). */
  label: string;
  /** The value or qualifier on the right (e.g. "2,150 kcal"). */
  value: string;
}

/**
 * One plain-English "how this works" beat for the explainer's
 * "How we work this out" section. These tell the user the *story* of
 * the maintenance architecture (the four layers in the 2026-06-10 TDEE
 * decision) in warm, jargon-free language — distinct from the numeric
 * 3-row breakdown above, which shows the *math*.
 *
 * The set of beats adapts to state: a still-calibrating user sees the
 * "we start from your stats" beat framed as what's happening now; a user
 * with an adaptive number sees the "we've learned from your N
 * fully-logged days" beat instead. The "partial days don't count" and
 * "your Watch" beats are always present — they answer the two questions
 * users actually ask ("why didn't a forgotten dinner drag my number
 * down?" and "why isn't my workout in my baseline?").
 *
 * Voice: warm-coaching, second person, no jargon, no medical claims,
 * no shaming. Sources are cited in the repo doc, never in-app.
 */
export interface WhyThisNumberStoryBeat {
  /** Stable id for keyed rendering + test targeting. */
  key: "seed" | "learn" | "gate" | "watch" | "range";
  /** The plain-English sentence shown to the user. */
  text: string;
}

export interface WhyThisNumberResult {
  /** Headline copy: "Today's target: 1,800 kcal". */
  targetHeadline: string;
  /** Three short rows that explain the math. Render in order. */
  lines: WhyThisNumberLine[];
  /**
   * Plain-English "How we work this out" beats — the story of the
   * maintenance architecture in warm, non-jargon language. Render in
   * order under a "How we work this out" heading, below the numeric
   * breakdown. Always at least three beats; the exact set adapts to
   * state (see `WhyThisNumberStoryBeat`).
   */
  storyBeats: WhyThisNumberStoryBeat[];
  /**
   * Plain-English summary sentence — used by mobile bottom sheet
   * subhead and screen-reader announcements. Always present.
   */
  summary: string;
  /** True when the maintenance number is explicitly an early estimate
   *  (loggingDays < 14 OR confidence = "low"). Renderer can use this to
   *  add a calibrating chip / italic qualifier. */
  isEarlyEstimate: boolean;
  /**
   * Specific copy for the "what to do to unlock adaptive TDEE" ask.
   * Present only when `maintenanceTdee` is null AND we received at
   * least one of `mealLogDays` / `weightLogCount`. Renderer shows this
   * INSTEAD of the generic calibrating qualifier.
   */
  calibratingAsk: string | null;
}

/** ~7700 kcal per kg of body fat. Conservative round. */
const KCAL_PER_KG_FAT = 7700;
const KCAL_PER_DAY_PER_WEEKLY_KG = KCAL_PER_KG_FAT / 7;

/**
 * ENG-1025 — gain budgets apply only HALF the nominal surplus (lean-bulk
 * asymmetry; see `GAIN_SURPLUS_PACE_FACTOR` in `tdee.ts`). Duplicated here
 * (rather than imported) to keep this helper React-Native-safe and
 * dependency-free, the same pattern the gate constants below follow. When
 * the factor in `tdee.ts` changes, change here in lockstep — the parity
 * test `whyThisNumber.test.ts` pins that a gain user's Goal row, Result
 * row, and implied pace all agree.
 */
const GAIN_SURPLUS_PACE_FACTOR = 0.5;

/** Mirrors `MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE` and
 *  `MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE` in
 *  `src/lib/nutrition/progressDataContract.ts` (re-exported from
 *  `adaptiveTdee.ts` as `MIN_LOGGING_DAYS` / `MIN_WEIGH_INS`).
 *  Duplicated here (rather than imported) so the helper stays
 *  React-Native-safe and dependency-free. When those constants move,
 *  update here in lockstep — the test `whyThisNumber.test.ts` pins the
 *  gate values. NB: these count *fully-logged* days only — partial days
 *  are excluded by the completeness gate (R1) and never enter the
 *  estimate, which is the whole point of the "forgotten dinner can't
 *  drag your number down" story beat. */
const MIN_MEAL_LOG_DAYS_FOR_TDEE = 7;
const MIN_WEIGHT_LOGS_FOR_TDEE = 3;

/**
 * Map the legacy `plan_pace` preset enum stored on `profiles.plan_pace`
 * to a kg/week magnitude. Sign comes from the goal (lose → negative,
 * gain → positive, maintain → 0). Mirrors the constants in
 * `src/lib/nutrition/tdee.ts:PACE_WEEKLY_KG` — when those move, update
 * here in lockstep.
 *
 * Returns `null` for unknown / null preset on a non-maintain goal,
 * which the renderer surfaces as "Goal not set". This is deliberate:
 * a missing preset is NOT the same as explicit maintenance.
 */
export function paceKgPerWeekFromPreset(
  preset: string | null | undefined,
  goal: WhyThisNumberGoal,
): number | null {
  if (goal === "maintain") return 0;
  let mag: number;
  switch (preset) {
    case "relaxed":
      mag = 0.25;
      break;
    case "steady":
      mag = 0.5;
      break;
    case "accelerated":
      mag = 0.75;
      break;
    case "vigorous":
      mag = 1.0;
      break;
    default:
      return null;
  }
  return goal === "lose" ? -mag : mag;
}

function fmtKcal(n: number): string {
  return `${Math.round(n).toLocaleString()} kcal`;
}

function fmtPaceKg(paceKg: number): string {
  // Round to 0.05 to avoid surfacing noisy float arithmetic.
  const rounded = Math.round(paceKg * 20) / 20;
  // Strip a trailing `.0` for tidy display ("0.5 kg/wk" not "0.50 kg/wk").
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} kg/wk`;
}

function goalLabel(
  goal: WhyThisNumberGoal,
  paceKg: number | null,
): string {
  // Unknown pace → user has not picked a preset. Don't lie about it.
  if (paceKg === null) return "Goal not set";
  if (goal === "maintain" || paceKg === 0) return "Maintain";
  if (goal === "lose") return `Lose ${fmtPaceKg(Math.abs(paceKg))}`.replace("+", "");
  return `Gain ${fmtPaceKg(Math.abs(paceKg))}`.replace("+", "");
}

/**
 * Build a SPECIFIC calibrating ask telling the user exactly what's
 * missing for adaptive TDEE to compute. Returns `null` when neither
 * `mealLogDays` nor `weightLogCount` was supplied (caller hasn't wired
 * them up yet) — render the generic "calibrating" line instead.
 */
function buildCalibratingAsk(
  mealLogDays: number | null,
  weightLogCount: number | null,
): string | null {
  if (mealLogDays == null && weightLogCount == null) return null;

  const needsMeals =
    mealLogDays != null && mealLogDays < MIN_MEAL_LOG_DAYS_FOR_TDEE;
  const needsWeights =
    weightLogCount != null && weightLogCount < MIN_WEIGHT_LOGS_FOR_TDEE;

  if (!needsMeals && !needsWeights) {
    // Both gates are satisfied but maintenance is still null — must be
    // a transient compute miss. Don't render an ask.
    return null;
  }

  const parts: string[] = [];
  if (needsWeights) {
    parts.push(
      `Log your weight ${MIN_WEIGHT_LOGS_FOR_TDEE}+ times for an accurate maintenance estimate.`,
    );
  }
  if (needsMeals) {
    parts.push(
      `Keep logging meals — we'll calibrate after ${MIN_MEAL_LOG_DAYS_FOR_TDEE} days.`,
    );
  }
  parts.push("Until then, your target is based on your stated goal.");
  return parts.join(" ");
}

/**
 * Build the plain-English "How we work this out" story beats — the
 * four-layer maintenance architecture told in warm, jargon-free
 * language. The 2026-06-10 TDEE decision
 * (`docs/decisions/2026-06-10-adaptive-tdee-gating.md`) is the source;
 * the user-facing summary is `docs/user/how-your-calorie-target-works.md`.
 *
 * Beats, in order:
 *   1. seed  — "We start from your height, weight, age and sex."
 *   2. learn — "Then we learn from what you actually log and how your
 *               weight responds." (present-tense ask when calibrating;
 *               past-tense "we've learned from N days" once we have it)
 *   3. gate  — "Days that look only partly logged don't count toward
 *               learning — so a forgotten dinner can't drag your number
 *               down." (THE 'why' — always present)
 *   4. watch — Apple Watch role: bonus on the day, resting-burn floor,
 *               but NOT averaged into the baseline. (only when
 *               `hasWearable`)
 *   5. range — "Your number updates gradually, and never moves outside
 *               a sensible range of your starting estimate." (always)
 *
 * Pure. No medical claims, no "guaranteed", body-neutral.
 */
export function buildStoryBeats(input: {
  maintenanceTdee: number | null;
  loggingDays: number | null;
  hasWearable: boolean;
}): WhyThisNumberStoryBeat[] {
  const hasEstimate =
    input.maintenanceTdee != null && input.maintenanceTdee > 0;
  const beats: WhyThisNumberStoryBeat[] = [];

  // 1. Seed — the formula start point. Always present.
  beats.push({
    key: "seed",
    text: "We start from your height, weight, age and sex to estimate the calories you'd burn on a quiet day.",
  });

  // 2. Learn — the adaptive layer. Phrasing flips on whether we have a
  //    number yet. Naming the day count (when known) shows WHY learning
  //    can be slower for someone who logs in bursts.
  if (hasEstimate && input.loggingDays != null && input.loggingDays > 0) {
    beats.push({
      key: "learn",
      text: `Then we learn from what you actually log and how your weight responds over time — that's the most reliable signal there is, and it's what serious coaching apps use. So far we've learned from your ${input.loggingDays} fully-logged days.`,
    });
  } else if (hasEstimate) {
    beats.push({
      key: "learn",
      text: "Then we learn from what you actually log and how your weight responds over time — that's the most reliable signal there is, and it's what serious coaching apps use.",
    });
  } else {
    beats.push({
      key: "learn",
      text: "As you log meals and weigh in, we learn from what you actually eat and how your weight responds — the most reliable signal there is. Until then, your target is based on your stated goal.",
    });
  }

  // 3. Gate — THE 'why' Grace wants users to understand. Always present.
  beats.push({
    key: "gate",
    text: "Days that look only partly logged don't count toward this learning — so a forgotten dinner can't drag your number down.",
  });

  // 4. Watch — only for wearable owners. Three precise jobs: bonus on
  //    the day, resting-burn sanity floor, NOT averaged into baseline.
  if (input.hasWearable) {
    beats.push({
      key: "watch",
      text: "Your Watch adds workouts and activity to today's budget the day you earn them, and we use its resting-burn reading as a sanity check. We don't fold workout calories into your baseline, because a wrist estimate of exercise burn is the least reliable number it produces.",
    });
  }

  // 5. Range — the plausibility bound. Always present, reassuring.
  beats.push({
    key: "range",
    text: "Your number updates gradually as we learn, and it never moves outside a sensible range of your starting estimate.",
  });

  return beats;
}

/**
 * ENG-1025 — resolve the EFFECTIVE weekly kg pace to display for the goal
 * row, implied-deficit line, and summary. For loss / maintain this is the
 * nominal pace unchanged. For gain it reflects the halved surplus the
 * budget actually applies:
 *
 *   - When we have a maintenance number, the budget is the source of
 *     truth: effective pace = (target − maintenance) → kcal/day → kg/wk.
 *     This guarantees the Goal row and the Result row can never disagree,
 *     because both are now read off the same target/maintenance delta.
 *   - Pre-calibration (no maintenance yet) we can't read a budget, so we
 *     scale the nominal preset by the gain factor — the same factor the
 *     budget will apply once it's computed.
 *
 * Returns `null` (passed straight through) when the nominal pace is null,
 * so "Goal not set" still renders for users with no preset.
 */
function resolveEffectivePace(input: {
  goal: WhyThisNumberGoal;
  nominalPaceKgPerWeek: number | null;
  targetCalories: number;
  maintenanceTdee: number | null;
}): number | null {
  const { goal, nominalPaceKgPerWeek, targetCalories, maintenanceTdee } = input;
  if (nominalPaceKgPerWeek === null) return null;
  // Loss + maintain budgets run at full nominal pace — never scaled.
  if (goal !== "gain") return nominalPaceKgPerWeek;

  if (maintenanceTdee != null && maintenanceTdee > 0) {
    // Budget is the source of truth — derive the pace the surplus buys.
    const surplus = targetCalories - maintenanceTdee;
    return surplus / KCAL_PER_DAY_PER_WEEKLY_KG;
  }
  // No budget to read yet — scale the nominal preset by the gain factor.
  return nominalPaceKgPerWeek * GAIN_SURPLUS_PACE_FACTOR;
}

/**
 * Build the breakdown rows + summary sentence. Pure.
 */
export function buildWhyThisNumber(
  input: WhyThisNumberInput,
): WhyThisNumberResult {
  const { targetCalories, maintenanceTdee, confidence, goal, paceKgPerWeek } = input;
  const loggingDays = input.loggingDays ?? null;
  const mealLogDays = input.mealLogDays ?? null;
  const weightLogCount = input.weightLogCount ?? null;
  const hasWearable = input.hasWearable ?? false;

  const isEarlyEstimate =
    maintenanceTdee != null &&
    (confidence === "low" || (loggingDays != null && loggingDays < 14));

  // -- Row 1: TDEE / maintenance estimate --------------------------
  // The qualifier reflects the gated architecture (2026-06-10 decision):
  // we learn from *fully-logged* days, not "the last 7 calendar days".
  // When the caller supplies the count of complete days behind the
  // estimate (`loggingDays`), we name it — "learned from your N
  // fully-logged days" — so the user sees WHY learning may be slower
  // when some days are partial. Without a count we fall back to a clean
  // "learned from your logging" phrasing rather than asserting a window
  // we can't substantiate.
  const tdeeLabel = "Maintenance (TDEE)";
  let tdeeValue: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    if (isEarlyEstimate) {
      tdeeValue = `~${fmtKcal(maintenanceTdee)} (early estimate)`;
    } else if (loggingDays != null && loggingDays > 0) {
      tdeeValue = `${fmtKcal(maintenanceTdee)} (learned from your ${loggingDays} fully-logged days)`;
    } else {
      tdeeValue = `${fmtKcal(maintenanceTdee)} (learned from your logging)`;
    }
  } else {
    tdeeValue = "calibrating — keep logging";
  }

  // -- Row 2: Goal & pace ------------------------------------------
  // ENG-1025: for GAIN goals the budget delivers only HALF the nominal
  // surplus, so the Goal row must show the EFFECTIVE pace — otherwise it
  // reads "Gain 0.5 kg/wk" while the Result row shows a +275 surplus that
  // only buys ~0.25 kg/wk (the 2× mismatch the audit flagged). We derive
  // the effective pace straight from the budget when we have a maintenance
  // number (the budget is the source of truth); pre-calibration we scale
  // the nominal preset by the gain factor so the label still matches the
  // target the budget will land on. Loss / maintain are unscaled.
  const effectivePaceKgPerWeek = resolveEffectivePace({
    goal,
    nominalPaceKgPerWeek: paceKgPerWeek,
    targetCalories,
    maintenanceTdee,
  });
  const goalValue = goalLabel(goal, effectivePaceKgPerWeek);

  // -- Row 3: Result (the deficit / surplus we landed at) ----------
  // Prefer the actual delta (target - tdee) when we have a tdee.
  // Otherwise express the implied deficit from the user's pace
  // (kg/week → kcal/day) so the user still sees the math.
  let resultValue: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    const delta = targetCalories - maintenanceTdee;
    const absDelta = Math.abs(Math.round(delta));
    if (delta < 0) {
      resultValue = `−${absDelta.toLocaleString()} kcal/day deficit`;
    } else if (delta > 0) {
      resultValue = `+${absDelta.toLocaleString()} kcal/day surplus`;
    } else {
      resultValue = "no deficit (maintaining)";
    }
  } else if (effectivePaceKgPerWeek == null) {
    // No TDEE AND no pace preset — we genuinely can't compute a
    // direction. Don't lie about "maintaining".
    resultValue = "—";
  } else {
    // No TDEE yet → derive from the EFFECTIVE pace (ENG-1025: for gain
    // this is the halved-surplus pace, so the implied target line agrees
    // with the budget that will be computed once maintenance is known).
    const impliedDelta = effectivePaceKgPerWeek * KCAL_PER_DAY_PER_WEEKLY_KG;
    const abs = Math.abs(Math.round(impliedDelta));
    if (effectivePaceKgPerWeek < 0) resultValue = `−${abs.toLocaleString()} kcal/day deficit (target)`;
    else if (effectivePaceKgPerWeek > 0) resultValue = `+${abs.toLocaleString()} kcal/day surplus (target)`;
    else resultValue = "no deficit (maintaining)";
  }

  const lines: WhyThisNumberLine[] = [
    { key: "tdee", label: tdeeLabel, value: tdeeValue },
    { key: "goal", label: "Goal", value: goalValue },
    { key: "result", label: "Result", value: resultValue },
  ];

  // Specific calibrating ask (replaces generic "Early estimate"
  // qualifier whenever TDEE is null AND caller supplied counts).
  const calibratingAsk =
    maintenanceTdee == null || maintenanceTdee <= 0
      ? buildCalibratingAsk(mealLogDays, weightLogCount)
      : null;

  // Summary — one sentence that strings the same numbers together for
  // screen readers and the sheet subhead.
  let summary: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    const direction =
      targetCalories < maintenanceTdee
        ? "below"
        : targetCalories > maintenanceTdee
          ? "above"
          : "at";
    summary = `Your target sits ${direction} your estimated maintenance of ${fmtKcal(
      maintenanceTdee,
    )} so you trend toward your ${goalValue.toLowerCase()} goal.`;
  } else if (calibratingAsk) {
    // Lift the SPECIFIC ask into the summary so screen readers and
    // the bottom-sheet subhead announce something actionable instead
    // of generic "still calibrating" copy.
    summary = calibratingAsk;
  } else {
    summary =
      "We're still calibrating your maintenance — your target is based on your stated goal and weekly pace.";
  }

  const storyBeats = buildStoryBeats({
    maintenanceTdee,
    loggingDays,
    hasWearable,
  });

  return {
    targetHeadline: `Today's target: ${fmtKcal(targetCalories)}`,
    lines,
    storyBeats,
    summary,
    isEarlyEstimate: Boolean(isEarlyEstimate),
    calibratingAsk,
  };
}
