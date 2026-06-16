import * as React from "react";
import { View } from "react-native";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Figma onboarding chrome (189:2) — discrete plum segments instead of a
 * continuous fill bar. Mirrors web `onboarding-segmented-progress.tsx`.
 */
export function OnboardingSegmentedProgress({
  value,
  total,
}: {
  value: number;
  total: number;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const segments = Math.max(1, total);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: value, min: 0, max: total }}
      accessibilityLabel={`Step ${value} of ${total}`}
      style={{ flex: 1, flexDirection: "row", gap: 6 }}
    >
      {Array.from({ length: segments }, (_, index) => (
        <View
          key={index}
          testID={`onboarding-segment-${index}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            backgroundColor:
              index < value ? accent.primary : colors.inputBg,
          }}
        />
      ))}
    </View>
  );
}
