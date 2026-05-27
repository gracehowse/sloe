import { Text, View } from "react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import type { IngredientBreakdownResult } from "@suppr/shared/nutrition/macroIngredientBreakdown";

/**
 * Per-ingredient breakdown list (ENG-748 #10). Renders the reconciled,
 * name-aggregated ingredient lines from the shared derive helper
 * (`src/lib/nutrition/macroIngredientBreakdown.ts`). Each line is one ingredient
 * (or a self-named fallback for entries with no recipe rows), sorted by
 * descending contribution, with a proportion dot scaled by its share of the
 * day's total for the active macro. Visual treatment matches the by-meal flat
 * list so the two breakdown modes feel consistent.
 */
export function MacroIngredientList({
  breakdown,
  config,
}: {
  breakdown: IngredientBreakdownResult;
  config: { label: string; color: string; unit: string };
}) {
  const colors = useThemeColors();
  const { lines, total } = breakdown;
  return (
    <View testID="macro-detail-ingredient-list" style={{ gap: 0 }}>
      {lines.map((line, i) => {
        const pct = total > 0 ? line.value / total : 0;
        return (
          <View
            key={`${line.name}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              borderBottomWidth: i < lines.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: config.color,
                opacity: 0.3 + pct * 0.7,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                {line.name}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: config.color,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.round(line.value * 10) / 10}
              {config.unit}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
