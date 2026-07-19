/**
 * Recipe detail — ingredient TEXT rows (ENG-1611, prototype `.rd-ing`).
 * Flag-ON sibling of `RecipeIngredientGrid` (which stays byte-intact for
 * the flag-OFF path): one row per ingredient — name left, dotted leader,
 * scaled quantity right, per-row SourceDot (D-2026-04-27-16 provenance,
 * incl. the AI-estimated sparkle) after the quantity. Tier stays in the
 * a11y label + the tap-through info sheet, exactly as the grid had it.
 * Web parity: `src/app/components/suppr/recipe-ingredient-text-rows.tsx`.
 *
 * The leader is a 1px-high View with a full dotted border (RN doesn't
 * render single-side dotted borders on iOS; a full border on a 1px-high
 * clipped View reads as one dotted rule).
 */
import { StyleSheet, Text, View } from "react-native";

import { FontFamily, Spacing, Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { decodeEntities } from "@/lib/decodeEntities";
import { formatIngredientAmountUnit } from "@suppr/shared/recipe-ingredients/formatIngredientAmount";
import { deriveIngredientVerificationTier } from "@suppr/shared/recipe-ingredients/ingredientVerificationStatus";
import { cleanIngredientDisplayName } from "@suppr/shared/recipe/cleanIngredientDisplayName";
import { SourceDot } from "@/components/ui/SourceDot";
import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";
import {
  GRID_PREVIEW_COUNT,
  type RecipeGridIngredient,
} from "./RecipeIngredientGrid";

export function RecipeIngredientRows({
  ingredients,
  forServings,
  viewMultiplier,
  onIngredientPress,
  onViewAll,
  expanded,
}: {
  ingredients: RecipeGridIngredient[];
  forServings: number;
  viewMultiplier: number;
  onIngredientPress: (index: number) => void;
  onViewAll: () => void;
  expanded: boolean;
}) {
  const colors = useThemeColors();
  if (ingredients.length === 0) return null;

  const shown = expanded ? ingredients : ingredients.slice(0, GRID_PREVIEW_COUNT);
  const hiddenCount = ingredients.length - shown.length;

  return (
    <View style={{ gap: Spacing.md }} testID="recipe-ingredients-section">
      <View style={styles.headerRow}>
        <Text style={{ ...Type.title, color: colors.navPrimary }}>Ingredients</Text>
        <Text style={{ fontFamily: FontFamily.sansRegular, fontSize: 14, color: colors.textSecondary }}>
          For {forServings} serving{forServings === 1 ? "" : "s"}
        </Text>
      </View>

      <View testID="recipe-ingredient-rows">
        {shown.map((ing, i) => {
          const conf = ing.confidence != null ? Number(ing.confidence) : null;
          const tier = deriveIngredientVerificationTier({
            isVerified: ing.is_verified ?? null,
            confidence: conf,
            source: ing.source ?? null,
          });
          const dotSource = mapMealSourceToDot(ing.source ?? null);
          const scaledAmount =
            ing.amount != null ? Math.round(ing.amount * viewMultiplier * 100) / 100 : null;
          const displayName = cleanIngredientDisplayName(ing.name) || decodeEntities(ing.name);
          return (
            <PressableScale
              key={i}
              onPress={() => onIngredientPress(i)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`${displayName} ${tier}`}
              style={[
                styles.row,
                { borderBottomColor: colors.border },
                i === shown.length - 1 && styles.rowLast,
              ]}
              testID={`recipe-ingredient-row-${i}`}
            >
              <Text
                style={[Type.bodyLarge, styles.rowName, { color: colors.text }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <View
                style={[styles.leader, { borderColor: colors.borderStrong }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              {scaledAmount != null ? (
                <Text
                  style={[
                    Type.captionSmall,
                    { color: colors.textSecondary, fontVariant: ["tabular-nums"] },
                  ]}
                  numberOfLines={1}
                >
                  {formatIngredientAmountUnit(scaledAmount, ing.unit)}
                </Text>
              ) : null}
              <SourceDot source={dotSource} size={6} />
            </PressableScale>
          );
        })}
      </View>

      {hiddenCount > 0 || expanded ? (
        <PressableScale
          onPress={onViewAll}
          haptic="selection"
          accessibilityRole="button"
          testID="recipe-ingredients-view-all"
          style={[
            styles.viewAll,
            { borderColor: colors.cardBorder, backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 14, fontWeight: "600", color: colors.text }}>
            {expanded ? "Show fewer" : `View all ${ingredients.length} ingredients`}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
    paddingVertical: Spacing.dense,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowName: {
    flexShrink: 1,
    maxWidth: "70%",
  },
  leader: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: "dotted",
    overflow: "hidden",
    transform: [{ translateY: -3 }],
  },
  viewAll: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    paddingVertical: Spacing.dense,
    alignItems: "center",
  },
});
