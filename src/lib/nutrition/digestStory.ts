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
  } = input;

  const safeDaysLogged = Number.isFinite(daysLogged) && daysLogged > 0
    ? Math.floor(daysLogged)
    : 0;

  const rangeLine = `This week (${weekLabel}).`;
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

  const paragraph = [rangeLine, daysLine, caloriesLine, proteinLine, closestLine]
    .filter((s): s is string => Boolean(s))
    .join(" ");

  return {
    rangeLine,
    daysLine,
    caloriesLine,
    proteinLine,
    closestLine,
    paragraph,
  };
}
