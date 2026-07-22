import { Text, View } from "react-native";

import { Layout } from "@/constants/layout";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMacroColors } from "@/lib/macroColors";

/**
 * ENG-1656 — dial-legend grammar under the hero Goal/Eaten/Bonus row.
 * One centred row of three dot-labelled numerals so all macros are
 * glanceable in the hero viewport (v3 prototype `.dial-legend`).
 */
export interface TodayHeroMacroLegendProps {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

function MacroLegendItem({
  label,
  current,
  target,
  color,
  textColor,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
      }}
      accessibilityLabel={`${label} ${Math.round(current)} of ${Math.round(target)} grams`}
    >
      <Text style={{ ...Type.captionSmall, color, fontWeight: "700" }}>●</Text>
      <Text
        style={{
          ...Type.captionSmall,
          fontWeight: "600",
          color: textColor,
          fontVariant: ["tabular-nums"],
        }}
      >
        {Math.round(current)}/{Math.round(target)}g {label}
      </Text>
    </View>
  );
}

export function TodayHeroMacroLegend({
  protein,
  carbs,
  fat,
}: TodayHeroMacroLegendProps) {
  const colors = useThemeColors();
  const mc = useMacroColors();

  return (
    <View
      testID="today-hero-macro-legend"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: Layout.todayScrollGap,
        paddingTop: Spacing.xs,
      }}
    >
      <MacroLegendItem
        label="P"
        current={protein.current}
        target={protein.target}
        color={mc.colors.protein}
        textColor={colors.textSecondary}
      />
      <MacroLegendItem
        label="C"
        current={carbs.current}
        target={carbs.target}
        color={mc.colors.carbs}
        textColor={colors.textSecondary}
      />
      <MacroLegendItem
        label="F"
        current={fat.current}
        target={fat.target}
        color={mc.colors.fat}
        textColor={colors.textSecondary}
      />
    </View>
  );
}

export default TodayHeroMacroLegend;
