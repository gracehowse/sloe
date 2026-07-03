import * as React from "react";
import { Radius, Spacing, Type } from "@/constants/theme";
import { Pressable, Text, TextInput, View } from "react-native";
import { Info, ShieldCheck } from "lucide-react-native";
import { OptionCard } from "@/components/OptionCard";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { Sex } from "@/lib/tdee";
import { isFeatureEnabled } from "@/lib/analytics";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

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
    subtitle: "Uses a midpoint estimate (~166 kcal between sexes).",
  },
];

export function MobileSexStep() {
  const { state, set, go } = useOnboarding();
  const overline = useStepOverline();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const genderFieldEnabled = isFeatureEnabled("onboarding_gender_field_v1");
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the help-toggle glyph
  // and the expanded explainer's tinted box + overline. The OptionCards flip via
  // their own `useAccent`; the privacy-shield footer keeps `textTertiary`.
  const accent = useAccent();
  // 2026-05-14 (premium-bar audit B cross-cutting #6): auto-advance
  // after 200ms when the user picks a sex. Same pattern as Goal +
  // Activity — single-choice steps should never strand the user
  // hunting for Continue when the tap itself was the answer.
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    [],
  );
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Sex"
        subtitle="Used to estimate your metabolic rate. You can change this anytime."
      />
      <View style={{ gap: Spacing.dense }}>
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.id ?? "u"}
            compact
            selected={state.sex === o.id}
            onPress={() => {
              if (state.sex === o.id) return;
              set({ sex: o.id });
              if (advanceTimerRef.current) {
                clearTimeout(advanceTimerRef.current);
              }
              advanceTimerRef.current = setTimeout(() => {
                go(1);
              }, 200);
            }}
            title={o.title}
            subtitle={o.subtitle}
          />
        ))}
      </View>

      {genderFieldEnabled ? (
        <View
          style={{
            marginTop: Spacing.md,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.xl,
            backgroundColor: colors.card,
          }}
        >
          <Text
            style={{
              ...Type.body,
              color: colors.text,
            }}
          >
            Pronouns or gender (optional)
          </Text>
          <Text
            style={{
              marginTop: Spacing.xs,
              marginBottom: Spacing.dense,
              ...Type.captionStrong,
              color: colors.textSecondary,
            }}
          >
            This is for how Sloe refers to you — it never changes your metabolic
            estimate.
          </Text>
          <TextInput
            value={state.pronouns}
            onChangeText={(pronouns) => set({ pronouns })}
            placeholder="e.g. she/her, they/them, non-binary"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: Radius.lg,
              paddingHorizontal: Spacing.dense,
              paddingVertical: Spacing.sm,
              color: colors.text,
              backgroundColor: colors.background,
              ...Type.body,
            }}
          />
        </View>
      ) : null}

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
        <Info size={14} color={accent.primaryLight} />
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
            marginTop: Spacing.dense,
            padding: Spacing.md,
            backgroundColor: accent.primary + "10",
            borderColor: accent.primary + "33",
            borderWidth: 1,
            borderRadius: Radius.xl,
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
            The Mifflin-St Jeor equation uses different coefficients for male
            and female metabolic rate — the difference is about 166 kcal/day.
          </Text>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.text,
              lineHeight: 18,
              marginBottom: Spacing.sm,
            }}
          >
            If you&apos;re trans, non-binary, or gender non-conforming:
            there&apos;s no perfect answer here. If you haven&apos;t started
            gender-affirming hormones, your sex assigned at birth is usually the
            closer estimate. After several months on hormones, body composition
            shifts and the other coefficient may begin to fit better — but
            evidence is limited. Pick what feels right, or choose &ldquo;Prefer
            not to say&rdquo; for the midpoint.
          </Text>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            For best results, consult your doctor. You can change this at any
            time — Sloe also re-calibrates from your actual logs.
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
        <ShieldCheck size={12} color={colors.textTertiary} />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            color: colors.textTertiary,
            lineHeight: 17,
          }}
        >
          Stored privately on your device and synced only to your Sloe account.
          Never shared.
        </Text>
      </View>
    </MobileStepBody>
  );
}
