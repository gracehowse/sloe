import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing } from "@/constants/theme";

/**
 * TodayActivityCard — Steps & active-energy card on the Today screen.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Host owns all data; component is a pure view so the
 * existing HealthKit sync flow + historic-day navigation still run
 * through the composition root.
 */
export interface TodayActivityCardProps {
  dayLabel: string;
  stepsCount: number | null;
  dailyStepsGoal: number;
  activityBurnKcal: number | null;
  styles: Record<string, any>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
}

export function TodayActivityCard({
  dayLabel,
  stepsCount,
  dailyStepsGoal,
  activityBurnKcal,
  styles,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  borderColor,
}: TodayActivityCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Steps & activity</Text>
      <Text style={{ fontSize: 11, color: textTertiaryColor, marginBottom: Spacing.md }}>{dayLabel}</Text>

      <View style={{ gap: Spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="footsteps-outline" size={18} color={textSecondaryColor} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>Steps</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {stepsCount != null ? stepsCount.toLocaleString() : "—"}
            {stepsCount != null && (
              <Text style={{ fontSize: 12, fontWeight: "600", color: textTertiaryColor }}>
                {" "}/ {dailyStepsGoal.toLocaleString()}
              </Text>
            )}
          </Text>
        </View>
        {stepsCount != null && dailyStepsGoal > 0 && (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: borderColor, overflow: "hidden" }}>
            <View
              style={{
                width: `${Math.min(stepsCount / dailyStepsGoal, 1) * 100}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: stepsCount >= dailyStepsGoal ? Accent.success : Accent.primary,
              }}
            />
          </View>
        )}

        <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="flame-outline" size={18} color={Accent.warning} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>Active energy</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {activityBurnKcal != null ? `${activityBurnKcal.toLocaleString()} kcal` : "—"}
          </Text>
        </View>
        {activityBurnKcal == null && (
          <Text style={{ fontSize: 11, color: textTertiaryColor }}>
            Apple Health active calories appear here after you sync from More → Connected.
          </Text>
        )}
      </View>
    </View>
  );
}

export default TodayActivityCard;
