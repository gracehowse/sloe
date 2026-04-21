import React from "react";
import { Pressable, Text, View } from "react-native";
import { Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroNumber — big-number calorie hero variant (no ring, no bar).
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroNumber`). Pared back 2026-04-20 to drop the logged / burned /
 * net mini-stats row that duplicates the 2x2 macro tile grid + other
 * widgets below the hero on Today (see
 * `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current content: headline label, huge kcal number, "of X kcal · Y%
 * eaten" caption. Tap toggles the kcal between `remaining` and
 * `consumed`.
 */
export interface TodayHeroNumberProps {
  consumed: number;
  goal: number;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  cardBackgroundColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

export function TodayHeroNumber({
  consumed,
  goal,
  displayMode,
  onToggleDisplayMode,
  cardBackgroundColor,
  borderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayHeroNumberProps) {
  const remaining = Math.max(0, goal - consumed);
  const shown = displayMode === "remaining" ? remaining : consumed;
  const shownLabel = displayMode === "remaining" ? "Remaining today" : "Logged today";
  const pct = goal > 0 ? Math.round((consumed / goal) * 100) : 0;

  return (
    <Pressable
      onPress={onToggleDisplayMode}
      accessibilityRole="button"
      accessibilityLabel={`${shownLabel}. Tap to switch to ${displayMode === "remaining" ? "logged" : "remaining"}.`}
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        paddingVertical: 28,
        paddingHorizontal: Spacing.xl,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: textTertiaryColor,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {shownLabel}
      </Text>
      <Text
        style={{
          fontSize: 80,
          fontWeight: "800",
          letterSpacing: -2.8,
          lineHeight: 92,
          color: textColor,
          fontVariant: ["tabular-nums"],
          marginTop: Spacing.md,
        }}
      >
        {shown.toLocaleString()}
      </Text>
      <Text style={{ fontSize: 13, color: textSecondaryColor, marginTop: Spacing.md }}>
        of {goal.toLocaleString()} kcal · {pct}% eaten
      </Text>
    </Pressable>
  );
}

export default TodayHeroNumber;
