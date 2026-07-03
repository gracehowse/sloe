import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Clock, Lock, type LucideIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Accent, FontFamily, Spacing } from "@/constants/theme";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useOnboarding } from "../context";
import { ProgressiveText } from "../ProgressiveText";

/**
 * Mobile Welcome — v3 prototype `.ob--brand` welcome (ENG-1247, 2026-06-24):
 * a deep-plum brand ground with a soft radial bloom behind the lowercase
 * Fraunces "sloe" wordmark, an italic serif tagline, a light "Get started"
 * CTA, and a "Private by default · About a minute" trust footer. This is a
 * fixed brand screen (the plum identity is the same in light + dark), so it
 * does NOT theme-resolve. Supersedes the pre-v3 sage→magenta gradient + light
 * preview tiles. Tagline copy kept ("Still reach your goals", Grace's call).
 * Web twin: `src/app/components/onboarding/steps/welcome.tsx`.
 */
export function MobileWelcomeStep() {
  const { go, displayIndex, displayTotal } = useOnboarding();
  const router = useRouter();
  // ENG-720 — staggered reveal on the wordmark + tagline beat, behind the
  // default-OFF `onboarding_progressive_text` flag. `ProgressiveText` itself
  // also gates on Reduce Motion; flag-OFF or reduce-motion → instant text.
  const progressiveText = isFeatureEnabled("onboarding_progressive_text");
  return (
    <View style={{ flex: 1, backgroundColor: Accent.primaryDeep }}>
      {/* Soft radial bloom behind the wordmark (prototype `.ob--brand::before`). */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="ob-welcome-bloom" cx="50%" cy="38%" r="58%">
              <Stop offset="0%" stopColor={Accent.primaryLight} stopOpacity={0.42} />
              <Stop offset="55%" stopColor={Accent.primary} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={Accent.primaryDeep} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ob-welcome-bloom)" />
        </Svg>
      </View>

      {/* Centered brand block — wordmark + italic tagline. */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <ProgressiveText
          animate={progressiveText}
          accessibilityRole="header"
          accessibilityLabel="Sloe"
          style={{
            fontFamily: FontFamily.brand,
            fontSize: 56,
            fontWeight: "300",
            letterSpacing: -0.5,
            lineHeight: 60,
            color: Accent.primaryForeground,
          }}
        >
          sloe
        </ProgressiveText>
        <ProgressiveText
          animate={progressiveText}
          style={{
            fontFamily: FontFamily.serifItalic,
            fontStyle: "italic",
            fontSize: 18,
            lineHeight: 25,
            textAlign: "center",
            color: Accent.frost,
            marginTop: Spacing.md,
            maxWidth: 300,
          }}
        >
          Cook what you love. Still reach your goals.
        </ProgressiveText>
      </View>

      {/* Bottom CTA + trust footer. */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: Spacing.dense }}>
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
            backgroundColor: Accent.primaryForeground,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: Accent.primaryDeep }}>
            Get started
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          hitSlop={12}
          style={({ pressed }) => ({
            marginTop: Spacing.md,
            alignSelf: "stretch",
            paddingVertical: 10,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 14,
              color: Accent.frost,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            I already have an account
          </Text>
        </Pressable>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: Spacing.md,
            marginTop: Spacing.sm,
          }}
        >
          <TrustItem icon={Lock} label="Private by default" />
          <TrustItem icon={Clock} label="About a minute" />
        </View>
      </View>
    </View>
  );
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon size={12} color={Accent.frost} />
      <Text style={{ fontSize: 13, color: Accent.frost, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}
