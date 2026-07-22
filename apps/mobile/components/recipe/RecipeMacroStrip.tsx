/**
 * Recipe detail — macro card (Figma `332:2`, section 4). Web parity:
 * the macro strip in `src/app/components/RecipeDetail.tsx`.
 *
 * One cream slab, rounded-16, four evenly-spread cells. Each cell is a serif
 * value over a small-caps label. The VALUES are coloured per macro:
 *   - Cal  → plum   (#3B2A4D / colors.navPrimary)
 *   - Pro  → sage   (MacroColors.protein)
 *   - Carb → clay   (MacroColors.carbs)
 *   - Fat  → amber  (MacroColors.fat)
 *
 * The four columns are Figma-fixed (CAL/PRO/CARB/FAT). Tracked micros
 * (fibre/sugar/sodium) are NOT dropped — the parent renders them as a chip row
 * below. The net-carbs lens swaps the CARB column label + value upstream.
 */
import { Text, View } from "react-native";

import { Spacing, Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { macroColorFor } from "@/lib/macroColors";
import { useResolvedScheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type RecipeMacroCell = {
  key: "calories" | "protein" | "carbs" | "fat";
  /** Display label, e.g. CAL / PRO / CARB / NET / FAT. */
  label: string;
  /** Pre-rounded integer string value. */
  value: string;
  /** Unit suffix, e.g. "g" or "". */
  unit: string;
};

/** Per-macro value colour — Figma `332:2` §4. ENG-1223: scheme-aware (plum
 *  protein etc. lighten on dark); calories uses the passed nav-plum. */
function macroValueColor(
  key: RecipeMacroCell["key"],
  plum: string,
  isDark: boolean,
): string {
  if (key === "calories") return plum;
  return macroColorFor(key, isDark);
}

export function RecipeMacroStrip({
  cells,
  variant = "slab",
}: {
  cells: RecipeMacroCell[];
  /** v3 conformance (ENG-1247): borderless `.rd-macros` strip — top/bottom hairlines, no card slab. */
  variant?: "slab" | "borderless";
}) {
  const colors = useThemeColors();
  const isDark = useResolvedScheme() === "dark";
  const isBorderless = variant === "borderless";
  return (
    <View
      testID="recipe-macros-grid"
      accessibilityLabel="Nutrition per serving"
      style={{
        flexDirection: "row",
        ...(isBorderless
          ? {
              paddingTop: Spacing.lg,
              paddingBottom: Spacing.xs,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }
          : {
              borderRadius: CARD_RADIUS,
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingVertical: Spacing.lg,
            }),
      }}
    >
      {cells.map((cell, idx) => (
        <View
          key={cell.key}
          testID={`recipe-macro-tile-${cell.key}`}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: idx > 0 ? 1 : 0,
            borderLeftColor: colors.border,
          }}
        >
          <Text
            style={{
              ...Type.title,
              color: macroValueColor(cell.key, colors.navPrimary, isDark),
              fontVariant: ["tabular-nums"],
            }}
          >
            {cell.value}
            {cell.unit ? (
              <Text style={{ fontSize: 15, fontWeight: "400", color: colors.textSecondary }}>
                {cell.unit}
              </Text>
            ) : null}
          </Text>
          <Text
            // headers census 2026-06-10: macro-strip label → Type.label (11px;
            // census picked straight Type.label over a private 10px density step).
            style={{ ...Type.label, marginTop: 4, color: colors.textSecondary }}
          >
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
