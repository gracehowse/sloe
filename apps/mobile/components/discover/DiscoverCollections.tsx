import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PressableScale } from "@/components/ui/PressableScale";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import type { RecipeCard } from "@/lib/types";
import {
  CURATED_COLLECTIONS,
  collectionRecipeCount,
} from "@suppr/shared/discover/curatedCollections";
import type { RecipeCategoryId } from "@suppr/shared/recipes/recipeCategoryFilters";

/**
 * DiscoverCollections — the Sloe v3 Discover "Collections" tiles (ENG-1225
 * Block 6, prototype `.w-collections` ~L7565): gradient tiles that DEEP-LINK
 * into the existing category pills (tap → applies the filter). Self-gating on
 * `sloe_v3_discover_editorial` + at least one non-empty tile; counts are live
 * (`collectionRecipeCount`), never fabricated. Shared tile defs with web.
 */
export interface DiscoverCollectionsProps {
  /** The Discover feed recipes (for live per-tile counts). */
  recipes: RecipeCard[];
  /** Apply a collection's category-pill filter. */
  onSelectCategory: (categoryId: RecipeCategoryId) => void;
}

const TILE_W = 150;

export function DiscoverCollections({
  recipes,
  onSelectCategory,
}: DiscoverCollectionsProps) {
  const colors = useThemeColors();
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const tiles = useMemo(
    () =>
      CURATED_COLLECTIONS.map((c) => ({
        ...c,
        count: collectionRecipeCount(c, recipes),
      })).filter((c) => c.count > 0),
    [recipes],
  );
  if (!enabled || tiles.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.head, { color: colors.text }]}>Collections</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {tiles.map((c) => (
          <PressableScale
            key={c.id}
            onPress={() => onSelectCategory(c.categoryId)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={`${c.label}, ${c.count} recipe${c.count === 1 ? "" : "s"}`}
            style={styles.tile}
          >
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={`coll-${c.id}`} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={c.gradient[0]} />
                  <Stop offset="100%" stopColor={c.gradient[1]} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#coll-${c.id})`} />
            </Svg>
            <View style={styles.tileBody}>
              <Text style={styles.tileName} numberOfLines={2}>
                {c.label}
              </Text>
              <Text style={styles.tileCount}>
                {c.count} recipe{c.count === 1 ? "" : "s"}
              </Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.xl },
  head: { ...Type.navTitle, marginBottom: Spacing.sm },
  scroll: { marginHorizontal: -Spacing.lg },
  row: { gap: Spacing.dense, paddingHorizontal: Spacing.lg, paddingVertical: 2 },
  tile: {
    width: TILE_W,
    aspectRatio: 1.4,
    borderRadius: Radius.xl,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  tileBody: { padding: Spacing.dense },
  tileName: {
    ...Type.bodyLarge,
    lineHeight: 19,
    color: "#fff",
  },
  tileCount: { fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 2 },
});

export default DiscoverCollections;
