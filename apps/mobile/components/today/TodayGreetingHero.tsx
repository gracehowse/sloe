import React, { memo } from "react";
import { Text, View } from "react-native";
import { FontFamily, Spacing, Type } from "@/constants/theme";
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
  const colors = useThemeColors();

  if (viewMode !== "day") return null;

  // 2026-07-24 (Grace, exact spec): eyebrow = ink, Inter 11/600/0.12em (was
  // accent-tinted sansBold/700 — "no bold anywhere in this block"); the rule
  // is the FAINT `border` hairline, NOT the mid-grey `textTertiary` (that
  // read as a hard grey line); day-name + date merge onto ONE serif line
  // (Newsreader 32/400, line-height 1.05, -0.01em) instead of a 36/500
  // headline + small subline. Historic days keep the headline/subline split —
  // the eyebrow only ever shows for today. "DAY N" stays omitted (Grace's
  // call — no honest data source, same reasoning as the original cut).
  const pastLine = !isToday ? todayPastDayGreetingLines(selectedDate) : null;

  return (
    <View>
      {isToday ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense, marginBottom: Spacing.xs }}>
          {/* Design-consistency pass 2026-07-24 — these exact values are now
              `Type.eyebrow`, shared with `ScreenSectionChrome` so the app has
              one eyebrow rather than two copies of the same spec. */}
          <Text style={{ ...Type.eyebrow, color: colors.text }}>TODAY</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      ) : null}
      <Text
        testID="today-hero-greeting"
        numberOfLines={1}
        style={{
          fontFamily: FontFamily.serifRegular,
          fontSize: 32,
          lineHeight: 34, // 1.05
          fontWeight: "400",
          letterSpacing: -0.32, // -0.01em
          color: colors.text,
        }}
      >
        {/* en-space between day name and date (the prototype's visible gap). */}
        {isToday
          ? `${todayDayName(selectedDate)}\u2002${todayShortDate(selectedDate)}`
          : pastLine!.headline}
      </Text>
      {!isToday && pastLine!.subline ? (
        <Text
          testID="today-hero-greeting-subline"
          style={{ fontFamily: Type.body.fontFamily, fontSize: 13, color: colors.textTertiary, marginTop: Spacing.xs }}
        >
          {pastLine!.subline}
        </Text>
      ) : null}
    </View>
  );
}

export const TodayGreetingHero = memo(TodayGreetingHeroImpl);

export default TodayGreetingHero;
