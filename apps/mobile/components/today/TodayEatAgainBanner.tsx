import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
import type { FoodHistoryItem } from "../../../../src/lib/nutrition/foodHistory";

/**
 * TodayEatAgainBanner — one-tap re-log of the previous-day meal in
 * the slot matching the current clock time. Dismissible per day.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). AsyncStorage dismissal stays in the host.
 */
export interface TodayEatAgainBannerProps {
  suggestion: FoodHistoryItem;
  slot: string;
  textColor: string;
  textSecondaryColor: string;
  onLog: () => void;
  onDismiss: () => void;
}

export function TodayEatAgainBanner({
  suggestion,
  slot,
  textColor,
  textSecondaryColor,
  onLog,
  onDismiss,
}: TodayEatAgainBannerProps) {
  return (
    <View
      style={{
        marginBottom: Spacing.md,
        backgroundColor: Accent.primary + "08",
        borderWidth: 1,
        borderColor: Accent.primary + "30",
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.primary, letterSpacing: 1 }}>EAT AGAIN</Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: textColor, marginTop: 2 }} numberOfLines={1}>
          {suggestion.recipeTitle}
        </Text>
        {/* 2026-05-12 (premium-bar audit, cross-cutting copy unify):
            macro format string normalised to `698 kcal · 22g P · 95g
            C · 27g F`. Was `P 22g · C 95g · F 27g` here (letter-first)
            and `22P / 95C / 27F` on NorthStarBlock (slash-separated).
            Unified to the audit's spec across all Today surfaces. */}
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 2 }}>
          {Math.round(suggestion.calories)} kcal · {Math.round(suggestion.protein)}g P ·{" "}
          {Math.round(suggestion.carbs)}g C · {Math.round(suggestion.fat)}g F · into {slot}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Log ${suggestion.recipeTitle} to ${slot}`}
        onPress={onLog}
        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Accent.primary }}
      >
        {/* 2026-05-12 (premium-bar audit copy unify): "LOG" all-caps
            was the lone outlier across Today CTAs. The canonical verb
            on the Today + LogSheet + NorthStar surfaces is "Log it"
            (sentence case). This banner now matches. */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.5 }}>Log it</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss Eat again suggestion"
        onPress={onDismiss}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Ionicons name="close" size={18} color={textSecondaryColor} />
      </Pressable>
    </View>
  );
}

export default TodayEatAgainBanner;
