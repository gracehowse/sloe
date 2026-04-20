import React from "react";
import { Pressable, Text, View } from "react-native";
import { MacroColors, Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroBar — linear calorie progress hero variant.
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroBar`). Visual: big remaining number → linear progress bar
 *  → logged/target endpoints → three mini stats.
 *
 * Gestures mirror `TodayHeroRing`: tap to toggle `displayMode`
 * (`remaining` ↔ `consumed`). No macro-expand mode — that's the
 * ring's job.
 */
export interface TodayHeroBarProps {
  consumed: number;
  goal: number;
  burned?: number | null;
  mealCount: number;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  cardBackgroundColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  trackColor: string;
}

export function TodayHeroBar({
  consumed,
  goal,
  burned,
  mealCount,
  displayMode,
  onToggleDisplayMode,
  cardBackgroundColor,
  borderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  trackColor,
}: TodayHeroBarProps) {
  const remaining = Math.max(0, goal - consumed);
  const shown = displayMode === "remaining" ? remaining : consumed;
  const shownLabel = displayMode === "remaining" ? "Remaining" : "Logged";
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const net = (burned ?? 0) > 0 ? consumed - (burned ?? 0) : consumed;

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
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: Spacing.xxl,
          marginTop: Spacing.lg,
          paddingTop: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: borderColor,
        }}
      >
        <MiniStat value={(burned ?? 0).toLocaleString()} label="burned" textColor={textColor} textTertiaryColor={textTertiaryColor} />
        <MiniStat value={`${net > 0 ? "+" : ""}${net.toLocaleString()}`} label="net" textColor={textColor} textTertiaryColor={textTertiaryColor} />
        <MiniStat value={mealCount.toString()} label="meals" textColor={textColor} textTertiaryColor={textTertiaryColor} />
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

export default TodayHeroBar;
