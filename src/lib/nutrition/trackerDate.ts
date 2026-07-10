import { clampJournalDate, dateKeyFromDate } from "./journalNavigation";

export function parseDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function shiftDateKey(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return dateKeyFromDate(d);
}

export function todayKey(): string {
  return dateKeyFromDate(new Date());
}

export function formatDateLabel(d: Date): string {
  const tk = todayKey();
  const yk = shiftDateKey(tk, -1);
  const dk = dateKeyFromDate(d);
  if (dk === tk) return "Today";
  if (dk === yk) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function clampDateKey(key: string): string {
  return dateKeyFromDate(clampJournalDate(parseDateKey(key)));
}

/**
 * ENG-1373 — the web Today "Meals" section title must reflect the viewed
 * date, not hard-code "Today's Meals". Web Today has day-navigation
 * (`setSelectedDateKey` + week/day steppers), so a user viewing yesterday
 * previously saw a "Today's Meals" header over yesterday's meals — a
 * date-scoped label contradicting the viewed date (the critique's #6).
 *
 * (Mobile has no equivalent title — `apps/mobile/components/today/
 * TodayMealsSection.tsx` deliberately omits it and shows a `TodayDateHeader`
 * instead — so this is web-only.)
 */
export function mealsSectionTitle(selectedDateKey: string, currentTodayKey: string = todayKey()): string {
  if (selectedDateKey === currentTodayKey) return "Today's Meals";
  if (selectedDateKey === shiftDateKey(currentTodayKey, -1)) return "Yesterday's Meals";
  // Older day — surface the date so the header never claims "today".
  return `${formatDateLabel(parseDateKey(selectedDateKey))} — Meals`;
}
