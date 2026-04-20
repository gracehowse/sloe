import React from "react";
import { Pressable, Text, View } from "react-native";
import { Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroNumber — big-number calorie hero variant (no ring, no bar).
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroNumber`). Prioritises glanceable kcal remaining at the cost
 *  of progress context — suited to users who don't want a ring
 *  cluttering Today.
 *
 * Gestures: tap to toggle `displayMode` (`remaining` ↔ `consumed`).
 * No macro-expand mode.
 */
export interface TodayHeroNumberProps {
  consumed: number;
  goal: number;
  burned?: number | null;
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
  burned,
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
  const net = (burned ?? 0) > 0 ? consumed - (burned ?? 0) : consumed;

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
          fontSize: 96,
          fontWeight: "800",
          letterSpacing: -3.8,
          lineHeight: 86,
          color: textColor,
          fontVariant: ["tabular-nums"],
          marginTop: Spacing.sm,
        }}
      >
        {shown.toLocaleString()}
      </Text>
      <Text style={{ fontSize: 13, color: textSecondaryColor, marginTop: 6 }}>
        of {goal.toLocaleString()} kcal · {pct}% eaten
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: Spacing.xl,
          marginTop: Spacing.xl,
          paddingTop: Spacing.lg,
          borderTopWidth: 1,
          borderTopColor: borderColor,
        }}
      >
        <MiniStat value={consumed.toLocaleString()} label="logged" textColor={textColor} textTertiaryColor={textTertiaryColor} />
        <MiniStat value={(burned ?? 0).toLocaleString()} label="burned" textColor={textColor} textTertiaryColor={textTertiaryColor} />
        <MiniStat value={`${net > 0 ? "+" : ""}${net.toLocaleString()}`} label="net" textColor={textColor} textTertiaryColor={textTertiaryColor} />
      </View>
    </Pressable>
  );
}

function MiniStat({
  value,
  label,
  textColor,
  textTertiaryColor,
}: {
  value: string;
  label: string;
  textColor: string;
  textTertiaryColor: string;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: textTertiaryColor,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default TodayHeroNumber;
