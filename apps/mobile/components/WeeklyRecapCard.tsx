/**
 * WeeklyRecapCard — mobile (Batch 4.11).
 *
 * Mirrors the web `suppr/weekly-recap-card.tsx`. All labels, stats, and
 * share copy come from the shared pure helper
 * `src/lib/nutrition/weeklyRecap.ts` so web and mobile cannot drift.
 *
 * Rules:
 *   - Supportive, factual copy (no shame phrasing).
 *   - Share button labelled; dismiss button labelled.
 *   - Weight delta suppressed when <2 weigh-ins.
 *   - Card uses an accessibility role of "header" for the headline so
 *     screen readers announce a heading level.
 */

import { useCallback, useMemo } from "react";
import { Share, View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import { formatRecapForShare, type WeeklyRecap } from "@/lib/weeklyRecap";

export interface WeeklyRecapCardProps {
  recap: WeeklyRecap;
  onDismiss: () => void;
}

export function WeeklyRecapCard({ recap, onDismiss }: WeeklyRecapCardProps) {
  const colors = useThemeColors();
  const shareText = useMemo(() => formatRecapForShare(recap), [recap]);

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey: recap.weekKey,
      platform: Platform.OS,
    });
    try {
      await Share.share({
        message: shareText,
      });
    } catch {
      // User cancelled or sheet failed — no toast needed.
    }
  }, [recap.weekKey, shareText]);

  const handleDismiss = useCallback(() => {
    track(AnalyticsEvents.weekly_recap_dismissed, { weekKey: recap.weekKey });
    onDismiss();
  }, [onDismiss, recap.weekKey]);

  const hasWeight = recap.weightDeltaKg != null;
  const weightCopy = hasWeight
    ? `${recap.weightDeltaKg! > 0 ? "+" : ""}${recap.weightDeltaKg} kg`
    : "No weigh-ins this week";

  return (
    <View
      accessible={false}
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: 14,
      }}
      testID="weekly-recap-card"
    >
      {/* Dismiss */}
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss weekly recap"
        hitSlop={8}
        style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Ionicons name="trophy-outline" size={14} color={Accent.success} />
        <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.success, letterSpacing: 1 }}>
          WEEK RECAP
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 2 }}
      >
        Your week — {recap.weekLabel}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
        {recap.daysLogged} day{recap.daysLogged === 1 ? "" : "s"} logged
      </Text>

      {/* Stat grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Stat label="Avg calories" value={`${recap.avgCalories}`} hint="per day" />
        <Stat
          label="Avg protein"
          value={`${recap.avgProtein}g`}
          hint={
            recap.proteinAdherencePct > 0
              ? `${recap.proteinAdherencePct}% of target`
              : "no target set"
          }
        />
        <Stat
          label="Streak"
          value={`${recap.streakLength}`}
          hint={
            recap.freezesAvailable > 0
              ? `day${recap.streakLength === 1 ? "" : "s"} · ${recap.freezesAvailable} freeze${recap.freezesAvailable === 1 ? "" : "s"}`
              : `day${recap.streakLength === 1 ? "" : "s"}`
          }
        />
        <Stat
          label="Weight"
          value={weightCopy}
          hint={hasWeight ? "change this week" : "log weight any day"}
          muted={!hasWeight}
        />
      </View>

      {recap.bestDay ? (
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
          Best day —{" "}
          <Text style={{ fontWeight: "700", color: colors.text }}>{recap.bestDay.label}</Text>
          {" · "}
          {recap.bestDay.protein}g protein, {recap.bestDay.calories} kcal
        </Text>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share weekly recap"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: Accent.success + "18",
            borderWidth: 1,
            borderColor: Accent.success + "30",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="share-outline" size={14} color={Accent.success} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.success }}>
            Share week
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss weekly recap and continue"
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: colors.cardBorder + "22",
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: muted ? colors.textSecondary : colors.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
