"use client";

import {
  nextUnloggedMealSlot,
  todayRoomForMeal,
} from "../../../lib/copy/today";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot";
import { dateKeyFromDate } from "../../../lib/nutrition/journalNavigation";

/**
 * TodayDeficitInsight — centred plum coach line under the Today ring.
 * Mirrors `apps/mobile/components/today/TodayDeficitInsight.tsx`.
 */
export interface TodayDeficitInsightProps {
  remaining: number;
  selectedDate: Date;
  byDay: Record<string, Array<{ name?: string | null }>>;
}

export function TodayDeficitInsight({
  remaining,
  selectedDate,
  byDay,
}: TodayDeficitInsightProps) {
  const dayKey = dateKeyFromDate(selectedDate);
  const mealsToday = byDay[dayKey] ?? [];
  const loggedSlots = mealsToday.map((m) =>
    normalizeJournalSlotName(m.name ?? ""),
  );
  const nextMeal = nextUnloggedMealSlot(loggedSlots);
  const line = todayRoomForMeal(remaining, nextMeal, loggedSlots);
  if (!line) return null;

  return (
    <p
      data-testid="today-coach-line"
      className="text-center font-[family-name:var(--font-headline)] italic text-[17px] leading-[23px] text-foreground-brand/90 px-4 pt-1 pb-2"
    >
      {line}
    </p>
  );
}
