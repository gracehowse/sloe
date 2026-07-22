import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { chipBaseStyle, chipLabelStyle } from "@/components/ui/chipGeometry";

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
        chipBaseStyle,
        styles.chip,
        // Chips census (2026-06-10): warm neutral wash — the slate literal
        // was a cool-grey outlier on a warm-aubergine app.
        { backgroundColor: colors.confidenceNeutralSoft },
        style,
      ]}
    >
      <Text style={[chipLabelStyle, styles.label, { color: colors.confidenceNeutral }]} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {},
  label: {},
});

export default ConfidenceChip;
