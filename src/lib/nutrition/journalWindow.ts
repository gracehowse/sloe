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

/**
 * Extended history window for the web Progress + Profile surfaces
 * (ENG-1324). Mirrors the mobile Progress fetch
 * (`apps/mobile/app/(tabs)/progress.tsx` `loadData`), which caps its own
 * `nutrition_entries` read to the last 90 days — the 90d trend chart is
 * the longest look-back on that screen. Web Progress/Profile read the
 * shared context journal instead of fetching their own rows, so mounting
 * them widens the context window to this key via `ensureJournalHistory`.
 */
export const JOURNAL_HISTORY_WINDOW_DAYS = 90;

function windowStartKeyDaysBack(days: number, now: Date): string {
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() - days);
  return windowStart.toISOString().slice(0, 10);
}

/** Inclusive `date_key` lower bound for the journal boot query. */
export function journalBootWindowStartKey(now: Date = new Date()): string {
  return windowStartKeyDaysBack(JOURNAL_BOOT_WINDOW_DAYS, now);
}

/** Inclusive `date_key` lower bound for the Progress/Profile history fetch. */
export function journalHistoryWindowStartKey(now: Date = new Date()): string {
  return windowStartKeyDaysBack(JOURNAL_HISTORY_WINDOW_DAYS, now);
}
