import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { RecipeCard } from "@/lib/types";

/**
 * FeaturedHero — the Sloe v3 Cookbook "Tonight's pick" featured card (prototype
 * `cook-feat` ~L4283): a full-width card with a 150px photo carrying a
 * "Tonight's pick" kick badge, then a "From your cookbook" plum overline, the
 * recipe title (serif), and a kcal/protein/time meta line. Sits above the
 * editorial shelves when the All filter is active. Behind
 * `sloe_v3_editorial_shelves` (Block 5).
 */
export interface FeaturedHeroProps {
  recipe: RecipeCard;
  onPress: () => void;
}

export function FeaturedHero({ recipe, onPress }: FeaturedHeroProps) {
  const colors = useThemeColors();
  const prep = Number.isFinite(recipe.prepTimeMin) ? (recipe.prepTimeMin as number) : 0;
  const cook = Number.isFinite(recipe.cookTimeMin) ? (recipe.cookTimeMin as number) : 0;
  const mins = prep + cook;
  const meta = [
    recipe.calories > 0 ? `${Math.round(recipe.calories)} kcal` : null,
    recipe.protein > 0 ? `${Math.round(recipe.protein)}g protein` : null,
    mins > 0 ? `${mins} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Tonight's pick: ${recipe.title}${meta ? `, ${meta}` : ""}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.photo}>
        <RecipeCardImage
          uri={recipe.image}
          cardImageStyle={StyleSheet.absoluteFillObject}
          fallbackBg={colors.backgroundSecondary}
          fallbackTint={colors.textTertiary}
          recipeId={recipe.id}
          recipeTitle={recipe.title}
        />
        <View style={styles.kick}>
          <Text style={styles.kickText}>{"Tonight's pick"}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: colors.navPrimary }]}>From your cookbook</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        {meta ? (
          <Text style={[styles.meta, { color: colors.textTertiary }]}>{meta}</Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  photo: { height: 150, width: "100%", position: "relative" },
  kick: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(28,18,26,0.5)",
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: Radius.full,
  },
  kickText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.84,
    textTransform: "uppercase",
    fontFamily: Type.label.fontFamily,
  },
  body: { paddingTop: Spacing.dense, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md },
  kicker: { ...Type.label, marginBottom: 2 },
  // Serif 22/600 — matches the web twin + the prototype cf-title (21/600).
  title: { fontFamily: FontFamily.serifSemibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.2, marginVertical: 2 },
  meta: { ...Type.caption, fontVariant: ["tabular-nums"], marginTop: 2 },
});

export default FeaturedHero;
