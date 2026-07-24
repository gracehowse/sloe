import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import type { RecipeCard } from "@/lib/types";
import { decodeEntities } from "@/lib/decodeEntities";
import { MEDIA_SCRIM_COLOR, MEDIA_SCRIM_STOPS } from "@suppr/shared/theme/mediaScrim";
import { recipeCardAccessibilityLabel } from "@suppr/shared/recipes/recipeCardAccessibilityLabel";
import { formatTotalRecipeDuration } from "@suppr/shared/recipes/totalDuration";
import {
  isSeedRecipeId,
  SEED_CLUSTERS,
  type SeedCuisineCluster,
} from "@suppr/shared/recipes/seedRecipesV2";

// THE card corner (card-grammar ruling, docs/decisions/2026-07-10-card-grammar-rounder-flat.md)
const RECIPE_CARD_RADIUS = Radius.card;

/**
 * One card size per shelf (`design_consistency_v1`). The pre-flag shelf gave
 * index 0 a 280pt/3:4 box and every sibling a 200pt/4:5 box — a 123pt height
 * step inside a single row, which read as "random shapes and sizes", and which
 * also made a uniform `snapToInterval` impossible (so cards rested wherever the
 * fling stopped and the trailing card was sliced mid-word). One geometry fixes
 * both: every card is the non-hero box, so the shelf snaps on one interval.
 */
const CARD_WIDTH = 200;
const CARD_ASPECT = 4 / 5;
const CARD_GAP = Spacing.sm;

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
  consistent,
}: {
  recipe: RecipeCard;
  hero: boolean;
  consistent: boolean;
}) {
  const router = useRouter();
  const kcal = Math.round(recipe.calories);
  const protein = Math.round(recipe.protein);
  // ENG-1617 — total (prep + cook), not cook alone.
  const timeLabel = formatTotalRecipeDuration(recipe.prepTimeMin, recipe.cookTimeMin);
  const width = consistent ? CARD_WIDTH : hero ? 280 : 200;
  const aspectRatio = consistent ? CARD_ASPECT : hero ? 3 / 4 : 4 / 5;
  // Per-card id — a shared gradient id would collide across the ~15 cards
  // these three shelves mount at once.
  const scrimId = `cluster-scrim-${recipe.id}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recipeCardAccessibilityLabel({
        title: decodeEntities(recipe.title),
        calories: kcal,
        protein,
        timeLabel,
      })}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={{ width, borderRadius: RECIPE_CARD_RADIUS, overflow: "hidden" }}
    >
      {/* ENG-1374 PR 2 — the wrapper's opaque ground is the recipe's own
          §11.4 cuisine tint, computed here rather than passed in (the
          retired `placeholderColor` prop was fed `colors.card` #FFFFFF), so
          no child failure can expose page white. */}
      <View style={{ aspectRatio, position: "relative" }}>
        <RecipeCardImage
          uri={recipe.image}
          cardImageStyle={{ width: "100%", height: "100%" }}
          recipeId={recipe.id}
          recipeTitle={recipe.title}
        />
        {consistent ? (
          /* Full-bleed title scrim, feathered. The pre-flag treatment (kept
             below as the kill switch) was a bottom-anchored 55%-height flat
             black rect: a razor-sharp edge 45% down the card, bright photo
             above it and the SAME photo crushed by 55% black below it —
             which read as the card printing its picture twice at two
             different crops. Stops come from the shared media-scrim token,
             which encodes the web twin's already-correct
             `from-black/70 via-black/20 to-transparent`
             (src/app/components/DiscoverFeed.tsx). `react-native-svg`, not
             `expo-linear-gradient` (not a dependency) — same vehicle as the
             sibling gradient in DiscoverCollections.tsx. */
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={scrimId} x1="0" y1="1" x2="0" y2="0">
                {MEDIA_SCRIM_STOPS.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={MEDIA_SCRIM_COLOR}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${scrimId})`} />
          </Svg>
        ) : (
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
        )}
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
            {timeLabel ? ` · ${timeLabel}` : ""}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function DiscoverClusterCarousels({ recipes }: { recipes: ReadonlyArray<RecipeCard> }) {
  const colors = useThemeColors();
  const consistent = isFeatureEnabled("design_consistency_v1");

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
            {/* Snap + edge-bleed, matching the sibling shelf (EditorialShelf):
                cards scroll out to the screen edge but always REST on the page
                gutter, so the trailing card shows a consistent deliberate peek
                instead of stopping mid-word. A single interval is only legal
                because every card is now one size (see CARD_WIDTH above). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate={consistent ? "fast" : "normal"}
              snapToInterval={consistent ? CARD_WIDTH + CARD_GAP : undefined}
              snapToAlignment={consistent ? "start" : undefined}
              style={consistent ? { marginHorizontal: -Spacing.lg } : undefined}
              contentContainerStyle={
                consistent
                  ? { gap: CARD_GAP, paddingHorizontal: Spacing.lg }
                  : { gap: Spacing.sm, paddingRight: Spacing.lg }
              }
            >
              {items.map((recipe, idx) => (
                <ClusterRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  hero={idx === 0}
                  consistent={consistent}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
