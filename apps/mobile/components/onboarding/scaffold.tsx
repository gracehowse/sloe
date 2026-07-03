import * as React from "react";
import { ScrollView, Text, View, ViewStyle, StyleProp } from "react-native";
import { Sparkles } from "lucide-react-native";
import { FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboarding } from "./context";

/**
 * Mobile scaffolding for v2 onboarding steps. Mirrors the web scaffold
 * at `src/app/components/onboarding/scaffold.tsx` so a step can be
 * read side-by-side without surprises.
 */

/** Derive the canonical step overline from context. Mirror of the
 *  web helper — same convention, same off-by-one fix. */
export function useStepOverline(): string {
  const { displayIndex, displayTotal } = useOnboarding();
  return `Step ${String(displayIndex).padStart(2, "0")} of ${displayTotal}`;
}

interface MobileStepHeaderProps {
  overline?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  compact?: boolean;
}

export function MobileStepHeader({
  overline,
  title,
  subtitle,
  compact = false,
}: MobileStepHeaderProps) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: compact ? Spacing.xl : Spacing.xxxl }}>
      {overline ? (
        // Sloe reskin (Figma onboarding parity 2026-06-07): calm
        // muted-ink overline. Clay is reserved for the footer CTA +
        // selected states (Sloe three-role colour law) — mirrors the
        // web scaffold's `text-foreground-tertiary` overline.
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1.3,
            color: colors.textTertiary,
            marginBottom: Spacing.sm,
          }}
        >
          {overline}
        </Text>
      ) : null}
      {/* Sloe reskin — step titles read in plum Newsreader serif
          (`FontFamily.serifSemibold` + `colors.navPrimary` plum heading
          ink), mirroring the web scaffold's `text-foreground-brand`
          serif heads and matching the approved Figma onboarding frames.
          `navPrimary` is theme-aware (light #3B2A4D / dark #815E91) so
          the heading stays legible in dark mode — the fixed
          `MacroColors.calories` plum would near-vanish on the dark
          page. */}
      <Text
        style={{
          fontFamily: FontFamily.serifSemibold,
          fontSize: compact ? 26 : 30,
          fontWeight: "500",
          letterSpacing: -0.4,
          color: colors.navPrimary,
          lineHeight: compact ? 32 : 36,
          margin: 0,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: Spacing.sm,
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function MobileStepBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // Scrollable so content-heavy steps (e.g. the pace screen with the
  // safety-floor warning) don't overflow with no way to reach the rest.
  // `flexGrow: 1` preserves the prior flex:1 fill for steps whose content
  // is shorter than the viewport. 2026-05-25.
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
        },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function MobileMethodologyNote({
  children,
}: {
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the methodology
  // callout's tinted fill, hairline, and sparkles glyph. The note's body text
  // keeps its own theme `textSecondary`.
  const accent = useAccent();
  return (
    <View
      style={{
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: accent.primary + "10",
        borderWidth: 1,
        borderColor: accent.primary + "26",
        borderRadius: Radius.md,
        flexDirection: "row",
        gap: Spacing.sm,
        alignItems: "flex-start",
      }}
    >
      <Sparkles
        size={14}
        color={accent.primaryLight}
        style={{ marginTop: 1 }}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 11,
          color: colors.textSecondary,
          lineHeight: 17,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
