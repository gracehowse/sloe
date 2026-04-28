import React from "react";
import { Text, View, type ViewStyle, type StyleProp } from "react-native";
import { Flame } from "lucide-react-native";

import { Accent } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * StreakPip — small pill that shows the user's current logging streak
 * next to the Today date row.
 *
 * Rationale (D-2026-04-27-07):
 *   "Streak shrinks to a pip; weekly recap stays as Sunday card,
 *    demoted from primary retention."
 *   "Streaks are the laziest retention loop in tracker design — they
 *    generate adherence guilt and don't differentiate."
 *
 * The pip is intentionally restrained: 22pt high, lucide `Flame`
 * glyph, tabular-nums label, no celebration. It replaces the previous
 * `TodayStreakInsightCard` ribbon (already removed 2026-04-20) and
 * the inline streak chip on the date row (which carried emoji 🔥
 * historically). Per V-4 in the production design spec, lucide `Flame`
 * is the canonical glyph; visual-qa validates rendering on dark.
 *
 * Dropping to zero or 1 day still renders the pip (so first-time users
 * see the surface and understand what it tracks); the colour stays
 * neutral until the streak ≥ 2. We do NOT hide a 0-day streak — the
 * pip's persistent presence is part of the calm-streak posture.
 *
 * Shape mirrored on web at `src/app/components/suppr/streak-pip.tsx`.
 */
export interface StreakPipProps {
  /** Current consecutive logging-day count. Always non-negative. */
  days: number;
  /** Optional accessibility hint shown by VoiceOver after the label. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function StreakPip({ days, accessibilityHint, style }: StreakPipProps) {
  const colors = useThemeColors();
  const safeDays = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  const active = safeDays >= 2;
  const fg = active ? Accent.primary : colors.textSecondary;
  const bg = active ? `${Accent.primary}14` : colors.cardBorder;

  const label =
    safeDays === 0
      ? "Start your streak"
      : `${safeDays}-day${safeDays === 1 ? "" : ""} streak`;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${safeDays}-day logging streak`}
      accessibilityHint={accessibilityHint}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 0,
          height: 22,
          borderRadius: 11,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Flame size={12} color={fg} strokeWidth={2.25} />
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: fg,
          fontVariant: ["tabular-nums"],
          letterSpacing: 0.1,
        }}
      >
        {safeDays === 0 ? label : `${safeDays} day${safeDays === 1 ? "" : "s"}`}
      </Text>
    </View>
  );
}

export default StreakPip;
