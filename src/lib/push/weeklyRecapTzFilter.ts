/**
 * Pure filter deciding whether the weekly recap push should fire for
 * a given user at a given UTC instant, based on their IANA timezone.
 *
 * T12 (2026-04-20) — the cron used to fire at a fixed 18:00 UTC
 * wall-clock. That landed at 02:00 local for UTC+8 users and 06:00
 * local for NZST. Moving to hourly cron + this filter means every
 * user gets pushed at their local 18:00 on their end-of-week day
 * regardless of timezone or season (DST handled automatically by
 * the IANA zone lookup).
 *
 * Contract:
 *   - Returns true iff the user's local time at `nowUtc` is 18:00
 *     on their end-of-week day.
 *     * Monday-start users → end-of-week = Sunday.
 *     * Sunday-start users → end-of-week = Saturday.
 *   - A null `tzIana` is treated as UTC (preserves pre-migration
 *     behaviour: fires at 18:00 UTC until the client writes a real
 *     value).
 *   - An unrecognised `tzIana` (typo, deprecated alias that the
 *     runtime rejects) is also treated as UTC, with a soft log
 *     once per call — the user still gets a push, never silently
 *     dropped.
 */

export type WeekStartDay = "monday" | "sunday";

/** End-of-week weekday (long form, en-US) for each week-start. */
const END_OF_WEEK_LONG: Record<WeekStartDay, string> = {
  monday: "Sunday",
  sunday: "Saturday",
};

/**
 * Compute the user's local weekday (long name) and local hour at the
 * given UTC instant. Returns null when the timezone is unrecognised.
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
    // Some locales return "24" for midnight — normalise to 0.
    const rawHour = Number.parseInt(hourStr, 10);
    if (!Number.isFinite(rawHour)) return null;
    const hour = rawHour === 24 ? 0 : rawHour;
    return { weekday, hour };
  } catch {
    return null;
  }
}

export type TzFilterInput = {
  tzIana: string | null;
  weekStartDay: WeekStartDay;
};

export function shouldPushWeeklyRecapNow(
  input: TzFilterInput,
  nowUtc: Date = new Date(),
): boolean {
  const tz = input.tzIana && input.tzIana.length > 0 ? input.tzIana : "UTC";
  const parts = localWeekdayAndHour(tz, nowUtc);
  // Unrecognised timezone → fall back to UTC so the user still gets
  // a push, just at 18:00 UTC like pre-migration. Never silently
  // drop a user because of a typo.
  const effective = parts ?? localWeekdayAndHour("UTC", nowUtc);
  if (!effective) return false;
  if (effective.hour !== 18) return false;
  return effective.weekday === END_OF_WEEK_LONG[input.weekStartDay];
}
