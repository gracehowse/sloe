/**
 * Recipe timer parser (Batch 3.8).
 *
 * Finds cook-time mentions inside a step of instructions ("bake for 25
 * minutes", "simmer 1 hour 20 minutes", "rest 30 seconds") and returns
 * the matched text + duration in seconds + byte range. The cook-mode
 * UI (both web `CookMode.tsx` and mobile `cook.tsx`) wraps each match
 * in a tappable button.
 *
 * Design constraints:
 *   - Pure — no DOM, no React, no Supabase. Safe to import from both
 *     the Next.js app and the Expo mobile app.
 *   - English only for now; regional / non-English step text falls
 *     through without matches (documented limitation — see roadmap).
 *   - Ranges ("5-10 minutes" / "5–10 minutes") use the upper bound so
 *     the timer is "definitely finished" when it fires, which is what
 *     home cooks expect. `isRange` flag exposed so the UI can display
 *     a hint.
 *   - Non-match-looking cases — "the 10-minute mark", "20-minute meal"
 *     — are rejected via a word-boundary check on "-minute" suffixes.
 *   - Matches are non-overlapping and left-to-right.
 *
 * Supported phrases (case-insensitive):
 *   - "10 seconds" / "10 secs" / "10 s"
 *   - "10 minutes" / "10 mins" / "10 min" / "10 m"
 *   - "1 hour" / "1 hr" / "2 hours" / "2 hrs"
 *   - "1 hour 20 minutes" / "1 hr 20 mins"
 *   - Ranges with hyphen / en dash: "5-10 minutes", "5–10 minutes"
 *
 * Unsupported (documented for future extension):
 *   - Fractional: "half an hour", "1.5 hours", "2 and a half hours"
 *   - Word numbers: "five minutes"
 *   - Non-English equivalents
 */

export type ParsedTimer = {
  /** The exact substring that matched — used for replacement / highlighting. */
  label: string;
  /** Duration in seconds. Range matches use the upper bound. */
  totalSeconds: number;
  /** Whether this match was a "N–M unit" range. */
  isRange: boolean;
  /** Inclusive start index (0-based, character offset) in the original step. */
  startIndex: number;
  /** Exclusive end index (character offset) in the original step. */
  endIndex: number;
};

/**
 * Hours / minutes / seconds multipliers. Structured rather than hard-
 * coded numbers so the scaling stays honest to what the regex captured.
 */
const UNIT_SECONDS = {
  hour: 3600,
  minute: 60,
  second: 1,
} as const;

type UnitKey = keyof typeof UNIT_SECONDS;

/**
 * Regex fragments for each unit. The alternations are ordered
 * longest-first so "minutes" matches before "min".
 */
const UNIT_PATTERNS: Record<UnitKey, string> = {
  hour: "(?:hours?|hrs?|hr)",
  minute: "(?:minutes?|mins?|min)",
  second: "(?:seconds?|secs?|sec)",
};

/**
 * Combined timer pattern. Captures:
 *   1. Optional range lower bound
 *   2. Primary numeric value
 *   3. Unit token (hour / minute / second)
 *   4. Optional secondary value (for "1 hour 20 minutes")
 *   5. Optional secondary unit
 *
 * The negative lookahead `(?![a-z-])` after the unit prevents
 * "10-minute" (adjective form, e.g. "the 10-minute mark") from being
 * treated as a duration — that is an adjective describing *a* thing,
 * not a duration to time.
 */
function buildTimerRegex(): RegExp {
  const anyUnit = `(?:${UNIT_PATTERNS.hour}|${UNIT_PATTERNS.minute}|${UNIT_PATTERNS.second})`;
  // (lower[-/en-dash])?  value  [space]  unit  (negative boundary)
  //   [space? value [space] unit (negative boundary)]?
  const pattern =
    `(?<=^|[^\\w-])` + // left boundary: start-of-string OR non-word-non-hyphen — blocks "10-minute" on the inside
    `(?:(\\d+)\\s*[-–]\\s*)?` + // optional range lower bound
    `(\\d+)\\s*(${anyUnit})` +
    `(?![a-z-])` + // block "10-minute" (adjective) — next char must not be a letter or hyphen
    `(?:` +
      `\\s+(\\d+)\\s*(${anyUnit})` + // optional secondary term (e.g. "1 hour 20 minutes")
      `(?![a-z-])` +
    `)?`;
  return new RegExp(pattern, "gi");
}

/** Map a unit token (however abbreviated) back to its canonical key. */
function unitKey(token: string): UnitKey {
  const t = token.toLowerCase();
  if (t.startsWith("h")) return "hour";
  if (t.startsWith("m")) return "minute";
  return "second";
}

/**
 * Format a number of seconds as "M:SS" when under an hour, or
 * "H:MM:SS" when an hour or more. Matches the countdown UI in both
 * platforms.
 *
 *   formatTimer(0)    -> "0:00"
 *   formatTimer(60)   -> "1:00"
 *   formatTimer(3600) -> "1:00:00"
 *   formatTimer(4260) -> "1:11:00"
 */
export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Scan a single instruction step and return every timer-like phrase,
 * in order of appearance, with non-overlapping spans.
 *
 * Empty / non-string input yields [].
 */
export function parseTimersInStep(step: string): ParsedTimer[] {
  if (typeof step !== "string" || step.length === 0) return [];
  const re = buildTimerRegex();
  const out: ParsedTimer[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(step)) !== null) {
    const whole = match[0];
    const lower = match[1]; // optional range lower bound
    const primary = match[2];
    const primaryUnit = match[3];
    const secondary = match[4];
    const secondaryUnit = match[5];

    if (!primary || !primaryUnit) continue;

    const primaryN = parseInt(primary, 10);
    if (!Number.isFinite(primaryN) || primaryN < 0) continue;

    // Range → use upper bound. The lower bound is still captured so
    // we don't accidentally parse "5-10 minutes" as "10 minutes" while
    // losing the range flag.
    const isRange = lower != null;
    const chosenPrimary = primaryN; // "5-10 minutes": primary is already the upper bound (10)

    let totalSeconds =
      chosenPrimary * UNIT_SECONDS[unitKey(primaryUnit)];

    if (secondary != null && secondaryUnit != null) {
      const secN = parseInt(secondary, 10);
      if (Number.isFinite(secN) && secN >= 0) {
        totalSeconds += secN * UNIT_SECONDS[unitKey(secondaryUnit)];
      }
    }

    if (totalSeconds <= 0) continue;

    // Trim any leading whitespace the boundary-lookbehind let through
    // so `label` is exactly the visible timer phrase.
    const startOffset = match.index;
    const endOffset = startOffset + whole.length;

    out.push({
      label: whole,
      totalSeconds,
      isRange,
      startIndex: startOffset,
      endIndex: endOffset,
    });
  }
  return out;
}
