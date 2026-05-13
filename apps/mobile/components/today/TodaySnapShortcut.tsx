import React from "react";
import { Pressable, Text, View } from "react-native";
import { Camera, Lock } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, FontWeight, IconSize, Radius, Spacing, Type } from "@/constants/theme";
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

export function TodaySnapShortcut({
  onPress,
  locked = false,
  testID,
}: TodaySnapShortcutProps) {
  const colors = useThemeColors();

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          locked ? "Snap a meal (Pro)" : "Snap a meal"
        }
        accessibilityHint="Opens the photo log so you can capture a meal in one tap"
        testID={testID ?? "today-snap-shortcut"}
        onPress={() => {
          if (process.env.EXPO_OS === "ios") {
            void Haptics.selectionAsync();
          }
          onPress();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: Radius.sm,
            backgroundColor: Accent.primary + "18",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Camera
            size={IconSize.base}
            color={Accent.primary}
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
                backgroundColor: Accent.primary,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: colors.card,
              }}
            >
              <Lock size={8} color="#fff" strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { fontWeight: FontWeight.bold, color: colors.text }]}>
            Snap a meal
          </Text>
          {/* 2026-05-12 (premium-bar audit Today F3 #2): subtitle now
              carries both the speed signal (~3 seconds) and the
              "AI estimate · review" trust signal. Drops "no typing"
              (implicit from the action) and gives the user honest
              expectation about the engine before tap. */}
          <Text
            style={[
              Type.bodyMuted,
              { fontSize: 12, color: colors.textSecondary, marginTop: Spacing.xs / 2 },
            ]}
          >
            ~3 seconds · AI estimates macros, review before saving.
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default TodaySnapShortcut;
