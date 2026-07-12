import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CalendarPlus, Copy, Sunrise } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/** ENG-1247 — LogHub quick-action descriptor. Each entry is optional; the
 *  host omits an action when it isn't resolvable (no saved meals →
 *  `logUsual` undefined, yesterday empty → `copyYesterday` undefined, today
 *  empty → `duplicateDay` undefined) so the row renders no dead buttons. */
export type LogHubQuickActionsProps = {
  logUsual?: { mealName: string; onTap: () => void };
  copyYesterday?: { count: number; onTap: () => void };
  duplicateDay?: { onTap: () => void };
};

/**
 * v3 LogHub quick-action row — `Log {usual} / Copy yesterday / Duplicate day`.
 * Renders ONLY the actions whose handlers the host threaded (no dead
 * buttons). When every action is absent the row renders nothing. Mirror of
 * the web `LogHubQuickActions` in
 * `src/app/components/suppr/log-hub-quick-actions.tsx`.
 */
export function LogHubQuickActions({
  quickActions,
}: {
  quickActions: LogHubQuickActionsProps;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const { logUsual, copyYesterday, duplicateDay } = quickActions;

  const actions: {
    key: "log-usual" | "copy-yesterday" | "duplicate-day";
    label: string;
    a11yLabel: string;
    Icon: typeof Sunrise;
    onTap: () => void;
  }[] = [];
  if (logUsual) {
    const label = `Log ${logUsual.mealName}`;
    actions.push({
      key: "log-usual",
      label,
      a11yLabel: label,
      Icon: Sunrise,
      onTap: logUsual.onTap,
    });
  }
  if (copyYesterday) {
    actions.push({
      key: "copy-yesterday",
      label: "Copy yesterday",
      a11yLabel:
        copyYesterday.count === 1
          ? "Copy yesterday's 1 meal to today"
          : `Copy yesterday's ${copyYesterday.count} meals to today`,
      Icon: Copy,
      onTap: copyYesterday.onTap,
    });
  }
  if (duplicateDay) {
    actions.push({
      key: "duplicate-day",
      label: "Duplicate day",
      a11yLabel: "Duplicate today to another day",
      Icon: CalendarPlus,
      onTap: duplicateDay.onTap,
    });
  }

  if (actions.length === 0) return null;

  return (
    <View style={styles.loghubQuickRow} testID="loghub-quick-actions">
      {actions.map(({ key, label, a11yLabel, Icon, onTap }) => (
        <PressableScale
          key={key}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          testID={`loghub-quick-${key}`}
          onPress={onTap}
          style={[
            styles.loghubQuickButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Icon size={16} color={accent.primary} strokeWidth={2} />
          <Text
            numberOfLines={1}
            // ENG-1529 — F-36 Dynamic Type clamp: compact quick-action pill;
            // the full a11yLabel is read uncapped by VoiceOver.
            maxFontSizeMultiplier={1.2}
            style={[Type.captionStrong, styles.loghubQuickLabel, { color: colors.text }]}
          >
            {label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // ENG-1247 — LogHub quick-action row. Matches the v3 prototype
  // `.loghub-quick`: equal-width card pills, 8px gap, 12-radius, inset to
  // the sheet's 16px gutter. Tokens only.
  loghubQuickRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.dense,
  },
  loghubQuickButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.dense,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loghubQuickLabel: {
    flexShrink: 1,
  },
});
