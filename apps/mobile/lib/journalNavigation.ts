/**
 * Canonical implementation lives in the web app tree; re-export for Metro +
 * single source of truth (ENG-1358 — was a byte-identical hand-mirrored copy).
 */
export {
  JOURNAL_HISTORY_DAYS_BACK,
  JOURNAL_FUTURE_DAYS,
  journalRangeBounds,
  startOfWeekContaining,
  addDaysLocal,
  enumerateWeekStartsInJournalRange,
  dayIndexInWeek,
  clampJournalDate,
} from "@suppr/shared/nutrition/journalNavigation";
