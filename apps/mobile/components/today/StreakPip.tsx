import React from "react";
import { Pressable, Text, View, type ViewStyle, type StyleProp } from "react-native";
import { Flame, Shield } from "lucide-react-native";

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
 * 2026-04-30 — Audit verdict ("cut OR finish") finished the pip:
 *   it now opens `/weekly-recap` when an `onPress` is supplied. The
 *   render branches on `onPress`:
 *     - present  → Pressable with `accessibilityRole="button"` + a
 *                  hint like "tap for weekly recap". hitSlop 8 on each
 *                  edge so the 22pt-high pill is comfortable to tap.
 *     - absent   → static `<View>` (preserves any embedded usage
 *                  inside a different tappable parent, e.g. the
 *                  weekly-recap header where the pip is shown larger
 *                  inside a non-tappable card).
 *   Mobile-only: web parity intentionally deferred — see Step 6 of
 *   the audit task. Web pip stays display-only because there is no
 *   `/weekly-recap` route on web today; the recap surface there is the
 *   <Digest/> card on the Progress dashboard.
 *
 * Shape mirrored on web at `src/app/components/suppr/streak-pip.tsx`.
 */
export interface StreakPipProps {
  /** Current consecutive logging-day count. Always non-negative. */
  days: number;
  /** Optional accessibility hint shown by VoiceOver after the label. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * 2026-04-30 — when supplied, the pip becomes a tappable entry point
   * (typically to `/weekly-recap`). When omitted the pip remains a
   * passive `<View>` so embedded uses don't accidentally inherit
   * a button role from a parent. The accessibility label changes to
   * include "tap for weekly recap" only when `onPress` is wired so
   * VoiceOver users aren't told an action exists when none does.
   */
  onPress?: () => void;
  /**
   * 2026-04-30 — render the pip a tier larger so it can headline the
   * weekly-recap surface itself. Default behaviour (small pill) is
   * unchanged. Larger size lifts the height to 28pt and bumps the icon
   * + text proportionally — still the same shape, just legible at
   * arm's length on the recap header.
   */
  size?: "sm" | "lg";
  /**
   * 2026-05-12 (premium-bar audit DC8 polish — Headspace freeze-shield):
   * when today's streak is being kept alive by a freeze (user missed a
   * day but had a freeze stocked), swap the `Flame` glyph for `Shield`
   * and tint to a calm slate. The fundamental message is "you didn't
   * lose your streak — a freeze covered for you", not "well done, you
   * fired today" (which fame would imply). The audit's DC8 frame is
   * "streak as calm pip, gated to ≥ 2 days" — the shield variant lands
   * the same calm posture for the freeze-saved case.
   */
  freezeProtected?: boolean;
}

export function StreakPip({
  days,
  accessibilityHint,
  style,
  onPress,
  size = "sm",
  freezeProtected = false,
}: StreakPipProps) {
  const colors = useThemeColors();
  const safeDays = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  const active = safeDays >= 2;
  // DC8 freeze-shield variant takes precedence over the active/inactive
  // tone so the user reads "freeze covered for you" instead of
  // "fired up today".
  const fg = freezeProtected
    ? colors.textSecondary
    : active
      ? Accent.primary
      : colors.textSecondary;
  const bg = freezeProtected
    ? colors.cardBorder
    : active
      ? `${Accent.primary}14`
      : colors.cardBorder;

  // Accessibility label: dynamic per streak length AND whether the pip
  // is interactive. The "tap for weekly recap" suffix is only added
  // when there's a real tap target, otherwise we'd be lying to
  // VoiceOver. Zero-day case preserves the same suffix so the screen
  // is reachable from first launch (it lands on the explainer).
  const baseLabel = freezeProtected
    ? `${safeDays}-day streak — freeze used today`
    : safeDays === 0
      ? "0-day logging streak"
      : `${safeDays}-day logging streak`;
  const a11yLabel = onPress ? `${baseLabel} — tap for weekly recap` : baseLabel;

  // Sizing tokens — single source per size variant.
  const isLg = size === "lg";
  const height = isLg ? 28 : 22;
  const padX = isLg ? 12 : 8;
  const radius = height / 2;
  const iconSize = isLg ? 14 : 12;
  const fontSize = isLg ? 13 : 11;
  const gap = isLg ? 6 : 4;

  // "27-day streak" reads as *current consecutive* logging — distinct from
  // "48 days" (distinct days with food) in the milestone snapshot.
  // DC8 freeze-shield variant: replace the count with a calm "Freeze
  // saved" + retained day count so the user reads what happened in
  // plain English. Duolingo + Headspace's pattern.
  const labelText = freezeProtected
    ? `${safeDays}-day streak · freeze`
    : safeDays === 0
      ? "Start streak"
      : `${safeDays}-day streak`;

  const Glyph = freezeProtected ? Shield : Flame;

  const inner = (
    <>
      <Glyph size={iconSize} color={fg} strokeWidth={2.25} />
      <Text
        numberOfLines={1}
        style={{
          fontSize,
          fontWeight: "700",
          color: fg,
          fontVariant: ["tabular-nums"],
          letterSpacing: 0.1,
        }}
      >
        {labelText}
      </Text>
    </>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    {
      flexDirection: "row",
      alignItems: "center",
      gap,
      paddingHorizontal: padX,
      paddingVertical: 0,
      height,
      borderRadius: radius,
      backgroundColor: bg,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint ?? "Opens this week's recap"}
        onPress={onPress}
        // 22pt-high pill is borderline for the 44pt iOS guideline;
        // the hitSlop expands the touch area to a full 38pt minimum
        // without affecting layout. Larger lg variant gets less slop
        // since it's already 28pt high.
        hitSlop={isLg ? { top: 6, bottom: 6, left: 8, right: 8 } : { top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          ...(Array.isArray(containerStyle) ? containerStyle : [containerStyle]),
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      style={containerStyle}
    >
      {inner}
    </View>
  );
}

export default StreakPip;
