/**
 * Recipe detail — ingredient TEXT rows (ENG-1611, prototype `.rd-ing`).
 * Section head: Type.label "Ingredients" + servings stepper when wired.
 */
import { StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
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
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  ingredients: RecipeGridIngredient[];
  forServings: number;
  viewMultiplier: number;
  onIngredientPress: (index: number) => void;
  onViewAll: () => void;
  expanded: boolean;
  canDecrease?: boolean;
  canIncrease?: boolean;
  onDecrease?: () => void;
  onIncrease?: () => void;
}) {
  const colors = useThemeColors();
  if (ingredients.length === 0) return null;

  const shown = expanded ? ingredients : ingredients.slice(0, GRID_PREVIEW_COUNT);
  const hiddenCount = ingredients.length - shown.length;
  const showServingsStepper =
    typeof onDecrease === "function" && typeof onIncrease === "function";

  const roundBtn = (enabled: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <View style={{ gap: Spacing.md }} testID="recipe-ingredients-section">
      <View style={styles.headerRow}>
        <Text style={{ ...Type.label, color: colors.textTertiary }}>Ingredients</Text>
        {showServingsStepper ? (
          <View style={styles.servStep} testID="recipe-ingredients-servings-stepper">
            <PressableScale
              onPress={onDecrease}
              disabled={canDecrease === false}
              accessibilityRole="button"
              accessibilityLabel="Decrease servings"
              testID="recipe-view-servings-minus"
              style={roundBtn(canDecrease !== false)}
            >
              <Minus size={15} color={colors.text} />
            </PressableScale>
            <Text
              style={[styles.servValue, { color: colors.navPrimary }]}
              testID="recipe-view-servings-value"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${forServings} servings`}
            >
              {forServings}
            </Text>
            <PressableScale
              onPress={onIncrease}
              disabled={canIncrease === false}
              accessibilityRole="button"
              accessibilityLabel="Increase servings"
              testID="recipe-view-servings-plus"
              style={roundBtn(canIncrease !== false)}
            >
              <Plus size={15} color={colors.text} />
            </PressableScale>
          </View>
        ) : (
          <Text style={{ fontFamily: FontFamily.sansRegular, fontSize: 14, color: colors.textSecondary }}>
            For {forServings} serving{forServings === 1 ? "" : "s"}
          </Text>
        )}
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
    alignItems: "center",
    gap: Spacing.md,
  },
  servStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
  },
  servValue: {
    minWidth: 24,
    textAlign: "center",
    fontFamily: FontFamily.serifRegular,
    fontSize: 20,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  rowLast: { borderBottomWidth: 0 },
  rowName: { flexShrink: 1, maxWidth: "55%" },
  leader: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: "dotted",
    marginHorizontal: 4,
    overflow: "hidden",
    alignSelf: "center",
  },
  viewAll: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
