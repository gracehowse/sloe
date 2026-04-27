import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile `<ConfidenceChip>` — production design spec §1.6.
 *
 * Neutral grey pill used for adaptive TDEE display
 * (D-2026-04-27-12). NOT a warning state. Three levels.
 * Mirror: `src/app/components/ui/confidence-chip.tsx`.
 */

export type ConfidenceChipLevel = "low" | "medium" | "high";

export interface ConfidenceChipProps {
  level: ConfidenceChipLevel;
  /** Optional label override. Defaults to "{level} confidence". */
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

const labelText: Record<ConfidenceChipLevel, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function ConfidenceChip({ level, label, style, testID }: ConfidenceChipProps) {
  const colors = useThemeColors();
  const displayLabel = label ?? labelText[level];

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={displayLabel}
      style={[
        styles.chip,
        { backgroundColor: "rgba(148, 163, 184, 0.12)" },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.confidenceNeutral }]} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
});

export default ConfidenceChip;
