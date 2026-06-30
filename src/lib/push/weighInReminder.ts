/**
 * ENG-955 — gentle, opt-in weigh-in reminder cadence + anti-nag core.
 *
 * The consequential, headless-testable logic behind the weigh-in reminder
 * push. Mirrors the delivery rail of the weekly recap (`weeklyRecapTzFilter.ts`
 * + `app/api/push/weigh-in-reminder/route.ts`) but answers a different
 * question: "should THIS user get a gentle weigh-in nudge right now?"
 *
 * Design posture — this is a NUDGE, never a nag (Suppr voice, body-neutral,
 * no toxic gamification):
 *   - Opt-IN only. A user with no stored preference gets nothing (the
 *     preference defaults to "off"). The flag gating the UI is also
 *     default-OFF, so nobody sees the toggle until the ramp.
 *   - Fires ONLY on the user's chosen weekday + hour, in their local tz
 *     (DST-correct via the IANA zone lookup — same approach the weekly recap
 *     filter uses).
 *   - Anti-nag rule #1 — SKIP if the user already logged a weigh-in this
 *     period. No reminder lands on top of a fresh weigh-in. "This period" is
 *     the trailing 7-day window ending today (reuses `weighInDays.ts`), so a
 *     once-weekly cadence never double-asks within the same week.
 *   - Anti-nag rule #2 — dedupe via `last_weigh_in_reminder_sent_at`: never
 *     fire twice inside `WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS` (6 days), which
 *     protects against an hourly cron double-firing inside the chosen-hour
 *     window AND against a user who shifts timezones mid-week.
 *   - NEVER a streak/badge/threat. The copy assembler below is pinned by tests
 *     to contain none of that language — it is warm and trend-framed only.
 *
 * Pure + self-contained (no React, no RN, no Supabase, no process.env) so it's
 * deterministic and unit-testable, and so the cron route and the mobile/web
 * settings surfaces all share one decision instead of drifting.
 */

import { countWeighInDaysInWindow } from "../nutrition/weighInDays";

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Long-form (en-US) weekday names, indexed Sunday=0..Saturday=6 to match
 *  `Date.getDay()` and the JSON-stored cadence weekday. */
const WEEKDAY_LONG: Record<WeekdayIndex, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * Dedupe window — never re-fire the reminder for a user inside this span.
 * 6 days (matches the weekly-recap dedupe) so a once-weekly cadence fires at
 * most once per week even with an hourly cron and a tz shift.
 */
export const WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Default cadence when a user opts in without picking specifics. Monday 08:00
 * local — the warm copy ("Mornings give the steadiest trend.") leans toward a
 * morning weigh-in, and a Monday cadence gives a clean weekly anchor without
 * implying the previous week was a "fail".
 */
export const DEFAULT_WEIGH_IN_REMINDER_WEEKDAY: WeekdayIndex = 1; // Monday
export const DEFAULT_WEIGH_IN_REMINDER_HOUR = 8; // 08:00 local

/**
 * Persisted preference shape. Lives inside the existing freeform
 * `profiles.notification_prefs` JSONB under the `weighInReminder` key (no new
 * column for the pref itself — the migration only adds the dedupe timestamp).
 */
export type WeighInReminderPref = {
  /** Opt-in master switch. Absent / false → no reminder ever. */
  enabled: boolean;
  /** Local weekday to fire on (Sunday=0..Saturday=6). */
  weekday: WeekdayIndex;
  /** Local hour (0..23) to fire at. */
  hour: number;
};

/** The default pref an opt-in writes when the user hasn't customised cadence. */
export const DEFAULT_WEIGH_IN_REMINDER_PREF: WeighInReminderPref = {
  enabled: true,
  weekday: DEFAULT_WEIGH_IN_REMINDER_WEEKDAY,
  hour: DEFAULT_WEIGH_IN_REMINDER_HOUR,
};

/**
 * Parse a raw `notification_prefs.weighInReminder` value into a normalised
 * pref, or `null` when the user has not opted in (the cron treats `null` as
 * "skip this user"). Tolerant of partial / malformed JSON — a bad weekday or
 * hour falls back to the default for that field rather than throwing, but a
 * missing/false `enabled` is respected as "off".
 */
export function parseWeighInReminderPref(raw: unknown): WeighInReminderPref | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.enabled !== true) return null;

  const weekday = normaliseWeekday(obj.weekday);
  const hour = normaliseHour(obj.hour);
  return {
    enabled: true,
    weekday,
    hour,
  };
}

function normaliseWeekday(v: unknown): WeekdayIndex {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6) {
    return v as WeekdayIndex;
  }
  return DEFAULT_WEIGH_IN_REMINDER_WEEKDAY;
}

function normaliseHour(v: unknown): number {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23) {
    return v;
  }
  return DEFAULT_WEIGH_IN_REMINDER_HOUR;
}

/**
 * Compute the user's local weekday (long name) and local hour at a UTC
 * instant. Returns null when the timezone is unrecognised so the caller can
 * fall back to UTC (never silently drop a user). Identical approach to
 * `weeklyRecapTzFilter.localWeekdayAndHour`.
 */
function localWeekdayAndHour(
  tzIana: string,
  nowUtc: Date,
): { weekday: string; hour: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tzIana,
      weekday: "long",
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(nowUtc);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hourStr = parts.find((p) => p.type === "hour")?.value;
    if (!weekday || typeof hourStr !== "string") return null;
    const rawHour = Number.parseInt(hourStr, 10);
    if (!Number.isFinite(rawHour)) return null;
    // Some locales return "24" for midnight — normalise to 0.
    const hour = rawHour === 24 ? 0 : rawHour;
    return { weekday, hour };
  } catch {
    return null;
  }
}

/**
 * Compute the local `YYYY-MM-DD` key for a UTC instant in a given IANA tz.
 * Used to anchor the "already weighed in this period" check to the user's
 * local today, so a once-weekly cadence in their tz lines up with their
 * `weight_kg_by_day` keys (which are written local). Falls back to a UTC
 * key for an unrecognised tz.
 */
export function localDayKeyInTz(tzIana: string | null, nowUtc: Date): string {
  const tz = tzIana && tzIana.length > 0 ? tzIana : "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA renders `YYYY-MM-DD` directly.
    const parts = fmt.formatToParts(nowUtc);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through to UTC */
  }
  // UTC fallback.
  return nowUtc.toISOString().slice(0, 10);
}

export type WeighInReminderInput = {
  /** Parsed opt-in pref, or null when the user has not opted in. */
  pref: WeighInReminderPref | null;
  /** User's IANA timezone (`profiles.tz_iana`). Null → treated as UTC. */
  tzIana: string | null;
  /** `profiles.weight_kg_by_day` — the weigh-in ledger. */
  weightKgByDay: Record<string, number> | null | undefined;
  /** ISO string of the last reminder fire (`last_weigh_in_reminder_sent_at`). */
  lastReminderSentAt: string | null | undefined;
};

export type WeighInReminderDecision = {
  send: boolean;
  /**
   * Why we are NOT sending, for structured logs / analytics. `null` when
   * `send` is true. Never surfaced to the user.
   */
  skipReason:
    | null
    | "not_opted_in"
    | "outside_window"
    | "already_logged_this_period"
    | "deduped";
};

/**
 * The eligibility decision. Pure — `nowUtc` is injected so the cron and tests
 * are deterministic.
 *
 * Evaluation order is deliberate:
 *   1. opt-in gate (cheapest, and the dominant skip)
 *   2. window gate (tz-aware weekday + hour)
 *   3. dedupe gate (already fired inside the 6-day window)
 *   4. anti-nag gate (already weighed in this period) — checked LAST because
 *      it's the most "interesting" skip and we want the others to short-
 *      circuit before we touch the ledger.
 */
export function decideWeighInReminder(
  input: WeighInReminderInput,
  nowUtc: Date = new Date(),
): WeighInReminderDecision {
  // 1. Opt-in gate.
  if (!input.pref || !input.pref.enabled) {
    return { send: false, skipReason: "not_opted_in" };
  }

  // 2. Window gate — fire only at the user's chosen local weekday + hour.
  if (!isInWeighInWindow(input.pref, input.tzIana, nowUtc)) {
    return { send: false, skipReason: "outside_window" };
  }

  // 3. Dedupe gate — never re-fire inside the 6-day window.
  if (input.lastReminderSentAt) {
    const lastMs = Date.parse(input.lastReminderSentAt);
    if (
      Number.isFinite(lastMs) &&
      nowUtc.getTime() - lastMs < WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS
    ) {
      return { send: false, skipReason: "deduped" };
    }
  }

  // 4. Anti-nag gate — skip if a weigh-in already exists this period. The
  //    period is the trailing 7-day window ending on the user's LOCAL today,
  //    so a fresh weigh-in earlier in the same week suppresses the nudge.
  const todayKey = localDayKeyInTz(input.tzIana, nowUtc);
  const weighInsThisPeriod = countWeighInDaysInWindow(
    input.weightKgByDay,
    todayKey,
    7,
  );
  if (weighInsThisPeriod > 0) {
    return { send: false, skipReason: "already_logged_this_period" };
  }

  return { send: true, skipReason: null };
}

/**
 * Tz-aware window check: true iff the user's local time at `nowUtc` is their
 * chosen weekday + chosen hour. An unrecognised tz falls back to UTC so we
 * never silently drop a user because of a typo'd zone.
 */
export function isInWeighInWindow(
  pref: WeighInReminderPref,
  tzIana: string | null,
  nowUtc: Date,
): boolean {
  const tz = tzIana && tzIana.length > 0 ? tzIana : "UTC";
  const parts =
    localWeekdayAndHour(tz, nowUtc) ?? localWeekdayAndHour("UTC", nowUtc);
  if (!parts) return false;
  if (parts.hour !== pref.hour) return false;
  return parts.weekday === WEEKDAY_LONG[pref.weekday];
}

// ─────────────────────────────────────────────────────────────────────
// Warm copy assembler
// ─────────────────────────────────────────────────────────────────────

/** Push notification title — calm, no urgency. */
export const WEIGH_IN_REMINDER_TITLE = "Weekly weigh-in";

/**
 * APNs body-line truncation threshold (matches the weekly-recap formatter).
 * Pinned by tests so a future copy edit can't quietly clip the call to action.
 */
export const WEIGH_IN_REMINDER_BODY_MAX_CHARS = 178;

/**
 * Build the warm reminder copy. ONE deliberate sentence pair, body-neutral,
 * trend-framed — never a streak/badge/threat and never a weight-loss claim.
 *
 * The opening question is gentle and skippable; the second clause is the only
 * "why" we offer (a steadier trend), framed as guidance, not pressure.
 *
 * Returned as a `{ title, body }` pair so the cron reuses the same copy on
 * both the Expo and Web Push rails without re-deriving it.
 */
export function buildWeighInReminderCopy(): { title: string; body: string } {
  return {
    title: WEIGH_IN_REMINDER_TITLE,
    body: "Ready for a quick weigh-in? Mornings give the steadiest trend.",
  };
}
