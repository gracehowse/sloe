import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Flame, Footprints, Info } from "lucide-react-native";
import { Accent, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { todayHealthConnectActiveCaloriesHint } from "@suppr/shared/copy/today";

/**
 * TodayActivityCard — Steps & active-energy card on the Today screen.
 *
 * Sloe `TD1 · Activity & energy` re-skin (Today re-skin unit 3, 2026-06-03).
 * Figma 459:2 / `docs/prototypes/stitch-sloe/today-activity.html` — the
 * "Steps & activity" card: a Newsreader title + "Today" right label, a Steps
 * row (count / goal over a track) and an Active-energy row, divided by a
 * hairline.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Host owns all data; component is a pure view so the
 * existing HealthKit sync flow + historic-day navigation still run
 * through the composition root. Re-skin only — no data/logic change.
 *
 * 2026-05-08 (Pattern #9, tracker `AN8GJ1Dr3M`): optional `onShowProvenance`
 * prop renders a small info icon next to the title that opens the
 * "Where this comes from" sheet. One affordance per card (steps + active
 * energy share a source); two icons would fight on a dense screen.
 */
export interface TodayActivityCardProps {
  dayLabel: string;
  stepsCount: number | null;
  dailyStepsGoal: number;
  activityBurnKcal: number | null;
  /** Pattern #9 — when provided, renders an info icon that opens the provenance sheet. */
  onShowProvenance?: () => void;
  styles: Record<string, any>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
}

function TodayActivityCardImpl({
  dayLabel,
  stepsCount,
  dailyStepsGoal,
  activityBurnKcal,
  onShowProvenance,
  styles,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  borderColor,
}: TodayActivityCardProps) {
  const accent = useAccent();
  // ENG-1010: scheme-resolved plum (static plum is near-invisible on dark).
  const colors = useThemeColors();
  void styles;
  return (
    // Sits on the Today scroll ground → soft lift (one-treatment, Grace 2026-06-09).
    <SupprCard lift="soft" padding="lg" testID="today-activity-card" innerStyle={{ gap: Spacing.md }}>
      {/* Sloe TD1 header — Newsreader title + right-aligned day label. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Text style={{ ...Type.headline, color: colors.navPrimary }}>Steps & activity</Text>
          {onShowProvenance ? (
            <PressableScale
              onPress={onShowProvenance}
              haptic="selection"
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Where this number comes from"
              testID="today-activity-provenance-info"
            >
              <Info size={14} color={textTertiaryColor} strokeWidth={2} />
            </PressableScale>
          ) : null}
        </View>
        <Text style={{ ...Type.caption, color: textTertiaryColor }}>{dayLabel}</Text>
      </View>

      <View style={{ gap: Spacing.md }}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Footprints size={18} color={textSecondaryColor} strokeWidth={2} />
              <Text style={{ ...Type.bodyLarge, color: textColor }}>Steps</Text>
            </View>
            <Text style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}>
              {stepsCount != null ? stepsCount.toLocaleString() : "—"}
              {stepsCount != null && (
                <Text style={{ ...Type.caption, color: textTertiaryColor }}>
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
                  backgroundColor: stepsCount >= dailyStepsGoal ? Accent.success : accent.primary,
                }}
              />
            </View>
          )}
        </View>

        {/* Sloe: hairline divider (`border-t border-line`), not a 1pt (3px) rule. */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <Flame size={18} color={Accent.activity} strokeWidth={2} />
            <Text style={{ ...Type.bodyLarge, color: textColor }}>Active energy</Text>
          </View>
          <Text style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}>
            {activityBurnKcal != null ? (
              <>
                {activityBurnKcal.toLocaleString()}
                <Text style={{ ...Type.caption, color: textTertiaryColor }}> kcal</Text>
              </>
            ) : (
              "—"
            )}
          </Text>
        </View>
        {activityBurnKcal == null && (
          <Text style={{ fontSize: 11, color: textTertiaryColor }}>
            {todayHealthConnectActiveCaloriesHint()}
          </Text>
        )}
      </View>
    </SupprCard>
  );
}

export const TodayActivityCard = memo(TodayActivityCardImpl);

export default TodayActivityCard;
