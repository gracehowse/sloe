/**
 * digestStory — pure builder for the always-visible "Week digest"
 * narrative block on Progress.
 *
 * Authority: D-2026-04-27-17 (Progress is a weekly story, not a
 * stat-card dashboard) + customer-lens audit 2026-04-30 (the 2x2 stat
 * grid still anchors visually after the Phase 4 refactor — demote, do
 * not delete).
 *
 * The narrative is the LEAD card on Progress. It reads as a story —
 * "this week you hit protein 4/7 days, calories ran 180 over, your
 * closest day was Tuesday" — calm, factual, no emoji, no motivational
 * tone. Numbers are the truth; copy is the wrapper.
 *
 * Distinct from:
 *   - `<ProgressHeadline>` (engine-led adaptive-TDEE recap line) —
 *     adaptive TDEE story, requires confidence ≥ medium.
 *   - `<Digest>` (the Sunday-evening recap card with share + dismiss)
 *     — only renders Sat 18:00 → Tue, dismissible per week.
 *
 * `<DigestStoryCard>` renders any time the user has any logged days
 * in the rolling window. Empty state ("Quiet week — log a meal to
 * start") is rendered by the consumer, not this builder.
 *
 * Voice rules (production design spec §1.7):
 *   - UK English: "behaviour", "personalise", "fibre", "kilocalories".
 *   - Second-person.
 *   - No exclamation marks. No "amazing!" / "you crushed it!". No emoji.
 *   - Restraint — no marketing tone.
 *
 * Pure module — no React, no I/O, no Date access.
 */

/** Inputs the host page already computes via `buildWeeklyRecap`. */
export interface DigestStoryInput {
  /** Human label like "Apr 6 – Apr 12". */
  weekLabel: string;
  /** Days with ≥1 logged meal in the 7-day window. */
  daysLogged: number;
  /** Average daily kcal across days-with-food (not over all 7). */
  avgCalories: number;
  /** Daily kcal target. 0 / undefined → calorie sentence is suppressed. */
  targetCalories: number;
  /** Average daily protein in g across days-with-food. */
  avgProtein: number;
  /** Daily protein target in g. 0 / undefined → protein sentence is suppressed. */
  targetProtein: number;
  /** Days where protein hit target. From `buildWeekStats.proteinOnTarget`. */
  proteinOnTargetDays: number;
  /** Closest-to-target day from `selectClosestToTargetDay` (already used
   *  in `buildWeeklyRecap`). `null` when no day qualified. */
  closestToTarget: {
    label: string;
    calories: number;
    protein: number;
  } | null;
  /**
   * Day-of-week pattern (audit 2026-04-30, Lose It "Closer" parity).
   * Computed from the rolling 4-week window via
   * `computeDayOfWeekPattern`. The host suppresses the field when it
   * has < 14 days of data or the high/low gap is < 200 kcal — when
   * the field is present we render a calm, observational line
   * ("You eat about 250 more kcal on Saturdays than Tuesdays."). No
   * emoji. No motivational tone.
   */
  dayOfWeekPattern?: {
    /** Highest-average weekday label, e.g. "Saturday". */
    highDay: string;
    /** Lowest-average weekday label, e.g. "Tuesday". */
    lowDay: string;
    /** Positive integer kcal delta (high - low), pre-rounded. */
    deltaKcal: number;
  } | null;
}

/** Resolved sentence list — host renders each as its own paragraph
 *  line so accessibility readers pause between facts. */
export interface DigestStoryResult {
  /** Always present — the week-range scope sentence. */
  rangeLine: string;
  /** Always present — the days-logged sentence. */
  daysLine: string;
  /** Calorie story. `null` when no calorie target is set. */
  caloriesLine: string | null;
  /** Protein story. `null` when no protein target is set. */
  proteinLine: string | null;
  /** Closest-to-target day. `null` when no day qualified. */
  closestLine: string | null;
  /** Day-of-week pattern observation. `null` when the host did not
   *  supply a pattern (insufficient data or sub-threshold delta). */
  dayOfWeekPatternLine: string | null;
  /** Concatenated paragraph string for ScreenReader / share fallback. */
  paragraph: string;
}

/**
 * Build the digest story sentences from the week's recap data.
 *
 * Each sentence is suppressed when it would be a lie:
 *   - calorie sentence requires both `targetCalories > 0` and
 *     `daysLogged > 0`.
 *   - protein sentence requires `targetProtein > 0` and
 *     `daysLogged > 0`.
 *   - closest sentence requires `closestToTarget != null`.
 *
 * Numbers are pre-rounded by the host (`buildWeeklyRecap` already
 * rounds avgs); we render them with `toLocaleString()` for digit
 * separators.
 */
export function buildDigestStory(input: DigestStoryInput): DigestStoryResult {
  const {
    weekLabel,
    daysLogged,
    avgCalories,
    targetCalories,
    avgProtein,
    targetProtein,
    proteinOnTargetDays,
    closestToTarget,
    dayOfWeekPattern,
  } = input;

  const safeDaysLogged = Number.isFinite(daysLogged) && daysLogged > 0
    ? Math.floor(daysLogged)
    : 0;

  // 2026-05-12 (premium-bar audit DC12 polish — past-tense voice rule):
  // The Digest is a recap of the *previous* week, but the eyebrow used
  // to read "This week (May 5–11)" in present tense even when shown on
  // Sunday/Monday looking back. Linear / Headspace / MacroFactor all
  // anchor recap eyebrows in past tense so the user reads the surface
  // as "here's what happened" rather than "you're mid-stream and falling
  // behind." Reframed to "Last week".
  const rangeLine = `Last week (${weekLabel}).`;
  const daysLine = `${safeDaysLogged} of 7 days logged.`;

  let caloriesLine: string | null = null;
  if (
    safeDaysLogged > 0 &&
    Number.isFinite(targetCalories) &&
    targetCalories > 0 &&
    Number.isFinite(avgCalories)
  ) {
    const avg = Math.round(avgCalories);
    const tgt = Math.round(targetCalories);
    const diff = avg - tgt;
    const absDiff = Math.abs(diff);
    if (absDiff < 25) {
      caloriesLine = `You averaged ${avg.toLocaleString()} kcal vs ${tgt.toLocaleString()} target — within range.`;
    } else if (diff > 0) {
      caloriesLine = `You averaged ${avg.toLocaleString()} kcal vs ${tgt.toLocaleString()} target — ${absDiff.toLocaleString()} over.`;
    } else {
      caloriesLine = `You averaged ${avg.toLocaleString()} kcal vs ${tgt.toLocaleString()} target — ${absDiff.toLocaleString()} under.`;
    }
  }

  let proteinLine: string | null = null;
  if (
    safeDaysLogged > 0 &&
    Number.isFinite(targetProtein) &&
    targetProtein > 0 &&
    Number.isFinite(proteinOnTargetDays)
  ) {
    const onTarget = Math.max(
      0,
      Math.min(safeDaysLogged, Math.floor(proteinOnTargetDays)),
    );
    proteinLine = `Hit your protein target on ${onTarget} of ${safeDaysLogged} day${safeDaysLogged === 1 ? "" : "s"} logged.`;
    // Quiet annotation: when avgProtein is well below target across the
    // whole window, append the average so the user can see the gap
    // without scanning the demoted tiles. Tone: factual, no scolding.
    if (
      Number.isFinite(avgProtein) &&
      avgProtein > 0 &&
      avgProtein < targetProtein * 0.8
    ) {
      proteinLine += ` Average ${Math.round(avgProtein)}g vs ${Math.round(targetProtein)}g target.`;
    }
  }

  let closestLine: string | null = null;
  if (closestToTarget) {
    closestLine = `${closestToTarget.label} was your closest day (${Math.round(closestToTarget.calories).toLocaleString()} kcal vs ${Math.round(targetCalories).toLocaleString()} target).`;
  }

  // Audit 2026-04-30 — day-of-week pattern (Lose It parity). The host
  // is responsible for the threshold + min-data-window gates; we only
  // render the sentence when a non-null shape was passed in. Tone is
  // observational: factual past-tense framing, plural weekday form
  // ("Saturdays" / "Tuesdays") since we're describing a pattern not a
  // single day. No emoji.
  let dayOfWeekPatternLine: string | null = null;
  if (
    dayOfWeekPattern &&
    dayOfWeekPattern.highDay &&
    dayOfWeekPattern.lowDay &&
    Number.isFinite(dayOfWeekPattern.deltaKcal) &&
    dayOfWeekPattern.deltaKcal > 0
  ) {
    const delta = Math.round(dayOfWeekPattern.deltaKcal);
    // 2026-05-12 (premium-bar DC12 voice audit): "You eat" → "You
    // averaged". Habitual present read like a stereotype; past tense
    // ties the line to the 4-week observed window the engine actually
    // computed it from. Same calm-factual register as the rest of
    // the digest paragraph.
    //
    // ENG-1373 (Fable critique 4b) — the sentence used to read "...
    // than Tuesdays." with no window attribution, which silently
    // implied the claim was about the single displayed week (whose
    // own `weekLabel` anchors every other sentence in this paragraph).
    // `dayOfWeekPattern` is actually computed by `computeDayOfWeekPattern`
    // over a rolling `DAY_OF_WEEK_PATTERN_WINDOW_DAYS` (28-day / 4-week)
    // sample — the displayed week's own Friday could individually run
    // lower than its Thursday while this line still (correctly) reports
    // the 4-week mean the other way. Naming the window makes the claim
    // auditable instead of reading as a claim about the single week.
    // Mirrors `patternWindowLabel` ("last 4 weeks") built alongside
    // `dayOfWeekPattern` in `weeklyRecap.ts#buildDigestWeekView` — kept
    // as a literal here (not imported) because this module is
    // intentionally dependency-free (see file header) and the window
    // length is a stable, already-hard-coded product constant.
    dayOfWeekPatternLine = `Over the last 4 weeks, you averaged about ${delta.toLocaleString()} more kcal on ${pluraliseWeekday(dayOfWeekPattern.highDay)} than ${pluraliseWeekday(dayOfWeekPattern.lowDay)}.`;
  }

  const paragraph = [
    rangeLine,
    daysLine,
    caloriesLine,
    proteinLine,
    closestLine,
    dayOfWeekPatternLine,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ");

  return {
    rangeLine,
    daysLine,
    caloriesLine,
    proteinLine,
    closestLine,
    dayOfWeekPatternLine,
    paragraph,
  };
}

/** Pluralise a weekday label for the day-of-week pattern sentence
 *  ("Tuesday" → "Tuesdays"). Handles the "y → ies" exception. Used
 *  only by the digest narrative; intentionally tiny + dependency-free. */
function pluraliseWeekday(label: string): string {
  if (!label) return label;
  // Already plural — pass through unchanged.
  if (label.endsWith("s")) return label;
  // "Tuesday" / "Wednesday" / etc. all end with "y" preceded by a
  // consonant in English; collapse to "ies" so we don't print
  // "Saturdaysy" or "Tuesdays" inconsistently. Other forms (any
  // future locale shift) just append "s".
  if (label.endsWith("y") && label.length > 1) {
    const prev = label.charAt(label.length - 2).toLowerCase();
    const isVowel = prev === "a" || prev === "e" || prev === "i" || prev === "o" || prev === "u";
    if (!isVowel) {
      // English convention: weekday "Tuesday" → "Tuesdays" (NOT
      // "Tuesdaies") — proper-noun exception. Keep the "y" + add "s".
      return `${label}s`;
    }
  }
  return `${label}s`;
}
