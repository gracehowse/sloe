/**
 * Recipe detail — ingredients thumbnail grid (Figma `332:2`, section 6).
 * Web parity: the ingredient grid in `src/app/components/RecipeDetail.tsx`.
 *
 * Header row: "Ingredients" (serif) left, "For N servings" right. Then a
 * 4-per-row thumbnail grid: each cell is a cream rounded-24 tile (image area)
 * over a centered name + amount.
 *
 * Sloe image system (2026-06-08): when the global `ingredient_images` table
 * has a ready Template-B photo for an ingredient (keyed by
 * `normalizeIngredientNameKey`), the tile shows that on-brand image; otherwise
 * it falls back to a calm cream placeholder with the ingredient's sage initial
 * (never the loud gradient, never an empty box). The label uses
 * `cleanIngredientDisplayName` so brand/quantity noise is dropped. The
 * `imageMap` is hydrated by the parent screen and passed in.
 *
 * Wired features preserved: per-ingredient 4-tier confidence (corner dot +
 * tap-to-info Alert with status/source/macros), Verify CTA path (tap a card →
 * info; the header Edit + the View-all pill both route to /recipe/verify), and
 * count-to-weight scaled amounts via the viewing multiplier.
 */
import { Image, Pressable, Text, View } from "react-native";

import { FontFamily, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { decodeEntities } from "@/lib/decodeEntities";
import { formatIngredientAmountUnit } from "@suppr/shared/recipe-ingredients/formatIngredientAmount";
import {
  deriveIngredientVerificationTier,
} from "@suppr/shared/recipe-ingredients/ingredientVerificationStatus";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "@suppr/shared/recipe/ingredientImageTile";
import { cleanIngredientDisplayName } from "@suppr/shared/recipe/cleanIngredientDisplayName";
// Phase 4 / B3.X — SourceDot per ingredient row (D-2026-04-27-16, §1.6).
import { SourceDot } from "@/components/ui/SourceDot";
import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";

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


export function RecipeIngredientGrid({
  recipeId,
  ingredients,
  forServings,
  viewMultiplier,
  onIngredientPress,
  onViewAll,
  expanded,
  imageMap,
}: {
  recipeId: string;
  ingredients: RecipeGridIngredient[];
  forServings: number;
  viewMultiplier: number;
  onIngredientPress: (index: number) => void;
  onViewAll: () => void;
  expanded: boolean;
  /** Sloe image system — `name_key → image_url` for on-brand ingredient
   *  tiles, hydrated by the parent screen. Empty until the backfill runs;
   *  missing keys fall back to the calm cream placeholder. */
  imageMap?: ReadonlyMap<string, string> | null;
}) {
  const colors = useThemeColors();
  if (ingredients.length === 0) return null;

  const shown = expanded ? ingredients : ingredients.slice(0, GRID_PREVIEW_COUNT);
  const hiddenCount = ingredients.length - shown.length;

  return (
    <View style={{ gap: 16 }} testID="recipe-ingredients-section">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text
          // headers census 2026-06-10: section header → Type.title token (was a
          // hand-rolled serifRegular 24/28/400 — metrics == Type.title).
          style={{ ...Type.title, color: colors.navPrimary }}
        >
          Ingredients
        </Text>
        <Text style={{ fontFamily: FontFamily.sansRegular, fontSize: 14, color: colors.textSecondary }}>
          For {forServings} serving{forServings === 1 ? "" : "s"}
        </Text>
      </View>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -(Spacing.dense / 2) }}
        testID="recipe-ingredient-grid"
      >
        {shown.map((ing, i) => {
          const conf = ing.confidence != null ? Number(ing.confidence) : null;
          const tier = deriveIngredientVerificationTier({
            isVerified: ing.is_verified ?? null,
            confidence: conf,
            source: ing.source ?? null,
          });
          // Phase 4 / B3.X — map to canonical SourceDot key (D-2026-04-27-16).
          const dotSource = mapMealSourceToDot(ing.source ?? null);
          const scaledAmount =
            ing.amount != null ? Math.round(ing.amount * viewMultiplier * 100) / 100 : null;
          // Sloe image system — ready Template-B photo if present, else a
          // calm cream placeholder. Label uses the cleaned display name.
          const tileImageUrl = resolveIngredientTileImage(ing.name, imageMap);
          const tilePlaceholder = getIngredientTilePlaceholder(ing.name);
          const displayName = cleanIngredientDisplayName(ing.name) || decodeEntities(ing.name);
          return (
            <View key={i} style={{ width: "25%", padding: Spacing.dense / 2 }}>
              <Pressable
                onPress={() => onIngredientPress(i)}
                accessibilityRole="button"
                accessibilityLabel={`${displayName} ${tier}`}
                style={{ gap: Spacing.xs }}
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
                  {tileImageUrl ? (
                    <Image
                      source={{ uri: tileImageUrl }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                      testID={`recipe-ingredient-image-${i}`}
                    />
                  ) : (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tilePlaceholder.bg,
                      }}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      testID={`recipe-ingredient-placeholder-${i}`}
                    >
                      <Text
                        style={{
                          fontFamily: FontFamily.serifRegular,
                          fontSize: 26,
                          fontWeight: "600",
                          color: tilePlaceholder.fg,
                        }}
                      >
                        {tilePlaceholder.initial}
                      </Text>
                    </View>
                  )}
                  {/* Phase 4 / B3.X — SourceDot per ingredient row
                      (D-2026-04-27-16). Sized 6pt per spec §1.6. */}
                  <SourceDot
                    source={dotSource}
                    size={6}
                    style={{ position: "absolute", top: 6, right: 6 }}
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
                  {displayName}
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
            paddingVertical: Spacing.dense,
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
