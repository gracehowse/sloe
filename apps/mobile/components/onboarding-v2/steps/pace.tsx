import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  type Goal,
  type PaceWarning,
} from "@/lib/onboarding-v2";
import { useOnboardingV2 } from "../context";
import {
  MobileMethodologyNote,
  MobileStepBody,
  MobileStepHeader,
} from "../scaffold";
import { MobileMiniSlider } from "../slider";

/**
 * Mobile Pace step. Mirrors the web Pace step — soft-warn safety
 * floor banner, never disables Continue. Decision doc is the single
 * source of truth.
 *
 * Slider is `MobileMiniSlider` (built on react-native-gesture-handler,
 * already a project dep) so we don't pull in
 * @react-native-community/slider for one screen.
 */

const ACCENT_BY_GOAL: Record<Exclude<Goal, "maintain">, string> = {
  lose: MacroColors.fat,
  gain: MacroColors.protein,
  recomp: MacroColors.carbs,
};

export function MobilePaceStep() {
  const { state, set, targets, warning } = useOnboardingV2();
  const colors = useThemeColors();
  const goal = (state.goal ?? "lose") as Exclude<Goal, "maintain">;
  const range = PACE_RANGES[goal];
  const presets = PACE_PRESETS[goal];
  const accent = ACCENT_BY_GOAL[goal];
  const pace = state.paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];

  const projectedTarget = targets?.target ?? null;
  const sign =
    goal === "lose" || goal === "recomp"
      ? "−"
      : goal === "gain"
        ? "+"
        : "";
  const dailyMagnitude =
    targets != null ? Math.abs(targets.kcalAdj) : null;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 09 of 12"
        title={
          goal === "gain"
            ? "How fast should we gain?"
            : goal === "recomp"
              ? "How fast should we recomp?"
              : "How fast should we lose?"
        }
        subtitle="Slower is easier to sustain; faster asks more of you. You can change this anytime."
        compact
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {presets.map((p) => {
          const active = Math.abs(pace - p.value) < range.step * 0.6;
          return (
            <Pressable
              key={p.value}
              onPress={() => set({ paceKgPerWeek: p.value })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: 8,
                paddingVertical: 10,
                borderRadius: Radius.md - 2,
                backgroundColor: active ? accent + "26" : colors.inputBg,
                borderWidth: 1.5,
                borderColor: active ? accent : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                  letterSpacing: -0.2,
                }}
              >
                {p.label}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textSecondary,
                  marginTop: 2,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {p.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: Radius.lg,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.textTertiary,
            marginBottom: 4,
          }}
        >
          Rate
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text
            style={{
              fontSize: 34,
              fontWeight: "800",
              letterSpacing: -1,
              color: colors.text,
              fontVariant: ["tabular-nums"],
              lineHeight: 38,
              includeFontPadding: false,
            }}
          >
            {pace.toFixed(pace < 0.1 ? 3 : 2)}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            kg / week
          </Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <MobileMiniSlider
            value={pace}
            onChange={(v) => set({ paceKgPerWeek: v })}
            min={range.min}
            max={range.max}
            step={range.step}
            accent={accent}
            ariaLabel="Weekly rate"
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: colors.textTertiary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {range.min} kg / wk
          </Text>
          <Text
            style={{
              fontSize: 10,
              color: colors.textTertiary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {range.max} kg / wk
          </Text>
        </View>
      </View>

      {projectedTarget != null && dailyMagnitude != null ? (
        <View
          style={{
            marginTop: 14,
            padding: Spacing.md + 2,
            borderRadius: Radius.md,
            borderWidth: 1,
            backgroundColor: accent + "1f",
            borderColor: accent + "66",
            flexDirection: "row",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textTertiary,
                marginBottom: 4,
              }}
            >
              Daily target
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: colors.text,
                fontVariant: ["tabular-nums"],
                letterSpacing: -0.5,
              }}
            >
              {projectedTarget.toLocaleString()}
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  fontWeight: "500",
                }}
              >
                {" "}
                kcal
              </Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textTertiary,
                marginBottom: 4,
              }}
            >
              vs. your TDEE
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: accent,
                fontVariant: ["tabular-nums"],
                letterSpacing: -0.5,
              }}
            >
              {sign}
              {dailyMagnitude.toLocaleString()}
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  fontWeight: "500",
                }}
              >
                {" "}
                kcal / day
              </Text>
            </Text>
          </View>
        </View>
      ) : null}

      {warning ? <PaceWarningBanner warning={warning} /> : null}

      <MobileMethodologyNote>
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors
        reference NIH/NHS guidance. Suppr is not a substitute for medical
        advice — consult your doctor before any significant dietary change,
        especially if you&apos;re pregnant, under 18, or managing a medical
        condition.
      </MobileMethodologyNote>
    </MobileStepBody>
  );
}

function PaceWarningBanner({ warning }: { warning: PaceWarning }) {
  const colors = useThemeColors();
  const config = {
    danger: {
      bg: "rgba(217,69,69,0.18)",
      border: "rgba(217,69,69,0.55)",
      accent: Accent.destructive,
      icon: "alert-circle-outline" as const,
    },
    warn: {
      bg: "rgba(232,148,45,0.18)",
      border: "rgba(232,148,45,0.55)",
      accent: Accent.warning,
      icon: "warning-outline" as const,
    },
    info: {
      bg: Accent.primary + "1a",
      border: Accent.primary + "59",
      accent: Accent.primaryLight,
      icon: "information-circle-outline" as const,
    },
  }[warning.level];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={warning.title}
      style={{
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: config.bg,
        borderColor: config.border,
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: config.accent + "40",
          marginTop: 1,
        }}
      >
        <Ionicons name={config.icon} size={15} color={config.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.2,
            marginBottom: 3,
          }}
        >
          {warning.title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            lineHeight: 18,
          }}
        >
          {warning.body}
        </Text>
      </View>
    </View>
  );
}
