import * as React from "react";
import {
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { useOnboardingV2 } from "./context";
import { MOBILE_STEP_COMPONENTS } from "./steps";

/**
 * Mobile flow shell — full-screen stack of step views with a top bar
 * (back + progress + counter) and a footer Continue button. Welcome
 * takes the whole canvas; every other step uses the shell.
 *
 * Mirrors the web shell at
 * `src/app/components/onboarding-v2/web-flow.tsx`. No narrative
 * column on mobile by design — the iPhone safe area can't carry it.
 */

export function MobileFlow() {
  const {
    currentStepId,
    displayIndex,
    displayTotal,
    go,
    canAdvance,
    state,
    targets,
    warning,
  } = useOnboardingV2();
  const colors = useThemeColors();
  const StepComponent = MOBILE_STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";

  // Stage E — fire the soft-warn `advanced` analytics event when the
  // user taps Continue from the Pace step while a warning is showing.
  // The matching `shown` event fires from inside MobilePaceStep on
  // banner mount/reason change.
  const handleContinue = React.useCallback(() => {
    if (currentStepId === "pace" && warning && targets) {
      track(AnalyticsEvents.onboarding_pace_below_safety_floor, {
        acted: "advanced",
        level: warning.level,
        reason: warning.reason,
        pace_kg_per_week: targets.pace,
        projected_target_kcal: targets.target,
        sex: state.sex,
        // Stage F (legal-reviewer sign-off) — only the danger level
        // requires the acknowledgement checkbox.
        acknowledged:
          warning.level === "danger"
            ? state.paceDangerAcknowledged
            : null,
      });
    }
    go(1);
  }, [
    currentStepId,
    warning,
    targets,
    state.sex,
    state.paceDangerAcknowledged,
    go,
  ]);

  // Welcome uses its own layout (full-bleed gradient, own CTA).
  if (isWelcome) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" />
        <StepComponent />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View
        style={{
          paddingTop: Platform.OS === "ios" ? 54 : 16,
          paddingBottom: 14,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <Pressable
            onPress={() => go(-1)}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>

          <ProgressBar value={displayIndex} total={displayTotal} />

          <Text
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              letterSpacing: 0.2,
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {displayIndex}/{displayTotal}
          </Text>
        </View>
      </View>

      {/* Step body — scrolls independently */}
      <View style={{ flex: 1 }}>
        <StepComponent compact />
      </View>

      {/* Footer Continue */}
      <View
        style={{
          paddingHorizontal: Spacing.xl,
          paddingTop: 14,
          paddingBottom: Platform.OS === "ios" ? 38 : 24,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: "transparent",
        }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!canAdvance}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !canAdvance }}
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 14,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: !canAdvance ? 0.4 : pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0a0a0f" }}>
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const colors = useThemeColors();
  const pct = Math.max(4, (value / Math.max(1, total)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: value, min: 0, max: total }}
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.inputBg,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 2,
          backgroundColor: Accent.primary,
        }}
      />
    </View>
  );
}
