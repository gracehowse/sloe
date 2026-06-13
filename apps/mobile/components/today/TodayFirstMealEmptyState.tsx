import React from "react";
import { Pressable, Text, View } from "react-native";
import { Plus, Sparkles } from "lucide-react-native";
import { Spacing, Type } from "@/constants/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { SupprCard } from "@/components/ui/SupprCard";

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
  cardColor: _cardColor,
  cardBorderColor: _cardBorderColor,
}: TodayFirstMealEmptyStateProps) {
  void _cardColor;
  void _cardBorderColor;
  const showTip = isBrandNew && !tipDismissed;
  return (
    <SupprCard
      // Sits on the Today scroll ground → soft lift (one-treatment, Grace 2026-06-09).
      lift="soft"
      padding="lg"
      accessibilityLabel="Ready to log your first meal?"
      style={{ marginBottom: Spacing.md }}
      innerStyle={{ alignItems: "center", gap: Spacing.sm }}
    >
      <Text style={{ ...Type.body, fontWeight: "700", color: textColor, textAlign: "center" }}>
        Ready to log your first meal?
      </Text>
      <Text
        style={{
          ...Type.caption,
          color: textSecondaryColor,
          textAlign: "center",
          paddingHorizontal: Spacing.sm,
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
          paddingHorizontal: Spacing.sm,
        }}
      >
        No pressure — log when you&apos;re ready.
      </Text>
      {/* Button system (2026-06-12): this card's ONE primary action →
          `SupprButton` variant="primary" (solid aubergine fill, white
          label + glyph, pill, no shadow — the solid fill IS the affordance).
          Supersedes the old aubergine-OUTLINE treatment. Mirror of web
          `TodayFirstMealEmptyState`. */}
      <SupprButton
        variant="primary"
        accessibilityLabel="Log a meal"
        onPress={onLogMeal}
        style={{ marginTop: Spacing.xs, alignSelf: "center" }}
      >
        <Plus size={16} color="#fff" />
        <Text style={{ ...Type.headline, color: "#fff", marginLeft: Spacing.sm }}>Log a meal</Text>
      </SupprButton>
      {showTip && (
        <View
          accessibilityRole="text"
          accessibilityLabel="Tip: paste an Instagram or TikTok recipe URL — we'll break it down for you."
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
            marginTop: Spacing.sm,
            paddingHorizontal: Spacing.xs,
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
            style={{ paddingHorizontal: Spacing.xs }}
          >
            <Text style={{ ...Type.body, color: textSecondaryColor }}>×</Text>
          </Pressable>
        </View>
      )}
    </SupprCard>
  );
}

export default TodayFirstMealEmptyState;
