import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprMark } from "@/components/SupprMark";
import { useOnboardingV2 } from "../context";

/**
 * Mobile Welcome — full-bleed hero with the brand gradient. Mirrors
 * the web Welcome at `src/app/components/onboarding-v2/steps/welcome.tsx`.
 *
 * Uses react-native-svg's LinearGradient (already a project dep) so we
 * don't pull in expo-linear-gradient just for this one screen.
 */

export function MobileWelcomeStep() {
  const { go } = useOnboardingV2();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingHorizontal: 24,
          paddingBottom: 28,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="welcome-grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={Accent.primary} stopOpacity={0.32} />
                <Stop offset="50%" stopColor={Accent.magenta} stopOpacity={0.16} />
                <Stop
                  offset="100%"
                  stopColor={colors.background}
                  stopOpacity={1}
                />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#welcome-grad)" />
          </Svg>
        </View>

        <FloatingPreview />
        <SupprMark size={44} />
        <Text
          style={{
            fontSize: 36,
            fontWeight: "800",
            letterSpacing: -1.3,
            color: colors.text,
            marginTop: 24,
            marginBottom: 12,
            lineHeight: 38,
          }}
        >
          Eat well,{"\n"}without{"\n"}overthinking it.
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.textSecondary,
            lineHeight: 22,
            maxWidth: 360,
          }}
        >
          Import recipes from the sites you already use. We&apos;ll break down
          the macros and help you hit targets that fit your life.
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          paddingTop: 12,
          backgroundColor: colors.background,
        }}
      >
        <Pressable
          onPress={() => go(1)}
          accessibilityRole="button"
          accessibilityLabel="Get started"
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 14,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0a0a0f" }}>
            Get started
          </Text>
        </Pressable>
        <Text
          style={{
            textAlign: "center",
            marginTop: 14,
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          Have an account?{" "}
          <Text style={{ color: Accent.primaryLight, fontWeight: "600" }}>
            Sign in
          </Text>
        </Text>
      </View>
    </View>
  );
}

function FloatingPreview() {
  const colors = useThemeColors();
  return (
    <View style={{ height: 140, marginBottom: Spacing.xxl }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: "8%",
          right: "35%",
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          transform: [{ rotate: "-2.4deg" }],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Ionicons name="link-outline" size={12} color={Accent.primaryLight} />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: Accent.primaryLight,
            }}
          >
            Imported
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
          Sheet-pan chicken
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
          from instagram.com
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: "20%",
          backgroundColor: Accent.success + "26",
          borderColor: Accent.success + "59",
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 11,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          transform: [{ rotate: "-1deg" }],
        }}
      >
        <Ionicons name="checkmark" size={12} color={Accent.successLight} />
        <Text
          style={{ fontSize: 11, fontWeight: "700", color: Accent.successLight }}
        >
          Matched against USDA
        </Text>
      </View>
    </View>
  );
}
