"use client";

import {
  nextUnloggedMealSlot,
  todayRoomForMeal,
} from "../../../lib/copy/today";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot";
import { dateKeyFromDate } from "../../../lib/nutrition/journalNavigation";

/**
 * TodayDeficitInsight — quiet coach line under the Today ring.
 * Mirrors `apps/mobile/components/today/TodayDeficitInsight.tsx`.
 *
 * §6 (web parity 2026-06-10, ENG-1022): the line is now calm sans `text-sm`,
 * not the old `font-headline italic text-[18px]` plum serif. Mobile's
 * `Type.coach` resolved to Inter 14px (sans) in the Sloe wave despite the
 * older "Newsreader-italic" doc comment — the serif-italic web treatment had
 * drifted out of parity. Copy is unchanged.
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
      className="text-center text-sm text-foreground-secondary px-4 pt-1 pb-2"
    >
      {line}
    </p>
  );
}
