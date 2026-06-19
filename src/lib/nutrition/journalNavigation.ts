// ENG-717 — single source of truth for the local-calendar date key lives
// in `src/lib/datetime/dateKey`. Re-exported so existing
// `from "./journalNavigation"` importers stay unchanged.
export { dateKeyFromDate } from "../datetime/dateKey";

/** How far back / forward the journal date picker can move (matches mobile). */
export const JOURNAL_HISTORY_DAYS_BACK = 1095;
export const JOURNAL_FUTURE_DAYS = 30;

/** Local midnight range for journal navigation (same bounds as {@link clampJournalDate}). */
export function journalRangeBounds(): { min: Date; max: Date } {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const min = new Date(t);
  min.setDate(min.getDate() - JOURNAL_HISTORY_DAYS_BACK);
  const max = new Date(t);
  max.setDate(max.getDate() + JOURNAL_FUTURE_DAYS);
  max.setHours(0, 0, 0, 0);
  return { min, max };
}

/** First day of the calendar week containing `d` (local midnight). */
export function startOfWeekContaining(d: Date, weekStart: "monday" | "sunday"): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const offset = weekStart === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  x.setDate(x.getDate() + offset);
  return x;
}

export function addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Every week start (step 7) from the first week overlapping `min` through the week containing `max`. */
export function enumerateWeekStartsInJournalRange(weekStart: "monday" | "sunday"): Date[] {
  const { min, max } = journalRangeBounds();
  const first = startOfWeekContaining(min, weekStart);
  const last = startOfWeekContaining(max, weekStart);
  const out: Date[] = [];
  for (let cur = new Date(first); cur.getTime() <= last.getTime(); cur.setDate(cur.getDate() + 7)) {
    out.push(new Date(cur));
  }
  if (out.length === 0) {
    out.push(startOfWeekContaining(new Date(), weekStart));
  }
  return out;
}

/** 0–6 index of `d` within its week starting `weekStart` (Mon-first or Sun-first). */
export function dayIndexInWeek(d: Date, weekStart: "monday" | "sunday"): number {
  const ws = startOfWeekContaining(d, weekStart);
  return Math.floor((stripToMidnight(d).getTime() - ws.getTime()) / 86_400_000);
}

function stripToMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Clamp a calendar day to the journal’s navigable range (local dates). */
export function clampJournalDate(d: Date): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const min = new Date(t);
  min.setDate(min.getDate() - JOURNAL_HISTORY_DAYS_BACK);
  const max = new Date(t);
  max.setDate(max.getDate() + JOURNAL_FUTURE_DAYS);
  max.setHours(23, 59, 59, 999);
  const x = new Date(d);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}
