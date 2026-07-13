/**
 * Canonical local-calendar date key — `YYYY-MM-DD` in the device's local
 * timezone.
 *
 * ENG-717: this helper was duplicated ~5× across web + mobile
 * (`src/lib/nutrition/trackerStats.ts`, `src/lib/nutrition/journalNavigation.ts`,
 * `apps/mobile/lib/nutritionJournal.ts`, `apps/mobile/lib/healthSync.ts`,
 * `app/api/push/weekly-recap/route.ts`). Each copy formatted the LOCAL
 * calendar day via `getFullYear()/getMonth()/getDate()`. Consolidated here
 * and imported by mobile via `@suppr/shared/datetime/dateKey`.
 *
 * IMPORTANT — local, not UTC. This intentionally uses the local-timezone
 * getters so a meal logged at 11pm local lands on the local calendar day.
 * Do NOT swap to `toISOString().slice(0,10)` (that is UTC and would shift
 * the day for users behind UTC in the evening). The UTC-bucketed variant
 * used for server counters lives separately in
 * `src/lib/server/aiBudget.ts` (`utcDateKey`) and the ISO-slice form in
 * `src/context/appData/persistence.ts` (`dateKey`) — those are NOT the
 * same semantics and were deliberately left in place.
 *
 * ENG-1540: this rule is now CI-enforced. `check:date-key`
 * (`scripts/check-date-key.mjs`, only-shrink) fails any new argless
 * `new Date().toISOString().slice(...)` day-key derivation — a Build-41-class
 * regression that kept coming back. Use this helper for day keys.
 *
 * @param d - a `Date`, or a date string/number a `Date` constructor accepts
 *   (the mobile HealthKit sync passes raw sample timestamps that may be
 *   strings — this preserves the old `healthSync.dateKey(d: Date | string)`
 *   behaviour exactly).
 */
export function dateKeyFromDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const da = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
