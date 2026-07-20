import React, { memo } from "react";
import { Text, View } from "react-native";
import { FontFamily, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  todayDayName,
  todayPastDayGreetingLines,
  todayShortDate,
} from "@suppr/shared/copy/today";

export interface TodayGreetingHeroProps {
  viewMode: "day" | "week";
  isToday: boolean;
  selectedDate: Date;
}

/**
 * TodayGreetingHero — the v3 serif date hero (ENG-1247, 2026-06-24, prototype
 * `.t-greet`): an eyebrow rule + a big Newsreader day name + a small date
 * subline, replacing the old time-of-day greeting. The prototype's "DAY N"
 * chip is OMITTED — it's mock text with no honest data source (Grace's
 * call). On a historic day the eyebrow is hidden and the serif slot shows
 * the day's date so the section still anchors which day is in view.
 *
 * Day-view only — renders nothing in week view (matches the previous inline
 * `viewMode === "day" ? … : null` guard at the call site).
 *
 * Extracted from `TodayScreen.tsx` (ENG-1609, 2026-07-20) — a boy-scout
 * shrink alongside the strip→hero dead-band fix; self-contained (no props
 * beyond the three that vary per render), so behaviour is unchanged.
 */
function TodayGreetingHeroImpl({ viewMode, isToday, selectedDate }: TodayGreetingHeroProps) {
  const accent = useAccent();
  const colors = useThemeColors();

  if (viewMode !== "day") return null;

  const heroLine = isToday
    ? { headline: todayDayName(selectedDate), subline: todayShortDate(selectedDate) }
    : todayPastDayGreetingLines(selectedDate);

  return (
    <View>
      {isToday ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs }}>
          <Text style={{ fontFamily: FontFamily.sansBold, fontSize: 11, letterSpacing: 2, color: accent.primarySolid }}>
            TODAY
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      ) : null}
      <Text
        testID="today-hero-greeting"
        numberOfLines={1}
        style={{ fontFamily: FontFamily.serifMedium, fontSize: 36, lineHeight: 40, letterSpacing: -0.5, color: colors.text }}
      >
        {heroLine.headline}
      </Text>
      {heroLine.subline ? (
        <Text
          testID="today-hero-greeting-subline"
          style={{ fontFamily: Type.body.fontFamily, fontSize: 13, color: colors.textTertiary, marginTop: Spacing.xs }}
        >
          {heroLine.subline}
        </Text>
      ) : null}
    </View>
  );
}

export const TodayGreetingHero = memo(TodayGreetingHeroImpl);

export default TodayGreetingHero;
