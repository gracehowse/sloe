/**
 * Staged over/under-budget coaching copy (ENG-1454).
 *
 * SSOT for the Today "coach line" strings + the stage-selection thresholds
 * behind them. Authority: the ENG-1454 "Implementable copy contract" (Fable,
 * 2026-07-06, ratified by Grace) — a Fable-day judgment call that the
 * pre-existing state-blind line ("You've hit your calories for today — eat
 * freely, or save for tomorrow.") reads as parody at +1,450 kcal and implies
 * a banking mechanic the surface never explains.
 *
 * Register (load-bearing — do not add exclamation points, praise data
 * doesn't earn, or a banking/permission mechanic the UI can't back up):
 *   - Calm, factual, never alarmed.
 *   - "Nothing to fix tonight" / "tomorrow starts fresh" — permission, not
 *     restriction.
 *   - Never numbers-as-accusation (no second-person "you ate too much").
 *
 * Visual treatment is UNCHANGED across every stage — amber stays flat across
 * magnitudes per the ratified redesign decision (2026-07-01, ENG-1296); only
 * the copy carries the difference between "just landed on target" and "a
 * genuinely big day".
 *
 * Gated behind `coaching_stages_v1` (default-OFF until Grace validates in
 * sim/web — see `KNOWN_DEFAULT_OFF_FLAGS`, `empty_state_grammar_v1` is the
 * model). Flag-OFF hosts keep rendering the legacy state-blind line via
 * their existing literal — this module is only consulted when the flag
 * resolves ON.
 *
 * Pure module — no React, no Date.now() side effects beyond an optional
 * `now` for the under-eating "by 8pm local" gate.
 */

/** Which of the four over-budget bands the user's today sits in. */
export type OverBudgetStage = "approaching" | "landed" | "over" | "big";

/**
 * Select the over-budget stage from % of the daily calorie goal eaten.
 * Boundaries per the ratified contract:
 *   - [85, 100)  → "approaching"
 *   - [100, 110) → "landed"
 *   - [110, 140) → "over"
 *   - [140, ∞)   → "big"
 * Below 85% there is no over-budget stage — callers should not invoke this
 * (the existing under-85% Today coach copy is unaffected by ENG-1454, apart
 * from the new under-eating states below).
 */
export function overBudgetStageForPercent(pctOfGoal: number): OverBudgetStage {
  if (pctOfGoal < 100) return "approaching";
  if (pctOfGoal < 110) return "landed";
  if (pctOfGoal < 140) return "over";
  return "big";
}

/** `consumedCalories / goalCalories * 100`. `0` when the goal is unset or
 *  non-positive (avoids a `NaN`/`Infinity` stage lookup). */
export function pctOfCalorieGoal(consumedCalories: number, goalCalories: number): number {
  if (!Number.isFinite(goalCalories) || goalCalories <= 0) return 0;
  if (!Number.isFinite(consumedCalories) || consumedCalories < 0) return 0;
  return (consumedCalories / goalCalories) * 100;
}

/**
 * Full stage derivation from raw eaten/goal calories. Returns `null` when
 * under the 85% "approaching" floor — callers fall through to their
 * existing under-budget copy (or the new under-eating states below).
 */
export function overBudgetStage(
  consumedCalories: number,
  goalCalories: number,
): OverBudgetStage | null {
  const pct = pctOfCalorieGoal(consumedCalories, goalCalories);
  if (pct < 85) return null;
  return overBudgetStageForPercent(pct);
}

/**
 * Staged Today coach line. `n` is the contract's variable — "kcal left" for
 * `approaching`, "kcal over" for `over`/`big`. Rounds to the nearest whole
 * kcal (the ring + every other Today surface already rounds display kcal).
 *
 * Verbatim strings — do not paraphrase; `tests/unit/coachOverBudgetStage.test.ts`
 * pins these exactly.
 */
export function overBudgetCoachLine(
  stage: OverBudgetStage,
  consumedCalories: number,
  goalCalories: number,
): string {
  const remaining = Math.max(0, Math.round(goalCalories - consumedCalories));
  const over = Math.max(0, Math.round(consumedCalories - goalCalories));
  switch (stage) {
    case "approaching":
      return `About ${remaining} kcal left — a light dinner fits.`;
    case "landed":
      return "You've hit today's calories. One day at the line is exactly how this is meant to work.";
    case "over":
      return `Over by ${over} today. Nothing to fix tonight — tomorrow starts fresh.`;
    case "big":
      return "A big day. It happens — log it honestly and move on. Tomorrow's a clean slate.";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

/** The retired state-blind over-budget caption — kept as a named export so
 *  every call site (and both `NorthStarBlock` components) resolves the
 *  exact same fallback string instead of re-typing the literal. */
export const LEGACY_OVER_BUDGET_CAPTION =
  "You've hit your calories for today — eat freely, or save for tomorrow.";

/**
 * One-call resolver for the `NorthStarBlock` over-budget caption — used by
 * both platforms' components so the flag/stage/calories gate lives in one
 * place instead of being re-typed at each call site. Returns the staged
 * line when `flagOn` is true AND both `stage` and `calories` are supplied;
 * otherwise the exact legacy caption (kill switch).
 */
export function resolveOverBudgetCaption(
  flagOn: boolean,
  stage: OverBudgetStage | undefined,
  calories: { consumed: number; goal: number } | undefined,
): string {
  if (flagOn && stage && calories) {
    return overBudgetCoachLine(stage, calories.consumed, calories.goal);
  }
  return LEGACY_OVER_BUDGET_CAPTION;
}

/**
 * Neutral, auditable net-energy framing for the "while over" state —
 * replaces the second-person accusation ("You've eaten {n} more than
 * you've burned today") with a plain arithmetic statement. The operands
 * (burned / eaten) render beneath via the existing stat-tile row
 * (`TodayActivityBonusCard` "Burned"/"Eaten" tiles) — this string carries
 * only the net headline sentence, never restates the operands itself.
 */
export function netEnergyOverBudgetLine(netOverKcal: number): string {
  const n = Math.max(0, Math.round(netOverKcal));
  return `Net energy today: +${n} kcal`;
}

/** Which of the two under-eating states applies, if any. `null` = neither
 *  gate is met — callers fall through to the existing calm "kcal left"
 *  copy. Only one state can be active at a time; `consecutiveDays` gate
 *  takes priority over the single-day gate (it's the more actionable
 *  concern — a lone under-eating day is not evidence of a pattern.) */
export type UnderEatingState = "single-day" | "consecutive-days";

/**
 * Gate for the single-day under-eating nudge: `<60%` of goal by ~8pm
 * local. Callers pass the LOCAL hour (0–23) — the "8pm local" contract
 * language means local, not UTC; the derivation layer stays pure by
 * accepting the already-resolved local hour rather than doing timezone
 * math itself.
 */
export function isSingleDayUnderEating(
  consumedCalories: number,
  goalCalories: number,
  localHour: number,
): boolean {
  if (localHour < 20) return false;
  return pctOfCalorieGoal(consumedCalories, goalCalories) < 60;
}

/**
 * Gate for the consecutive-days under-eating nudge: 3+ consecutive days
 * each `<75%` of goal. `dailyPercents` is the trailing window ordered
 * oldest→newest (or any order — only a run of `<75%` matters, most
 * callers pass the last 3-7 days). Returns the true run length so the
 * digest line can say "{n} days" honestly (3, 4, 5…), not always "3".
 */
export function consecutiveDaysUnderEating(dailyPercents: readonly number[]): number {
  let run = 0;
  let best = 0;
  for (const pct of dailyPercents) {
    if (pct < 75) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * ED-safe under-eating copy. Never praises under-eating, never alarms —
 * neutral, food-forward, floor-aware. Flagged in the ENG-1449/1454 report
 * for diversity-inclusion + nutrition-engine lens review before the
 * `coaching_stages_v1` flag ramps past an internal glance (body-neutral
 * framing is load-bearing here — see the PR body).
 */
export function underEatingCoachLine(
  state: UnderEatingState,
  consecutiveDays?: number,
): string {
  if (state === "single-day") {
    return "Well under target so far. If that wasn't the plan, a proper dinner still fits tonight.";
  }
  const n = consecutiveDays ?? 3;
  return `You've run well under target for ${n} days. Consistent fuel is what keeps the plan working — worth raising tonight's dinner.`;
}
