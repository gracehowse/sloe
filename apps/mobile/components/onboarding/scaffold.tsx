import * as React from "react";
import { Text, View, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
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
    <View style={{ marginBottom: compact ? Spacing.xl : Spacing.xxl + 4 }}>
      {overline ? (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1.1,
            color: Accent.primaryLight,
            marginBottom: 10,
          }}
        >
          {overline}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: compact ? 24 : 28,
          fontWeight: "700",
          letterSpacing: -0.6,
          color: colors.text,
          lineHeight: compact ? 30 : 34,
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
            marginTop: 8,
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
  return (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function MobileMethodologyNote({
  children,
}: {
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Accent.primary + "10",
        borderWidth: 1,
        borderColor: Accent.primary + "26",
        borderRadius: Radius.md,
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <Ionicons
        name="sparkles-outline"
        size={14}
        color={Accent.primaryLight}
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
