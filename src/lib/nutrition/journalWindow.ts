/**
 * Boot-load window for the nutrition journal (ENG-1290).
 *
 * The web journal boot query previously loaded the user's ENTIRE
 * `nutrition_entries` history on every app boot. Mobile fixed this in
 * ENG-542 (2026-05-15) with a 35-day `date_key` window — enough to cover
 * the week strip (7d) plus trailing analytics (~28d). This helper mirrors
 * the mobile computation exactly (see
 * `apps/mobile/app/(tabs)/_today/TodayScreen.tsx` `loadJournal`): UTC
 * midnight, minus 35 days, ISO date-key.
 *
 * Days OLDER than the window stay reachable — the journal hook fetches
 * them on demand, one day at a time, when the user navigates there (the
 * calendar picker allows jumps up to `JOURNAL_HISTORY_DAYS_BACK` = 1095
 * days back).
 */
export const JOURNAL_BOOT_WINDOW_DAYS = 35;

/** Inclusive `date_key` lower bound for the journal boot query. */
export function journalBootWindowStartKey(now: Date = new Date()): string {
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() - JOURNAL_BOOT_WINDOW_DAYS);
  return windowStart.toISOString().slice(0, 10);
}
