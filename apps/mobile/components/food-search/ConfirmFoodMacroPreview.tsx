import { StyleSheet, Text, View } from "react-native";

import { MacroColors, MacroColorsDark, Spacing, Type } from "@/constants/theme";
import { useResolvedScheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { confirmFoodMacroTiles } from "@suppr/nutrition-core/confirmFoodMacroPreview";

export interface ConfirmFoodMacroPreviewProps {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** ENG-1257 — prototype 3-tile P/C/F row + serif kcal line (micro table stays below). */
export function ConfirmFoodMacroPreview({
  calories,
  proteinG,
  carbsG,
  fatG,
}: ConfirmFoodMacroPreviewProps) {
  const colors = useThemeColors();
  const mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  const tiles = confirmFoodMacroTiles({ proteinG, carbsG, fatG });
  const dotColor = (token: string) =>
    token === "--macro-protein"
      ? mc.protein
      : token === "--macro-carbs"
        ? mc.carbs
        : mc.fat;

  return (
    <View style={{ gap: Spacing.md }} testID="confirm-food-macro-preview">
      <View style={styles.tileRow}>
        {tiles.map((tile) => (
          <View key={tile.key} style={[styles.tile, { borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: dotColor(tile.dotToken) }]} />
            <Text style={[styles.tileValue, { color: colors.text }]}>{tile.valueG}g</Text>
            <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{tile.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.kcalLine, { color: colors.text }]}>
        <Text style={styles.kcalValue}>{calories}</Text> kcal
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tileRow: { flexDirection: "row", gap: Spacing.sm },
  tile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: "center",
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileValue: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileLabel: { ...Type.caption, fontSize: 11 },
  kcalLine: { fontSize: 14 },
  kcalValue: {
    fontFamily: Type.title.fontFamily,
    fontSize: 24,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
});

export default ConfirmFoodMacroPreview;
