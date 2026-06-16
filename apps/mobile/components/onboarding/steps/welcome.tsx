import * as React from "react";
import { Pressable, Text, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Accent, FontFamily, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
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
  const { go, displayIndex, displayTotal } = useOnboarding();
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
          paddingBottom: Spacing.xxl,
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
                <Stop offset="0%" stopColor={Accent.success} stopOpacity={gradTopOpacity} />
                <Stop offset="50%" stopColor={Accent.magenta} stopOpacity={gradMidOpacity * 0.75} />
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
        {/* Sloe reskin (Figma welcome 285:2): cold-open hero headline in
            plum Newsreader serif (`FontFamily.serifRegular` +
            `colors.navPrimary` theme-aware plum), matching the
            warm-coaching brand + the web welcome treatment. Copy moves to
            the Sloe positioning line. */}
        <Text
          style={{
            fontFamily: FontFamily.serifRegular,
            fontSize: 38,
            fontWeight: "400",
            letterSpacing: -0.8,
            color: colors.navPrimary,
            marginTop: 24,
            marginBottom: Spacing.dense,
            lineHeight: 42,
          }}
        >
          Eat well,{"\n"}on your terms.
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.textSecondary,
            lineHeight: 22,
            maxWidth: 360,
          }}
        >
          Cook what you love and still hit your goals. Import recipes from the
          sites you already use — Sloe breaks down the macros and calibrates
          targets to you.
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          paddingTop: Spacing.dense,
          backgroundColor: colors.background,
        }}
      >
        {/* 2026-05-14 (premium-sweep-v2 row 10.1): removed the
            "Join thousands tracking smarter" proof line that B1 #1
            had added above the primary CTA. Unsubstantiated claim
            (N=1 tester today), and DC12 calm voice rejects
            unsubstantiated growth puffery. */}
        <Pressable
          onPress={() => {
            track(AnalyticsEvents.onboarding_step_completed, {
              step_id: "welcome",
              step_index: displayIndex,
              step_total: displayTotal,
              platform: "mobile",
            });
            go(1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Get started"
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 999,
            backgroundColor: colors.tint,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryForeground }}>
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
            marginTop: Spacing.md,
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
            Already have an account? <Text style={{ color: colors.tint, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FloatingPreview() {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the decorative
  // "Example" import-card chip. The USDA-nutrition pill keeps `Accent.success*`
  // (green status), and the hero gradient keeps its own `Accent.success` /
  // `Accent.magenta` brand stops. NOTE: the "Get started" CTA + "Sign in" link
  // read `colors.tint` (the theme-token layer), not `Accent.primary`, so they
  // are out of `useAccent()`'s scope and stay on the theme tint.
  const accent = useAccent();
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
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.dense,
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
            marginBottom: Spacing.sm,
          }}
        >
          <Ionicons name="link-outline" size={12} color={accent.primaryLight} />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: accent.primaryLight,
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
          paddingHorizontal: Spacing.dense,
          paddingVertical: Spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
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
