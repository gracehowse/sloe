/**
 * Digest primitive (D3) — shared helpers.
 *
 * Pure module backing the web + mobile `<Digest />` primitive. Owns the
 * single source of truth for the headline string so both platforms
 * produce identical copy from identical inputs.
 *
 * See `docs/design/digest-primitive.md` §5 for the headline rules.
 */

export type DigestHeadlineInput = {
  weightDeltaKg: number | null;
  closestToTargetLabel: string | null;
  streakDays: number;
  daysLogged: number;
};

/**
 * ENG-740 — extra data the blended Week-Digest card consumes that the
 * legacy two-card layout did not surface as a single struct. Shared
 * across web + mobile so the merged card cannot drift.
 *
 * Every field is optional / nullable: the card gracefully omits the
 * element it backs when the host can't supply a real value. We never
 * invent a number to fill the hero track or pattern bars.
 */
export type DigestBlendedExtras = {
  /**
   * Day-of-week pattern from `computeDayOfWeekPattern` — drives the
   * PATTERN row's two-bar comparison + delta. `null` → suppress the
   * whole PATTERN row (insufficient data or sub-threshold delta).
   * The host should additionally suppress it under ~4 logged days.
   */
  dayOfWeekPattern: {
    highDay: string;
    lowDay: string;
    deltaKcal: number;
    highDayAvg: number;
    lowDayAvg: number;
  } | null;
  /**
   * Per-day calorie target active on the closest-to-target day (from
   * `recap.bestDay.targetCalories`). Drives the hero track denominator.
   * `0` / `null` → render the hero day + calories without the track.
   */
  closestDayTargetCalories: number | null;
  /**
   * ENG-1373 (finding 4b) — human-readable label for the rolling window
   * `dayOfWeekPattern` is actually sampled over (`recap.patternWindowLabel`,
   * currently `"last 4 weeks"`). The PATTERN row compares a 4-week mean per
   * weekday, NOT the single displayed week, so the copy must attribute the
   * claim to this window instead of implying "this week" — an unauditable
   * claim (the displayed week's actual high/low day can differ from the
   * 4-week pattern). Optional + defaults to `null` (falls back to the old
   * "this week" wording) so hosts that haven't threaded it through yet
   * (e.g. mobile, pending its own ENG-1373 pass) keep compiling unchanged.
   */
  patternWindowLabel?: string | null;
};

/** Calorie-ring 3-state classifier for the blended hero dot + number.
 *  Mirrors `feedback_calorie_ring_colour_mapping.md`:
 *    under target → success green, over → destructive red,
 *    within ±4% (min ±40 kcal) of target → neutral.
 *  Returns "neutral" when no target is set (track is suppressed then,
 *  but the classifier stays total). */
export function classifyDigestHeroTone(
  dayCalories: number,
  targetCalories: number,
): "under" | "over" | "neutral" {
  if (!(targetCalories > 0) || !Number.isFinite(dayCalories)) return "neutral";
  const diff = dayCalories - targetCalories;
  const tolerance = Math.max(40, targetCalories * 0.04);
  if (Math.abs(diff) <= tolerance) return "neutral";
  return diff > 0 ? "over" : "under";
}

/** Clamp the hero-track dot position to [0,1] given day vs target.
 *  `0` target → returns 0 (caller suppresses the track anyway). */
export function digestHeroTrackFraction(
  dayCalories: number,
  targetCalories: number,
): number {
  if (!(targetCalories > 0) || !Number.isFinite(dayCalories)) return 0;
  const frac = dayCalories / targetCalories;
  if (!Number.isFinite(frac)) return 0;
  return Math.min(1, Math.max(0, frac));
}

/**
 * Resolve the single headline string per §5.
 *
 * Rules (first match wins):
 *   1. `daysLogged === 0` → "Quiet week."
 *   2. |weightDeltaKg| ≥ 0.3 → "Last week: down/up X.X kg." (past-tense per project voice rule)
 *   3. closestToTargetLabel present → "Closest to target: <day>."
 *   4. streakDays ≥ 7 → "Streak held — X days."
 *   5. fallback → "Last week, at a glance."
 *
 * 2026-05-13 (premium-bar audit DC12 polish — past-tense voice rule):
 * the fallback "Your week, at a glance." now reads "Last week, at a
 * glance." to match the other recap-eyebrow surfaces (Digest range
 * line, weight-delta headline). The recap renders Sun/Mon looking
 * back — past tense reads as a closed retrospective, not a mid-stream
 * nudge.
 */
export function resolveDigestHeadline(input: DigestHeadlineInput): string {
  if (input.daysLogged === 0) return "Quiet week.";
  if (input.weightDeltaKg != null && Math.abs(input.weightDeltaKg) >= 0.3) {
    const direction = input.weightDeltaKg < 0 ? "down" : "up";
    const magnitude = Math.abs(input.weightDeltaKg).toFixed(1);
    return `Last week: ${direction} ${magnitude} kg.`;
  }
  if (input.closestToTargetLabel) {
    return `Closest to target: ${input.closestToTargetLabel}.`;
  }
  if (input.streakDays >= 7) {
    return `Streak held — ${input.streakDays} days.`;
  }
  return "Last week, at a glance.";
}
