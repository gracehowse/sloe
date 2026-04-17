import { clampJournalDate, dateKeyFromDate } from "./journalNavigation.ts";

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
