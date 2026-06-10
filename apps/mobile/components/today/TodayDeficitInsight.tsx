import React from "react";
import { Text, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import { MacroColors, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  dateKeyFromDate,
  normalizeJournalSlotName,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import {
  nextUnloggedMealSlot,
  todayRoomForMeal,
} from "@suppr/shared/copy/today";

/**
 * TodayDeficitInsight — the quiet, centred coach line shown under the
 * Today ring's stat row.
 *
 * SLOE redesign (2026-06-04, Grace "room for dinner is missing"): this
 * line is now FORWARD-looking. The Figma 01 frame shows an italic "Room
 * for dinner — about 620 kcal to play with. No rush." directly under the
 * ring — permission, not restriction (project_suppr_positioning). It
 * replaces the previous BACKWARD deficit-so-far line; the backward
 * energy-balance trend (today's net + rolling avg) still lives in the
 * Energy balance section (`TodayActivityBonusCard`) below the ring, so it
 * is not duplicated here.
 *
 * Copy + the next-unlogged-slot walk live in the shared
 * `src/lib/copy/today.ts` (`todayRoomForMeal`, `nextUnloggedMealSlot`) so
 * web reads identically if it reaches Today parity. The Newsreader-italic /
 * centred treatment carries over from the 2026-06-03 SLOE pass; on
 * 2026-06-04 (Grace measured-spec pass) the line moved from the grey
 * secondary colour to PLUM at 17px (`Type.coach`) to match the Stitch
 * `today.html` coach line (`font-headline italic text-[17px] text-plum/90`).
 * The plum is dark-aware (light `MacroColors.calories` / dark lifted
 * `#815E91`) so it stays readable on the dark Today surface — the same
 * light/dark plum split `TodayHeroRing`'s StatusChip already uses.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayDeficitInsightProps {
  /** Calorie budget left today (goal − consumed). Same number the ring
   *  shows as REMAINING, so the line can never contradict the ring. */
  remaining: number;
  /** Local-time day key of the viewed day (must be today for this line). */
  selectedDate: Date;
  /** Logged meals keyed by day; today's slots are read from this. */
  byDay: Record<string, JournalMeal[]>;
}

export function TodayDeficitInsight({
  remaining,
  selectedDate,
  byDay,
}: TodayDeficitInsightProps) {
  const isDark = useColorScheme() === "dark";
  // Plum coach colour, dark-aware. Light: Sloe plum (#3B2A4D =
  // MacroColors.calories, the calorie-ring hue) per the mock's `text-plum/90`.
  // Dark: the lifted plum (#815E91) so the line stays legible on #19181C —
  // the same split StatusChip uses. Hardcoding the light-only plum would make
  // this line near-invisible in dark mode.
  const plum = useThemeColors().navPrimary; // ENG-1010: one scheme-resolved plum source
  // Use the local-time day key (matches `dateKeyFromDate` used across the
  // host) — `toISOString().slice(0,10)` returns the UTC day, which
  // diverges from the keys used by `byDay` for any user not on UTC.
  const todayKey = dateKeyFromDate(selectedDate);
  const mealsToday = byDay[todayKey] ?? [];

  // HONESTY: only claim "room" when the budget left is meaningfully
  // positive. `todayRoomForMeal` enforces the ≥50 kcal floor and returns
  // null at / over budget — render nothing in that case rather than
  // claiming headroom the user doesn't have. (The call site also only
  // mounts this when `remaining > 0`; the helper is the source of truth
  // for the honesty floor so the component stays correct in isolation.)
  const loggedSlots = mealsToday.map((m) =>
    normalizeJournalSlotName(m.name ?? ""),
  );
  const nextMeal = nextUnloggedMealSlot(loggedSlots);
  const line = todayRoomForMeal(remaining, nextMeal, loggedSlots);
  if (!line) return null;

  return (
    <View
      style={{
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          ...Type.coach,
          color: plum,
          textAlign: "center",
        }}
      >
        {line}
      </Text>
    </View>
  );
}

export default TodayDeficitInsight;
