import * as React from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprMark } from "@/components/SupprMark";
import { useOnboarding } from "../context";

/**
 * Mobile Welcome — full-bleed hero with the brand gradient. Mirrors
 * the web Welcome at `src/app/components/onboarding/steps/welcome.tsx`.
 *
 * Uses react-native-svg's LinearGradient (already a project dep) so we
 * don't pull in expo-linear-gradient just for this one screen.
 */

export function MobileWelcomeStep() {
  const { go } = useOnboarding();
  const colors = useThemeColors();
  const router = useRouter();
  // 2026-05-14 (premium-bar audit B1 #2): dampen the brand-gradient
  // wash by 50% in dark mode. The full-strength stops blew out against
  // the near-black background and washed the headline. Light mode keeps
  // the original strength because the page bg balances it.
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const gradTopOpacity = isDark ? 0.16 : 0.32;
  const gradMidOpacity = isDark ? 0.08 : 0.16;
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
                <Stop offset="0%" stopColor={Accent.primary} stopOpacity={gradTopOpacity} />
                <Stop offset="50%" stopColor={Accent.magenta} stopOpacity={gradMidOpacity} />
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
        {/* 2026-05-14 (premium-sweep-v2 row 10.1): removed the
            "Join thousands tracking smarter" proof line that B1 #1
            had added above the primary CTA. Unsubstantiated claim
            (N=1 tester today), and DC12 calm voice rejects
            unsubstantiated growth puffery. */}
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
          <Text style={{ fontSize: 16, fontWeight: "700", color: Accent.primaryForeground }}>
            Get started
          </Text>
        </Pressable>
        {/* 2026-05-14 (premium-sweep-v2 row 10.2): demoted the
            standalone outlined "Sign in" button (added in B1 #3) to a
            smaller text link at the bottom of the viewport, matching
            Cal AI's affordance pattern. The outlined button competed
            visually with the primary "Get started" CTA at cold-open,
            splitting the call to action between two equal-weight
            buttons. Still tappable, still readable, no longer
            competing. */}
        <Pressable
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="Sign in to existing account"
          hitSlop={12}
          style={({ pressed }) => ({
            marginTop: 16,
            alignSelf: "center",
            paddingVertical: 8,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            Already have an account? <Text style={{ color: Accent.primary, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FloatingPreview() {
  const colors = useThemeColors();
  return (
    <View style={{ height: 140, marginBottom: Spacing.xxl }}>
      {/*
        Decorative preview tiles. P1 (customer-lens 2026-05-11):
        re-labelled so a first-time user doesn't read these as real
        product state. The "Imported" past-tense + "Matched against
        USDA" past-tense made it look as if Suppr had already done
        something on their behalf. New copy is present-tense
        aspirational + the wrapper is opacity-dimmed so it visibly
        reads as an illustration.
      */}
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
          opacity: 0.85,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
            Example
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
          opacity: 0.85,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name="nutrition-outline" size={12} color={Accent.successLight} />
        <Text
          style={{ fontSize: 11, fontWeight: "700", color: Accent.successLight }}
        >
          USDA-backed nutrition
        </Text>
      </View>
    </View>
  );
}
