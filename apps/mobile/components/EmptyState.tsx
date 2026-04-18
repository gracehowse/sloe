import * as React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile `<EmptyState />` — RN mirror of web
 * `src/app/components/suppr/empty-state.tsx` (audit M5, 2026-04-18).
 *
 * Prop contract mirrors the web primitive:
 *  - `icon`: optional slot (usually an `<Ionicons />`).
 *  - `title`: short title — typically a plain string, but accepts any
 *    React node so callers can preserve existing inline emphasis.
 *  - `description`: optional multi-sentence factual description.
 *  - `action`: optional action node (usually a `Pressable`).
 *
 * Copy stays at the call site — the component enforces no rules beyond
 * a factual, non-shame voice.
 */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  style?: ViewStyle;
  /** Optional override for the title text style (e.g. for callers that
   *  need a different size). Applied after the default style. */
  titleStyle?: TextStyle;
  /** Optional override for the description text style. */
  descriptionStyle?: TextStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
  titleStyle,
  descriptionStyle,
}: EmptyStateProps) {
  const colors = useThemeColors();
  const isStringTitle = typeof title === "string";
  const isStringDescription = typeof description === "string";
  return (
    <View style={[styles.container, style]} accessibilityRole="summary">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {isStringTitle ? (
        <Text
          style={[
            styles.title,
            { color: colors.text },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.titleWrap}>{title}</View>
      )}
      {description ? (
        isStringDescription ? (
          <Text
            style={[
              styles.description,
              { color: colors.textSecondary },
              descriptionStyle,
            ]}
          >
            {description}
          </Text>
        ) : (
          <View style={styles.descriptionWrap}>{description}</View>
        )
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: 6,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  titleWrap: {
    alignItems: "center",
  },
  description: {
    fontSize: 12,
    textAlign: "center",
  },
  descriptionWrap: {
    alignItems: "center",
  },
  action: {
    marginTop: 4,
  },
});

export default EmptyState;
