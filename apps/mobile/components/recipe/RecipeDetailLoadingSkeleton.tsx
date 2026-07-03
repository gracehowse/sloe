import { StyleSheet, View } from "react-native";

import { Shimmer } from "@/components/ui/SkeletonRow";
import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { RECIPE_HERO_HEIGHT } from "./RecipeDetailHero";

/**
 * RecipeDetailLoadingSkeleton — ENG-1343.
 *
 * Replaces the bare centred `ActivityIndicator` on a blank ground (which
 * hard-cut to the full layout when the recipe resolved) with a silhouette of
 * the loaded screen: full-bleed hero (with the overlaid back / save / share
 * control chips) → title block (two-line title + attribution) → fits-your-day
 * verdict chip → an ingredients section (label + a few rows). Reuses the shared
 * `Shimmer` pulse the Burn / Today / Discover / Library skeletons use, the same
 * `RECIPE_HERO_HEIGHT` the real hero renders at, and only scale tokens — so the
 * placeholder occupies the exact footprint the content lands in (no reflow, no
 * invented copy).
 */
export function RecipeDetailLoadingSkeleton({ topInset = 0 }: { topInset?: number }) {
  const colors = useThemeColors();
  return (
    <View
      testID="recipe-detail-loading-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading recipe"
    >
      {/* Full-bleed hero silhouette + the hero's overlaid control chips. */}
      <View>
        <Shimmer style={{ width: "100%", height: RECIPE_HERO_HEIGHT, borderRadius: 0 }} />
        <View style={[styles.heroControls, { top: topInset + Spacing.sm }]}>
          <Shimmer style={styles.controlChip} />
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <Shimmer style={styles.controlChip} />
            <Shimmer style={styles.controlChip} />
            <Shimmer style={styles.controlChip} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Title block — two-line title + attribution line. */}
        <View style={{ gap: Spacing.sm }}>
          <Shimmer style={{ width: "82%", height: 26, borderRadius: Radius.sm }} />
          <Shimmer style={{ width: "54%", height: 26, borderRadius: Radius.sm }} />
          <Shimmer style={{ width: "40%", height: 13, borderRadius: Radius.sm, marginTop: Spacing.xs }} />
        </View>

        {/* Fits-your-day verdict chip. */}
        <Shimmer style={{ width: 148, height: 30, borderRadius: Radius.full }} />

        {/* Ingredients section — label + rows. */}
        <View style={{ gap: Spacing.md }}>
          <Shimmer style={{ width: 104, height: 11, borderRadius: Radius.sm }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.ingredientRow}>
              <Shimmer style={{ width: 8, height: 8, borderRadius: Radius.full }} />
              <Shimmer
                style={{ flex: 1, maxWidth: `${76 - i * 7}%`, height: 13, borderRadius: Radius.sm }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroControls: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlChip: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
  },
  body: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
  },
});
