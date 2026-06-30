import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Flame, Snowflake } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import Badge from "@/components/Badge";

/**
 * TodayStreakInsightCard — streak count + freeze badge + one-time
 * "You earned a freeze" row.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). All freeze ledger state stays in the host; this card
 * only renders.
 */
export interface TodayStreakInsightCardProps {
  streakDays: number;
  freezesAvailableToday: number;
  hasUnseenFreezeEarned: boolean;
  onDismissFreezeEarned: () => void;
  textColor: string;
  textSecondaryColor: string;
}

function TodayStreakInsightCardImpl({
  streakDays,
  freezesAvailableToday,
  hasUnseenFreezeEarned,
  onDismissFreezeEarned,
  textColor,
  textSecondaryColor,
}: TodayStreakInsightCardProps) {
  // ENG-1275 — scheme-resolved `-solid` TEXT inks. The success/cyan FILLS
  // (icon, soft tints, borders) stay on the raw `Accent` hue; only the small
  // TEXT routes to the AA-safe `-solid`, which lifts in dark via `useAccent()`.
  const accent = useAccent();
  if (streakDays <= 0) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.dense,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: Accent.success + "08",
        borderWidth: 1,
        borderColor: Accent.success + "18",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: Radius.full,
          backgroundColor: Accent.success + "18",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Flame size={18} color={Accent.success} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: accent.successSolid }}>
          {streakDays}-day logging streak
        </Text>
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 1 }}>
          You&apos;ve logged {streakDays} day{streakDays !== 1 ? "s" : ""} in a row.
        </Text>
        {freezesAvailableToday > 0 ? (
          <Badge
            variant="freeze"
            accessibilityLabel={`${freezesAvailableToday} streak freeze${
              freezesAvailableToday === 1 ? "" : "s"
            } available`}
            icon={<Snowflake size={10} color={Accent.cyan} strokeWidth={1.75} />}
            style={{ marginTop: 4 }}
          >
            {`${freezesAvailableToday} freeze${freezesAvailableToday === 1 ? "" : "s"} available`}
          </Badge>
        ) : null}
        {hasUnseenFreezeEarned ? (
          <View
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`You earned a freeze — ${freezesAvailableToday} available`}
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: Accent.cyan + "30",
              backgroundColor: Accent.cyan + "18",
            }}
          >
            <Snowflake size={13} color={Accent.cyan} strokeWidth={1.75} />
            <Text style={{ flex: 1, fontSize: 11, fontWeight: "600", color: textColor }}>
              You earned a freeze — {freezesAvailableToday} available
            </Text>
            <Pressable
              onPress={onDismissFreezeEarned}
              accessibilityRole="button"
              accessibilityLabel="Got it — dismiss earned freeze"
              hitSlop={6}
              style={{ paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm }}
            >
              <Text
                // headers census 2026-06-10: pressable eyebrow-grammar label → Type.label.
                // ENG-1275: ghost-link TEXT reads cyanSolid (raw cyan = 4.14:1
                // light / 2.98:1 dark on its tint, AA FAIL); cyanSolid clears AA.
                style={{ ...Type.label, color: accent.cyanSolid }}
              >
                Got it
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const TodayStreakInsightCard = memo(TodayStreakInsightCardImpl);

export default TodayStreakInsightCard;
