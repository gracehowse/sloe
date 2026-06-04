import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Plus, Sparkles } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";

/**
 * TodayFirstMealEmptyState — friendly empty card surfaced under the
 * calorie ring when the user has logged 0 meals today AND has no
 * journal history. Closes journey-architect P1 ("Empty states are
 * silent. No journey has an empty state with a clear 'do this next'
 * action.") for the day-1 / cold-start surface.
 *
 * Props:
 *  - `isBrandNew` — true when `auth.users.created_at < 24h ago`. When
 *    true, we render a single dismissable tip line under the CTA that
 *    teaches the IG/TT recipe URL paste path. The host owns the
 *    dismissal state (AsyncStorage) so the tip never re-renders.
 *
 * Web parity: `src/app/components/suppr/today-first-meal-empty-state.tsx`.
 */
export interface TodayFirstMealEmptyStateProps {
  /** Open the unified LogSheet so the user can log their first meal. */
  onLogMeal: () => void;
  /** True iff `auth.users.created_at < 24h ago` (brand-new account). */
  isBrandNew: boolean;
  /** True iff the user has previously dismissed the IG/TT recipe-paste tip. */
  tipDismissed: boolean;
  /** Fires when the user taps the X on the tip line. Host persists. */
  onDismissTip: () => void;
  textColor: string;
  textSecondaryColor: string;
  cardColor: string;
  cardBorderColor: string;
}

export function TodayFirstMealEmptyState({
  onLogMeal,
  isBrandNew,
  tipDismissed,
  onDismissTip,
  textColor,
  textSecondaryColor,
  cardColor,
  cardBorderColor,
}: TodayFirstMealEmptyStateProps) {
  const cardElevation = useCardElevation();
  const showTip = isBrandNew && !tipDismissed;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Ready to log your first meal?"
      style={[{
        backgroundColor: cardElevation.liftBg ?? cardColor,
        borderRadius: Radius.lg,
        // Sloe: hairline (≈1 physical px), not a 1pt (3px on @3x) boxed edge.
        borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        borderColor: cardBorderColor,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        alignItems: "center",
        gap: 10,
      }, cardElevation.shadowStyle]}
    >
      <Text style={{ ...Type.body, fontWeight: "700", color: textColor, textAlign: "center" }}>
        Ready to log your first meal?
      </Text>
      <Text
        style={{
          ...Type.caption,
          color: textSecondaryColor,
          textAlign: "center",
          paddingHorizontal: 8,
        }}
      >
        Search a food, scan a barcode, or paste a recipe — your day starts here.
      </Text>
      {/* DC12 (2026-05-14, premium-bar audit) — Headspace-style
          supportive moment-of-truth line for the empty-day surface.
          The previous copy was already friendly but pushed the user
          straight at the CTA; this calm sub-line lowers the pressure
          before they tap. Web parity:
          `src/app/components/suppr/today-first-meal-empty-state.tsx`. */}
      <Text
        testID="first-meal-empty-supportive-copy"
        style={{
          ...Type.caption,
          color: textSecondaryColor,
          textAlign: "center",
          paddingHorizontal: 8,
        }}
      >
        No pressure — log when you&apos;re ready.
      </Text>
      <Pressable
        onPress={onLogMeal}
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: Radius.md,
          backgroundColor: Accent.primary,
          marginTop: 4,
        }}
      >
        <Plus size={16} color="#fff" />
        <Text style={{ ...Type.body, fontWeight: "700", color: "#fff" }}>Log a meal</Text>
      </Pressable>
      {showTip && (
        <View
          accessibilityRole="text"
          accessibilityLabel="Tip: paste an Instagram or TikTok recipe URL — we'll break it down for you."
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            paddingHorizontal: 4,
          }}
        >
          <Sparkles size={11} color={textSecondaryColor} />
          <Text
            style={{
              ...Type.caption,
              color: textSecondaryColor,
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            Tip: paste an Instagram or TikTok recipe URL — we&apos;ll break it down for you.
          </Text>
          <Pressable
            onPress={onDismissTip}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tip"
            style={{ paddingHorizontal: 4 }}
          >
            <Text style={{ ...Type.body, color: textSecondaryColor }}>×</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default TodayFirstMealEmptyState;
