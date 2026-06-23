import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { RecipeCard } from "@/lib/types";
import { RecipeCardWide } from "./RecipeCardWide";

/**
 * EditorialShelf — a Sloe v3 Cookbook shelf (prototype `cook-shelf` ~L4295): a
 * section head (serif-adjacent 18px title + muted subtitle) above a horizontal
 * snap-scroll of {@link RecipeCardWide} cards that edge-bleeds the host's 20px
 * padding. Memoized — shelves only change when their recipe list does. Behind
 * `sloe_v3_editorial_shelves` (Block 5).
 */
export interface EditorialShelfProps {
  title: string;
  subtitle: string;
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
}

const CARD_WIDTH = 188;
const GAP = 14;

function EditorialShelfBase({
  title,
  subtitle,
  recipes,
  onPressRecipe,
}: EditorialShelfProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
        snapToAlignment="start"
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {recipes.map((r) => (
          <RecipeCardWide key={r.id} recipe={r} onPress={() => onPressRecipe(r)} />
        ))}
      </ScrollView>
    </View>
  );
}

export const EditorialShelf = memo(EditorialShelfBase);

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg },
  head: { marginBottom: Spacing.sm },
  title: { ...Type.navTitle },
  subtitle: { ...Type.caption, marginTop: 1 },
  scroll: { marginHorizontal: -Spacing.lg },
  row: { gap: GAP, paddingHorizontal: Spacing.lg, paddingVertical: 2 },
});

export default EditorialShelf;
