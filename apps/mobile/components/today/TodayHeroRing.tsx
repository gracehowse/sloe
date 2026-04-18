import React from "react";
import { View, Text } from "react-native";
import CalorieRing from "@/components/charts/CalorieRing";

/**
 * TodayHeroRing — calorie ring + display-mode toggle wrapper.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). State stays in the host; this component is pure
 * presentation so tap targets, haptics, and analytics firing points
 * continue to live alongside the other logging primitives.
 */
export interface TodayHeroRingProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  textTertiaryColor: string;
}

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  textTertiaryColor,
}: TodayHeroRingProps) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 14 }}>
      <CalorieRing
        consumed={consumed}
        goal={goal}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={secondaryColor}
        trackColor={trackColor}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />
      <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 6, textAlign: "center" }}>
        {expanded ? "Tap to hide macros" : "Tap to show macros"}
      </Text>
    </View>
  );
}

export default TodayHeroRing;
