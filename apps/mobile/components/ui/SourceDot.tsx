import * as React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { SourceDotSource, SourceDotSize } from "../../../../src/lib/types/source";

/**
 * Mobile `<SourceDot>` — production design spec §1.6 mirror of
 * `src/app/components/ui/source-dot.tsx`.
 *
 * Sized 6 / 8 / 10 pt. AI source pairs the dot with a sparkle glyph
 * 8pt to its left.
 */

export type { SourceDotSource, SourceDotSize } from "../../../../src/lib/types/source";

export interface SourceDotProps {
  source: SourceDotSource;
  /** Diameter in pt. Defaults to 8. */
  size?: SourceDotSize;
  style?: ViewStyle;
  testID?: string;
}

export function SourceDot({
  source,
  size = 8,
  style,
  testID,
}: SourceDotProps) {
  const colors = useThemeColors();

  const colorMap: Record<SourceDotSource, string> = {
    usda: colors.sourceUsda,
    off: colors.sourceOff,
    fatsecret: colors.sourceFatsecret,
    manual: colors.sourceManual,
    ai: colors.sourceAi,
  };

  const tint = colorMap[source];

  if (source === "ai") {
    return (
      <View
        testID={testID}
        accessibilityLabel="AI estimated"
        style={[styles.row, style]}
      >
        <Sparkles size={8} color={tint} />
        <View
          style={[
            styles.dot,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
          ]}
        />
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={ariaLabel(source)}
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
        style,
      ]}
    />
  );
}

function ariaLabel(source: SourceDotSource): string {
  switch (source) {
    case "usda":
      return "USDA verified";
    case "off":
      return "Open Food Facts";
    case "fatsecret":
      return "FatSecret";
    case "manual":
      return "Manual entry";
    case "ai":
      return "AI estimated";
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    flexShrink: 0,
  },
});

export default SourceDot;
