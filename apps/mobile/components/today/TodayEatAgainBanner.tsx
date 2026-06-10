import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import type { FoodHistoryItem } from "@suppr/shared/nutrition/foodHistory";

// 2026-05-12 (premium-bar audit DC3 polish — Cal AI 200ms fade-up
// on first paint): the EatAgain banner now eases in over 220ms with
// a small upward translate. Mirrors NorthStarBlock's fade-up so
// every Today suggestion card lands with the same calm motion.
const AnimatedView = Animated.createAnimatedComponent(View);

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
  /** Neutral card chrome (Today premium sprint 2026-05-19). Defaults
   *  to the legacy primary tint when omitted. */
  surfaceBackgroundColor?: string;
  surfaceBorderColor?: string;
  onLog: () => void;
  onDismiss: () => void;
}

export function TodayEatAgainBanner({
  suggestion,
  slot,
  textColor,
  textSecondaryColor,
  surfaceBackgroundColor,
  surfaceBorderColor,
  onLog,
  onDismiss,
}: TodayEatAgainBannerProps) {
  const accent = useAccent();
  // Sloe treatment system (2026-06-08): the eat-again prompt is a
  // soft-tint NUDGE card — a faint aubergine wash (`accent.primarySoft`,
  // 10%) signals "actionable" without a loud fill. The host may still
  // override with neutral chrome via the surface* props.
  const cardBg = surfaceBackgroundColor ?? accent.primarySoft;
  const cardBorder = surfaceBorderColor ?? accent.primary + "30";
  // 220ms ease-out fade + translate on first paint. No reduce-motion
  // gate here because the banner is a small accent (not a full-bleed
  // card); the motion is subtle enough that the reduce-motion budget
  // doesn't trip. Matches NorthStarBlock pattern.
  const opacity = useSharedValue(0);
  const translate = useSharedValue(6);
  React.useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    translate.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, translate]);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));
  // Canonical 2026-05-22: hero thumbnail removed per Grace call. The
  // gradient/image was the only purple-pink chrome on Today and clashed
  // with the warm cohesive palette. Text-only banner reads as a clean
  // suggestion card matching the macro tile genre.
  return (
    <AnimatedView
      style={[
        {
          marginBottom: Spacing.sm,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: cardBorder,
          borderRadius: Radius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
        },
        fadeStyle,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...Type.label, color: textSecondaryColor }}>EAT AGAIN</Text>
        <Text style={{ ...Type.body, color: textColor, marginTop: 2 }} numberOfLines={2} ellipsizeMode="tail">
          {suggestion.recipeTitle}
        </Text>
        {/* 2026-05-12 (premium-bar audit, cross-cutting copy unify):
            macro format string normalised to `698 kcal · 22g P · 95g
            C · 27g F`. Was `P 22g · C 95g · F 27g` here (letter-first)
            and `22P / 95C / 27F` on NorthStarBlock (slash-separated).
            Unified to the audit's spec across all Today surfaces. */}
        <Text style={{ ...Type.caption, color: textSecondaryColor, marginTop: 2 }}>
          {Math.round(suggestion.calories)} kcal · {formatMacro(suggestion.protein, "protein")}g P ·{" "}
          {formatMacro(suggestion.carbs, "carbs")}g C · {formatMacro(suggestion.fat, "fat")}g F · into {slot}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Log ${suggestion.recipeTitle} to ${slot}`}
        onPress={onLog}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: Radius.sm,
          // Sloe treatment system (2026-06-08): primary inline CTA →
          // aubergine outline (transparent fill + 1.5px primarySolid
          // border + primarySolid label), not a filled slab.
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
        }}
      >
        {/* 2026-05-12 (premium-bar audit copy unify): "LOG" all-caps
            was the lone outlier across Today CTAs. The canonical verb
            on the Today + LogSheet + NorthStar surfaces is "Log it"
            (sentence case). This banner now matches. */}
        <Text style={{ ...Type.caption, color: accent.primarySolid, fontWeight: "700" }}>Log it</Text>
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
    </AnimatedView>
  );
}

export default TodayEatAgainBanner;
