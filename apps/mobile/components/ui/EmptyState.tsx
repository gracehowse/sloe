import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile `<EmptyState>` — universal, production design spec §Part 3
 * "New components". Mirror of `src/app/components/ui/empty-state.tsx`.
 *
 * Distinct from the older `apps/mobile/components/EmptyState.tsx`,
 * which uses `description` + `action` and is still in widespread use.
 * Phase 1 ships this primitive without sweeping callers; Phase 2 will
 * migrate.
 */

export interface UniversalEmptyStateProps {
  /** Lucide / custom icon node. Rendered ~24pt, muted. */
  icon?: React.ReactNode;
  /** Short title. */
  title: React.ReactNode;
  /** Multi-sentence body copy. Optional. */
  body?: React.ReactNode;
  /** Primary CTA node — usually a `Pressable` button. */
  primaryCta?: React.ReactNode;
  /** Secondary CTA node — usually a ghost button. */
  secondaryCta?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  body,
  primaryCta,
  secondaryCta,
  style,
  testID,
}: UniversalEmptyStateProps) {
  const colors = useThemeColors();
  const isStringTitle = typeof title === "string";
  const isStringBody = typeof body === "string";

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[styles.container, style]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {isStringTitle ? (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      ) : (
        <View style={styles.titleWrap}>{title}</View>
      )}
      {body ? (
        isStringBody ? (
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {body}
          </Text>
        ) : (
          <View style={styles.bodyWrap}>{body}</View>
        )
      ) : null}
      {primaryCta || secondaryCta ? (
        <View style={styles.ctaRow}>
          {primaryCta}
          {secondaryCta}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    ...Type.headline,
    textAlign: "center",
  },
  titleWrap: {
    alignItems: "center",
  },
  body: {
    ...Type.body,
    textAlign: "center",
    maxWidth: 320,
  },
  bodyWrap: {
    alignItems: "center",
  },
  ctaRow: {
    marginTop: 8,
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
});

export default EmptyState;
