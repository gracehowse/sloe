import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, FontFamily, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  type Goal,
  type PaceWarning,
} from "@/lib/onboarding";
import { useOnboarding } from "../context";
import {
  MobileMethodologyNote,
  MobileStepBody,
  MobileStepHeader,
  useStepOverline,
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
  const { state, set, targets, warning } = useOnboarding();
  const overline = useStepOverline();

  // Reset the danger acknowledgement whenever the warning reason
  // changes (Stage F decision-doc update — mirrors web Pace step).
  // Ref initialised to current reason so mount-tick is a no-op.
  const initialDangerReason =
    warning?.level === "danger" ? warning.reason : null;
  const ackResetRef = React.useRef<string | null>(initialDangerReason);
  React.useEffect(() => {
    const current = warning?.level === "danger" ? warning.reason : null;
    if (ackResetRef.current !== current) {
      ackResetRef.current = current;
      if (state.paceDangerAcknowledged) {
        set({ paceDangerAcknowledged: false });
      }
    }
  }, [warning, set, state.paceDangerAcknowledged]);
  const colors = useThemeColors();
  const goal = (state.goal ?? "lose") as Exclude<Goal, "maintain">;
  const range = PACE_RANGES[goal];
  const presets = PACE_PRESETS[goal];
  const accent = ACCENT_BY_GOAL[goal];
  const pace = state.paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];

  // Commit the visible default into state so Continue works on first
  // paint and persisted onboarding records the chosen pace.
  React.useEffect(() => {
    if (state.goal === "maintain" || state.goal === null) return;
    if (state.paceKgPerWeek === null) {
      set({ paceKgPerWeek: GOAL_DEFAULT_PACE[state.goal] });
    }
  }, [state.goal, state.paceKgPerWeek, set]);

  const projectedTarget = targets?.target ?? null;
  const sign =
    goal === "lose" || goal === "recomp"
      ? "−"
      : goal === "gain"
        ? "+"
        : "";
  const dailyMagnitude =
    targets != null ? Math.abs(targets.kcalAdj) : null;

  // Stage E — fire the soft-warn analytics event when a warning
  // banner first appears for this reason. The flow shell fires the
  // matching `advanced` variant when the user taps Continue while a
  // warning is showing. Mirrors the web Pace step's effect.
  const lastShownReasonRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!warning || projectedTarget == null) {
      lastShownReasonRef.current = null;
      return;
    }
    if (lastShownReasonRef.current === warning.reason) return;
    lastShownReasonRef.current = warning.reason;
    track(AnalyticsEvents.onboarding_pace_below_safety_floor, {
      acted: "shown",
      level: warning.level,
      reason: warning.reason,
      pace_kg_per_week: pace,
      projected_target_kcal: projectedTarget,
      sex: state.sex,
    });
  }, [warning, projectedTarget, pace, state.sex]);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
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
          {/* Sloe reskin (Figma pace 191:2): rate hero numeral in the
              Newsreader serif display face + plum heading ink, mirroring
              the web pace numeral. */}
          <Text
            style={{
              fontFamily: FontFamily.serifRegular,
              fontSize: 34,
              fontWeight: "400",
              letterSpacing: -0.6,
              color: colors.navPrimary,
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
            {/* SLOE Phase 0: the Daily-target hero numeral reads in Newsreader
                serif (matching the 34px rate numeral above + the web pace
                tile). Family carries the weight; the `kcal` unit stays sans. */}
            <Text
              style={{
                fontFamily: FontFamily.serifRegular,
                fontSize: 22,
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
            {/* SLOE Phase 0: the vs-TDEE hero numeral reads in Newsreader serif
                (family carries the weight; the `kcal / day` unit stays sans). */}
            <Text
              style={{
                fontFamily: FontFamily.serifRegular,
                fontSize: 22,
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

      {warning ? (
        <PaceWarningBanner
          warning={warning}
          acknowledged={state.paceDangerAcknowledged}
          onAcknowledgeChange={(v) => set({ paceDangerAcknowledged: v })}
        />
      ) : null}

      <MobileMethodologyNote>
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors
        reference NIH/NHS guidance. Sloe is not a substitute for medical
        advice — consult your doctor before any significant dietary change,
        especially if you&apos;re pregnant, under 18, or managing a medical
        condition.
      </MobileMethodologyNote>
    </MobileStepBody>
  );
}

function PaceWarningBanner({
  warning,
  acknowledged,
  onAcknowledgeChange,
}: {
  warning: PaceWarning;
  acknowledged: boolean;
  onAcknowledgeChange: (next: boolean) => void;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the lowest-severity
  // `info` banner only — it's styled in the brand accent, not a status colour.
  // The `danger` / `warn` levels keep their dedicated `Accent.destructive` /
  // `Accent.warning` status hues regardless of the Frost flag, as does the
  // danger acknowledgement checkbox below.
  const accent = useAccent();
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
      bg: accent.primary + "1a",
      border: accent.primary + "59",
      accent: accent.primaryLight,
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
        {warning.level === "danger" ? (
          <Pressable
            onPress={() => onAcknowledgeChange(!acknowledged)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            accessibilityLabel="I understand and accept responsibility for proceeding below the safety floor"
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: acknowledged
                  ? Accent.destructive
                  : colors.cardBorder,
                backgroundColor: acknowledged
                  ? Accent.destructive
                  : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              {acknowledged ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : null}
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: colors.text,
                lineHeight: 17,
              }}
            >
              I understand this is below the recommended safety floor
              and accept responsibility for proceeding.
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
