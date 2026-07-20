import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, Lock } from "lucide-react-native";

import { FontWeight, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * TodaySnapShortcut — small "Snap a meal" affordance rendered on the
 * Today screen above the macro tiles.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" parity — speed-loggers
 * expect a one-tap photo entry point on Today, not buried inside the
 * LogSheet).
 *
 * Behaviour:
 *   - Tap → host's `onPress` fires. Host decides Pro vs paywall.
 *   - When `locked`, a small lock badge surfaces the gate before tap
 *     so the user knows it's Pro-gated.
 *   - Single-line, low-emphasis chrome — this is a SECONDARY
 *     affordance. The primary log entry is the centred raised "+"
 *     button in the bottom tab bar (`<SupprTabBar>`).
 *
 * Web mirror: `src/app/components/suppr/today-snap-shortcut.tsx`.
 */

export interface TodaySnapShortcutProps {
  onPress: () => void;
  /** Surface a small lock badge for free + base tier users so the
   *  Pro gate is visible before tap. The host still calls `onPress`
   *  (which decides whether to open PhotoLog or the paywall). */
  locked?: boolean;
  /** Optional Maestro / continuity testID. Defaults to the canonical
   *  `today-snap-shortcut` so cross-platform test suites can grep
   *  one name. */
  testID?: string;
}

function TodaySnapShortcutImpl({
  onPress,
  locked = false,
  testID,
}: TodaySnapShortcutProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the shutter circle,
  // its glyph, and the Pro lock badge + chip on this photo-log CTA.
  const accent = useAccent();

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <PressableScale
        haptic="confirm"
        accessibilityRole="button"
        accessibilityLabel={
          locked ? "Snap a meal (Pro)" : "Snap a meal"
        }
        accessibilityHint="Opens the photo log so you can capture a meal in one tap"
        testID={testID ?? "today-snap-shortcut"}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          borderRadius: CARD_RADIUS,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.cardBorder,
        }}
      >
        {/* Sloe treatment system (2026-06-08): the shutter affordance
            is a soft-tint icon container (Accent.primarySoft + primarySolid
            glyph), NOT a second solid-aubergine filled circle competing
            with the FAB. Rations the fill to the FAB (the one filled
            moment) and restores web↔mobile parity (web already uses the
            soft-tint container). 44×44 circle keeps the shutter identity. */}
        <View
          testID="today-snap-shortcut-shutter"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: accent.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Camera
            size={22}
            color={accent.primarySolid}
            strokeWidth={2.25}
          />
          {locked ? (
            <View
              testID="today-snap-shortcut-lock"
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                width: 14,
                height: 14,
                borderRadius: Radius.sm,
                backgroundColor: accent.primary,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.card,
              }}
            >
              <Lock size={8} color={colors.primaryForeground} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          {/* 2026-05-13 (premium-bar audit Today F3 #3): when locked,
              pair the small corner-lock badge with an explicit "PRO"
              chip beside the title. The lock alone wasn't reading as
              a Pro gate — testers were tapping through expecting a
              prompt-on-tap rather than an upgrade gate. The chip
              makes the gate state unambiguous before the user taps. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <Text style={[Type.body, { fontWeight: FontWeight.bold, color: colors.text }]}>
              Snap a meal
            </Text>
            {locked ? (
              <View
                testID="today-snap-shortcut-pro-chip"
                accessibilityLabel="Pro feature"
                style={{
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: 1,
                  borderRadius: Radius.sm,
                  // Sloe treatment system (2026-06-08): Pro badge =
                  // aubergine soft-tint + primarySolid label (premium =
                  // the colour, but as a tint, not a solid fill).
                  backgroundColor: accent.primarySoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    letterSpacing: 0.6,
                    color: accent.primarySolid,
                  }}
                >
                  PRO
                </Text>
              </View>
            ) : null}
          </View>
          {/* 2026-05-12 (premium-bar audit Today F3 #2): subtitle now
              carries both the speed signal (~3 seconds) and the
              "AI estimate · review" trust signal. Drops "no typing"
              (implicit from the action) and gives the user honest
              expectation about the engine before tap. */}
          <Text
            style={[
              Type.bodyMuted,
              { ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.xs / 2 },
            ]}
          >
            ~3 seconds · AI estimates macros, review before saving.
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

export const TodaySnapShortcut = memo(TodaySnapShortcutImpl);

export default TodaySnapShortcut;
