import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import { Radius, Spacing, Type } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";
import { decodeEntities } from "@/lib/decodeEntities";
import { recipeCardAccessibilityLabel } from "@suppr/shared/recipes/recipeCardAccessibilityLabel";
import {
  isSeedRecipeId,
  SEED_CLUSTERS,
  type SeedCuisineCluster,
} from "@suppr/shared/recipes/seedRecipesV2";

// THE card corner (card-grammar ruling, docs/decisions/2026-07-10-card-grammar-rounder-flat.md)
const RECIPE_CARD_RADIUS = Radius.card;

function clusterIdFromSeedRecipeId(id: string): SeedCuisineCluster | null {
  if (!isSeedRecipeId(id)) return null;
  const after = id.slice("seed-v2-".length);
  for (const cluster of SEED_CLUSTERS) {
    if (after.startsWith(`${cluster.id}-`)) return cluster.id;
  }
  return null;
}

function ClusterRecipeCard({
  recipe,
  hero,
  placeholderColor,
}: {
  recipe: RecipeCard;
  hero: boolean;
  placeholderColor: string;
}) {
  const router = useRouter();
  const kcal = Math.round(recipe.calories);
  const protein = Math.round(recipe.protein);
  const cookTime = recipe.cookTime ?? (recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : null);
  const width = hero ? 280 : 200;
  const aspectRatio = hero ? 3 / 4 : 4 / 5;
  const trimmed = (recipe.image ?? "").trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recipeCardAccessibilityLabel({
        title: decodeEntities(recipe.title),
        calories: kcal,
        protein,
        cookTime,
      })}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={{ width, borderRadius: RECIPE_CARD_RADIUS, overflow: "hidden" }}
    >
      <View style={{ aspectRatio, position: "relative", backgroundColor: placeholderColor }}>
        {trimmed ? (
          <SmartImage
            source={{ uri: trimmed }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            recyclingKey={recipe.id}
            placeholderColor={placeholderColor}
          />
        ) : (
          <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={24} />
        )}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "55%",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: Spacing.sm }}>
          <Text
            style={{
              ...Type.body,
              fontWeight: "700",
              color: "#FFFFFF",
            }}
            numberOfLines={2}
          >
            {decodeEntities(recipe.title)}
          </Text>
          <Text style={{ ...Type.caption, color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
            {kcal} kcal · {protein}g protein
            {cookTime ? ` · ${cookTime}` : ""}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function DiscoverClusterCarousels({ recipes }: { recipes: ReadonlyArray<RecipeCard> }) {
  const colors = useThemeColors();

  const byCluster = useMemo(() => {
    const map = new Map<SeedCuisineCluster, RecipeCard[]>();
    for (const cluster of SEED_CLUSTERS) map.set(cluster.id, []);
    for (const recipe of recipes) {
      const clusterId = clusterIdFromSeedRecipeId(recipe.id);
      if (!clusterId) continue;
      map.get(clusterId)?.push(recipe);
    }
    return map;
  }, [recipes]);

  return (
    <View testID="discover-cluster-carousels" style={{ gap: Spacing.xl, marginBottom: Spacing.xl }}>
      {SEED_CLUSTERS.map((cluster) => {
        const items = byCluster.get(cluster.id) ?? [];
        if (items.length === 0) return null;
        return (
          <View key={cluster.id} testID={`discover-cluster-${cluster.id}`}>
            <Text
              style={{
                ...Type.title,
                color: colors.navPrimary,
                marginBottom: Spacing.sm,
              }}
            >
              {cluster.title}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.lg }}
            >
              {items.map((recipe, idx) => (
                <ClusterRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  hero={idx === 0}
                  placeholderColor={colors.card}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
