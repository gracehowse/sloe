import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { RecipeCard } from "@/lib/types";

/**
 * RecipeCardWide — the Sloe v3 Cookbook editorial-shelf card (prototype
 * `rcard--wide` ~L4176): a fixed 188px card (128px photo) with the recipe name
 * and a "{kcal} kcal · {protein}g P · {time}m" meta line. Used inside
 * {@link EditorialShelf}; behind `sloe_v3_editorial_shelves` (Block 5).
 */
export interface RecipeCardWideProps {
  recipe: RecipeCard;
  onPress: () => void;
}

function totalMinutes(r: RecipeCard): number {
  const prep = Number.isFinite(r.prepTimeMin) ? (r.prepTimeMin as number) : 0;
  const cook = Number.isFinite(r.cookTimeMin) ? (r.cookTimeMin as number) : 0;
  return prep + cook;
}

export function RecipeCardWide({ recipe, onPress }: RecipeCardWideProps) {
  const colors = useThemeColors();
  const mins = totalMinutes(recipe);
  const hasKcal = recipe.calories > 0;
  const meta = [
    hasKcal
      ? `${Math.round(recipe.calories)} kcal · ${Math.round(recipe.protein)}g P`
      : "Nutrition pending",
    mins > 0 ? `${mins}m` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${meta}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.imageWrap}>
        <RecipeCardImage
          uri={recipe.image}
          cardImageStyle={styles.image}
          fallbackBg={colors.backgroundSecondary}
          fallbackTint={colors.textTertiary}
          recipeId={recipe.id}
          recipeTitle={recipe.title}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 188,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageWrap: { height: 128, width: "100%" },
  image: { height: 128, width: "100%" },
  body: { padding: Spacing.dense, gap: 4 },
  name: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14, lineHeight: 18 },
  meta: { ...Type.caption, fontVariant: ["tabular-nums"] },
});

export default RecipeCardWide;
