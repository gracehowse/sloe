/**
 * Recipe detail — ingredients thumbnail grid (Figma `332:2`, section 6).
 * Web parity: the ingredient grid in `src/app/components/RecipeDetail.tsx`.
 *
 * Header row: "Ingredients" (serif) left, "For N servings" right. Then a
 * 4-per-row thumbnail grid: each cell is a cream rounded-24 tile (image area)
 * over a centered name + amount. recipe_ingredients carry no per-ingredient
 * image, so the tile reuses the deterministic `RecipeHeroFallback` glyph keyed
 * per ingredient — never an empty box, no new imagery wired. A "View all N
 * ingredients" pill follows.
 *
 * Wired features preserved: per-ingredient 4-tier confidence (corner dot +
 * tap-to-info Alert with status/source/macros), Verify CTA path (tap a card →
 * info; the header Edit + the View-all pill both route to /recipe/verify), and
 * count-to-weight scaled amounts via the viewing multiplier.
 */
import { Pressable, Text, View } from "react-native";

import { Accent, FontFamily } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { decodeEntities } from "@/lib/decodeEntities";
import { formatIngredientAmountUnit } from "@suppr/shared/recipe-ingredients/formatIngredientAmount";
import {
  deriveIngredientVerificationTier,
  type IngredientVerificationTier,
} from "@suppr/shared/recipe-ingredients/ingredientVerificationStatus";

/** Number of cells shown before the grid collapses behind "View all". */
const GRID_PREVIEW_COUNT = 8;

export type RecipeGridIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number | null;
  source?: string | null;
  is_verified?: boolean | null;
};

function tierColor(tier: IngredientVerificationTier, neutral: string): string {
  switch (tier) {
    case "verified":
      return Accent.success;
    case "partial":
      return Accent.warning;
    case "estimated":
      return Accent.destructive;
    default:
      return neutral;
  }
}

export function RecipeIngredientGrid({
  recipeId,
  ingredients,
  forServings,
  viewMultiplier,
  onIngredientPress,
  onViewAll,
  expanded,
}: {
  recipeId: string;
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
    <View style={{ gap: 16 }} testID="recipe-ingredients-section">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text
          style={{
            fontFamily: FontFamily.serifRegular,
            fontSize: 24,
            lineHeight: 28,
            fontWeight: "400",
            color: colors.navPrimary,
          }}
        >
          Ingredients
        </Text>
        <Text style={{ fontFamily: FontFamily.sansRegular, fontSize: 14, color: colors.textSecondary }}>
          For {forServings} serving{forServings === 1 ? "" : "s"}
        </Text>
      </View>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
        testID="recipe-ingredient-grid"
      >
        {shown.map((ing, i) => {
          const conf = ing.confidence != null ? Number(ing.confidence) : null;
          const tier = deriveIngredientVerificationTier({
            isVerified: ing.is_verified ?? null,
            confidence: conf,
            source: ing.source ?? null,
          });
          const dot = tierColor(tier, colors.textTertiary);
          const scaledAmount =
            ing.amount != null ? Math.round(ing.amount * viewMultiplier * 100) / 100 : null;
          return (
            <View key={i} style={{ width: "25%", padding: 6 }}>
              <Pressable
                onPress={() => onIngredientPress(i)}
                accessibilityRole="button"
                accessibilityLabel={`${decodeEntities(ing.name)} ${tier}`}
                style={{ gap: 6 }}
                testID={`recipe-ingredient-card-${i}`}
              >
                <View
                  style={{
                    height: 88,
                    borderRadius: 24,
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    overflow: "hidden",
                  }}
                >
                  <RecipeHeroFallback id={`${recipeId}-ing-${i}`} title={ing.name} iconSize={24} />
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: dot,
                      borderWidth: 1.5,
                      borderColor: "#FFFFFF",
                    }}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.sansMedium,
                    fontSize: 12,
                    fontWeight: "500",
                    color: colors.text,
                    textAlign: "center",
                  }}
                  numberOfLines={2}
                >
                  {decodeEntities(ing.name)}
                </Text>
                {scaledAmount != null ? (
                  <Text
                    style={{
                      fontFamily: FontFamily.sansRegular,
                      fontSize: 12,
                      color: colors.textSecondary,
                      textAlign: "center",
                      fontVariant: ["tabular-nums"],
                    }}
                    numberOfLines={1}
                  >
                    {formatIngredientAmountUnit(scaledAmount, ing.unit)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {hiddenCount > 0 || expanded ? (
        <Pressable
          onPress={onViewAll}
          accessibilityRole="button"
          testID="recipe-ingredients-view-all"
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.backgroundSecondary,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 14, fontWeight: "600", color: colors.text }}>
            {expanded ? "Show fewer" : `View all ${ingredients.length} ingredients`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export { GRID_PREVIEW_COUNT };
