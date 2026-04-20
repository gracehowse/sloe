import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { Sex } from "@/lib/tdee";
import { useOnboardingV2 } from "../context";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

/**
 * Mobile Sex step. Locks in the inclusive copy from
 * `docs/decisions/2026-04-19-onboarding-redesign-scope.md` (pending
 * `diversity-inclusion` sign-off in Stage F). Mirrors the web copy so
 * a side-by-side review reads identically.
 */

const OPTIONS: { id: Sex; title: string; subtitle?: string }[] = [
  { id: "female", title: "Female" },
  { id: "male", title: "Male" },
  {
    id: "unspecified",
    title: "Prefer not to say",
    subtitle: "Uses the male/female midpoint",
  },
];

export function MobileSexStep() {
  const { state, set } = useOnboardingV2();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const colors = useThemeColors();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 04 of 12"
        title="Sex"
        subtitle="Please select which sex we should use to calculate your calorie needs."
      />
      <View style={{ gap: 10 }}>
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.id ?? "u"}
            compact
            selected={state.sex === o.id}
            onPress={() => set({ sex: o.id })}
            title={o.title}
            subtitle={o.subtitle}
          />
        ))}
      </View>

      <Pressable
        onPress={() => setHelpOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: helpOpen }}
        style={{
          marginTop: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={Accent.primaryLight}
        />
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            textDecorationLine: "underline",
          }}
        >
          Which one should I choose?
        </Text>
      </Pressable>

      {helpOpen ? (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            backgroundColor: Accent.primary + "10",
            borderColor: Accent.primary + "33",
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
              color: Accent.primaryLight,
              marginBottom: 8,
            }}
          >
            What Suppr does with this
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.text,
              lineHeight: 18,
              marginBottom: 10,
            }}
          >
            The Mifflin-St Jeor equation uses different coefficients for male
            and female metabolic rate — the difference is about 166 kcal/day.
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.text,
              lineHeight: 18,
              marginBottom: 10,
            }}
          >
            If you&apos;re trans, non-binary, or gender non-conforming: if you
            haven&apos;t started gender-affirming hormones, selecting your sex
            assigned at birth will most accurately reflect your metabolic
            rate. If you&apos;ve been on hormones for more than a few months,
            your metabolism may be closer to your gender identity.
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            For best results, consult your doctor. You can change this at any
            time — Suppr also re-calibrates from your actual logs.
          </Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-start",
          paddingTop: 16,
        }}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={12}
          color={colors.textTertiary}
        />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            color: colors.textTertiary,
            lineHeight: 17,
          }}
        >
          Stored privately on your device and synced only to your Suppr
          account. Never shared.
        </Text>
      </View>
    </MobileStepBody>
  );
}
