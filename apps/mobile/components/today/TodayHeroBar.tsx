import React from "react";
import { Pressable, Text, View } from "react-native";
import { MacroColors, Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroBar — linear calorie progress hero variant.
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroBar`). Pared back 2026-04-20 to drop the logged / burned /
 * net mini-stats row that duplicates the 2x2 macro tile grid + status
 * widgets below the hero on Today (see
 * `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current content: remaining/logged headline, kcal number, linear
 * progress bar, logged/target endpoint labels. Tap toggles the kcal
 * number between `remaining` and `consumed`.
 */
export interface TodayHeroBarProps {
  consumed: number;
  goal: number;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  cardBackgroundColor: string;
  borderColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  trackColor: string;
}

export function TodayHeroBar({
  consumed,
  goal,
  displayMode,
  onToggleDisplayMode,
  cardBackgroundColor,
  borderColor,
  textSecondaryColor,
  textTertiaryColor,
  trackColor,
}: TodayHeroBarProps) {
  const remaining = Math.max(0, goal - consumed);
  const shown = displayMode === "remaining" ? remaining : consumed;
  const shownLabel = displayMode === "remaining" ? "Remaining" : "Logged";
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;

  return (
    <Pressable
      onPress={onToggleDisplayMode}
      accessibilityRole="button"
      accessibilityLabel={`${shownLabel} calories. Tap to switch to ${displayMode === "remaining" ? "logged" : "remaining"}.`}
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: textTertiaryColor,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: Spacing.xs,
        }}
      >
        {shownLabel}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: Spacing.sm }}>
        <Text
          style={{
            fontSize: 56,
            fontWeight: "800",
            letterSpacing: -1.6,
            lineHeight: 56,
            color: MacroColors.calories,
            fontVariant: ["tabular-nums"],
          }}
        >
          {shown.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 14, color: textSecondaryColor }}>
          of {goal.toLocaleString()} kcal
        </Text>
      </View>
      <View
        style={{
          height: 10,
          backgroundColor: trackColor,
          borderRadius: 999,
          overflow: "hidden",
          marginTop: Spacing.md,
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: MacroColors.calories,
            borderRadius: 999,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.xs }}>
        <Text style={{ fontSize: 11, color: textTertiaryColor, fontVariant: ["tabular-nums"] }}>
          {consumed.toLocaleString()} logged
        </Text>
        <Text style={{ fontSize: 11, color: textTertiaryColor, fontVariant: ["tabular-nums"] }}>
          {goal.toLocaleString()} target
        </Text>
      </View>
    </Pressable>
  );
}

export default TodayHeroBar;
