/**
 * Weekly-recap broken-streak "grace" rewrite (ENG-1454, staged failure
 * moments). Behind `coaching_stages_v1` — host checks the flag, this module
 * stays pure (no analytics import).
 *
 * Fixes the 2026-07-06 Fable-day judgment: the pre-existing recap led with
 * the rule ("Counts every day with at least one meal logged.") at the exact
 * moment a user feels robbed by a broken streak, never mentioned the
 * streak-freeze mechanic that actually protected them, and framed 0-of-7
 * protein-goal days with no next step.
 *
 * Everything here is pure derivation — the weekly-recap screen (pinned at
 * its current line count) calls these and renders the strings; no JSX,
 * no React, no Date.now() side effects beyond the caller-supplied inputs.
 */

/**
 * Achievement-led streak headline — replaces "N days in a row" with the
 * ratified "{n} of 7 days — a strong week." framing. Only used for the
 * 7-day recap window; `daysLogged` is days-with-food in THIS week
 * (0–7), distinct from `streakLength` (the running cross-week streak).
 */
export function brokenStreakHeadline(daysLoggedThisWeek: number): string {
  return `${daysLoggedThisWeek} of 7 days — a strong week.`;
}

/**
 * One-clause reset line naming the day the streak broke. `brokenDayLabel`
 * is the short day name (e.g. "Saturday") — callers pass the full weekday
 * name, not the 3-letter `WeekDayTotals.label` abbreviation (the contract
 * string reads "Saturday", not "Sat").
 */
export function streakResetLine(brokenDayLabel: string): string {
  return `Your streak reset on ${brokenDayLabel}. One missed day doesn't undo the habit — start the next run today.`;
}

/**
 * The streak-freeze mechanic line, surfaced AT the break moment (per the
 * contract — this used to be omitted entirely). Two branches:
 *   - a freeze covered the broken day (protectedDateKeys included it) →
 *     name the day + the run it preserved.
 *   - no freeze covered it (either none available, or the break predates
 *     the freeze system catching it) → the earn-path invitation.
 */
export function streakFreezeMechanicLine(args: {
  freezeCoveredBreak: boolean;
  brokenDayLabel: string;
  continuingStreakLength: number;
}): string {
  const { freezeCoveredBreak, brokenDayLabel, continuingStreakLength } = args;
  if (freezeCoveredBreak) {
    return `A streak freeze covered ${brokenDayLabel} — your ${continuingStreakLength}-day run continues.`;
  }
  return `Log 7 days in a row to earn a streak freeze — it covers days like ${brokenDayLabel}.`;
}

/**
 * Determine which day (if any) broke the streak inside a 7-day recap
 * window, and whether a freeze covered it. `days` is `weekStats.days`
 * ordered oldest→newest (`WeekDayTotals`-shaped — only `.key`/`.label`/
 * `.calories` are read). `protectedDateKeys` comes straight from
 * `computeProtectedStreak()`.
 *
 * Returns `null` when every day in the window has food logged (no break
 * to explain this week) — callers should fall back to the plain
 * achievement headline with no reset/freeze lines.
 */
export function findBrokenStreakDay(
  days: ReadonlyArray<{ key: string; label: string; calories: number }>,
  protectedDateKeys: ReadonlySet<string> | readonly string[],
): { key: string; label: string; freezeCovered: boolean } | null {
  const protectedSet =
    protectedDateKeys instanceof Set ? protectedDateKeys : new Set(protectedDateKeys);
  // Most-recent-first so a week with multiple zero-days names the latest
  // break (the one the user is most likely thinking about right now).
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.calories > 0) continue;
    return { key: d.key, label: d.label, freezeCovered: protectedSet.has(d.key) };
  }
  return null;
}

/** Full weekday name for the recap's reset/freeze lines (contract reads
 *  "Saturday", not the 3-letter grid label "Sat"). `dayKey` is the
 *  `YYYY-MM-DD` date key; parsed locally (no timezone conversion — the
 *  key already represents the user's local day). */
export function fullWeekdayNameForDateKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dayKey;
  const date = new Date(y, m - 1, d);
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[date.getDay()] ?? dayKey;
}

/**
 * Protein digest-line reframe — wires the digest cascade's existing
 * "easiest fix" line format into the recap's protein row, replacing the
 * bare "Hit your {goal}g goal on {n} of 7 days" with an actionable line.
 * Mirrors `tryProteinNudge`'s body format in `weeklyDigestSuggestion.ts`
 * (kept as a separate, smaller function here rather than importing that
 * rule directly — the digest rule has its own suppression/cooldown gates
 * that don't apply to a recap row that's already decided to render).
 */
export function proteinDigestLine(avgProteinG: number, targetProteinG: number): string {
  return `Protein averaged ${Math.round(avgProteinG)}g against ${Math.round(targetProteinG)}g. A high-protein breakfast is the easiest fix.`;
}

/** Everything the weekly-recap screen needs for the staged broken-streak
 *  grace rewrite, bundled into one call so the screen (pinned at its
 *  current line count) only needs a single `useMemo` call site. `null`
 *  fields mean "render the pre-ENG-1454 copy for this piece" — the screen
 *  falls back per-field rather than all-or-nothing, so (e.g.) a flag-off
 *  host or a perfect 7-of-7 week still gets the achievement headline
 *  treatment where it applies without needing a broken day to exist. */
export interface StagedRecapCopy {
  /** `null` when `flagOn` is false — screen renders its legacy headline. */
  headline: string | null;
  /** `null` when there's no broken day this week (nothing to explain) or
   *  the flag is off. */
  resetLine: string | null;
  /** `null` under the same conditions as `resetLine`. */
  freezeLine: string | null;
  /** `null` when the flag is off — screen renders the legacy protein line. */
  proteinLine: string | null;
}

export function buildStagedRecapCopy(args: {
  flagOn: boolean;
  daysLoggedThisWeek: number;
  days: ReadonlyArray<{ key: string; label: string; calories: number }>;
  protectedDateKeys: ReadonlyArray<string>;
  continuingStreakLength: number;
  avgProteinG: number;
  targetProteinG: number;
}): StagedRecapCopy {
  if (!args.flagOn) {
    return { headline: null, resetLine: null, freezeLine: null, proteinLine: null };
  }
  const broken = findBrokenStreakDay(args.days, args.protectedDateKeys);
  const proteinLine =
    args.avgProteinG > 0 && args.targetProteinG > 0
      ? proteinDigestLine(args.avgProteinG, args.targetProteinG)
      : null;
  if (!broken) {
    return {
      headline: brokenStreakHeadline(args.daysLoggedThisWeek),
      resetLine: null,
      freezeLine: null,
      proteinLine,
    };
  }
  const fullDayName = fullWeekdayNameForDateKey(broken.key);
  return {
    headline: brokenStreakHeadline(args.daysLoggedThisWeek),
    resetLine: streakResetLine(fullDayName),
    freezeLine: streakFreezeMechanicLine({
      freezeCoveredBreak: broken.freezeCovered,
      brokenDayLabel: fullDayName,
      continuingStreakLength: args.continuingStreakLength,
    }),
    proteinLine,
  };
}
