import * as React from "react";
import { Spacing, Type } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboarding } from "../context";
import { MobileNumberStepper } from "../number-stepper";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * Mobile Age step.
 *
 * 2026-05-12 (premium-bar audit DC7 polish): mirrors the Sex step's
 * "Which one should I choose?" disclosure pattern with a "How does
 * age affect my target?" expander. The Mifflin-St Jeor coefficient
 * for age is small but non-zero (~5 kcal/year subtracted from BMR);
 * the expander surfaces that math + the "we re-calibrate from your
 * actual logs" reassurance so a user worried the number is a hard
 * cap reads the truth before tap.
 */
export function MobileAgeStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const colors = useThemeColors();
  const [helpOpen, setHelpOpen] = React.useState(false);
  // Secondary accent (Frost flag → damson, else clay) for the help-toggle glyph
  // and the expanded explainer's tinted box + overline. The number stepper keeps
  // its own neutral chrome.
  const accent = useAccent();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="How old are you?"
        subtitle="Metabolic rate drops ~1% per decade after 20 — we'll factor that in."
      />
      <View style={{ alignItems: "center", marginTop: 20 }}>
        <MobileNumberStepper
          value={state.age}
          onChange={(v) => set({ age: v })}
          min={14}
          max={100}
          suffix="years"
          big
          ariaLabel="Age"
        />
      </View>

      {/* Inclusive explainer expander — DC7 polish, mirror of Sex step. */}
      <Pressable
        onPress={() => setHelpOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: helpOpen }}
        style={{
          marginTop: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={accent.primaryLight}
        />
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            textDecorationLine: "underline",
          }}
        >
          How does age affect my target?
        </Text>
      </Pressable>

      {helpOpen ? (
        <View
          style={{
            marginTop: Spacing.dense,
            padding: Spacing.md,
            backgroundColor: accent.primary + "10",
            borderColor: accent.primary + "33",
            borderWidth: 1,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: accent.primaryLight,
              marginBottom: 8,
            }}
          >
            What Sloe does with this
          </Text>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.text,
              lineHeight: 18,
              marginBottom: Spacing.sm,
            }}
          >
            The Mifflin-St Jeor equation subtracts about 5 kcal/year from
            your estimated BMR — so a 25-year-old and a 45-year-old at the
            same weight + height get targets ~100 kcal apart.
          </Text>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.text,
              lineHeight: 18,
              marginBottom: Spacing.sm,
            }}
          >
            This is an estimate, not a verdict on your metabolism. Sloe
            adaptive-TDEE will re-calibrate from your actual logged
            intake + weight changes after ~2 weeks, replacing the formula
            with your real maintenance.
          </Text>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            You can change your age (or any other plan input) anytime
            from Settings.
          </Text>
        </View>
      ) : null}
    </MobileStepBody>
  );
}
