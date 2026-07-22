import * as React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * CountBadge — numeric pill for sub-tab / segmented-track counts (ENG-1662).
 *
 * Extracted from the verbatim-duplicated badge in `SubTabPill` and
 * `SegmentedTrack` (ENG-1532). One geometry; callers pass `active` so
 * ink-on-active / border-on-inactive treatment stays consistent.
 *
 * Web mirror: `src/app/components/ui/count-badge.tsx`.
 */
export interface CountBadgeProps {
  count: number;
  /** Whether the parent segment/tab is selected. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function formatCountBadge(count: number): string {
  return count > 999 ? "999+" : String(count);
}

export function CountBadge({
  count,
  active = false,
  style,
  testID,
}: CountBadgeProps) {
  const colors = useThemeColors();
  if (count <= 0) return null;

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { backgroundColor: active ? colors.text : colors.border },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: active ? colors.primaryForeground : colors.textSecondary },
        ]}
      >
        {formatCountBadge(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
  },
});

export default CountBadge;
