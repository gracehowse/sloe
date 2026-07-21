import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import type { RecipeCard } from "@/lib/types";
import { deriveQuickWeeknight } from "@suppr/shared/discover/quickWeeknight";
import { creatorTintFor } from "@suppr/shared/discover/creatorChipPresentation";
import { totalRecipeDurationMin } from "@suppr/shared/recipes/totalDuration";

/**
 * DiscoverQuickWeeknight — the Sloe v3 Discover "Quick weeknight" section
 * (ENG-1225 Block 6, prototype `.w-rgrid` ~L7570): fast recipes surfaced as
 * dense cards (time pill + serif name + kcal/protein/time meta) in a 2-col
 * grid. ENG-1618 routes the default-on photographic branch through the shared
 * recipe-image fallback; flag-off preserves the original NO-PHOTO tint card.
 * Self-gating: renders nothing unless `sloe_v3_discover_editorial` is on AND
 * there are quick recipes. Shares `deriveQuickWeeknight` with web.
 */
export interface DiscoverQuickWeeknightProps {
  /** The Discover feed recipes to filter for quick picks. */
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
  /** Feed position; omitted when the component is rendered in isolation. */
  placement?: "first" | "legacy";
}

export function DiscoverQuickWeeknight({
  recipes,
  onPressRecipe,
  placement,
}: DiscoverQuickWeeknightProps) {
  const colors = useThemeColors();
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const photographicFirstViewEnabled = isFeatureEnabled(
    "discover_photographic_first_view_v1",
  );
  const quick = useMemo(() => deriveQuickWeeknight(recipes), [recipes]);
  const hiddenAtPlacement =
    (placement === "first" && !photographicFirstViewEnabled) ||
    (placement === "legacy" && photographicFirstViewEnabled);
  if (!enabled || hiddenAtPlacement || quick.length === 0) return null;

  return (
    <View
      testID={placement === "first" ? "discover-photographic-first-view" : undefined}
      style={styles.wrap}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>Quick weeknight</Text>
        <Text style={[styles.sub, { color: colors.textTertiary }]}>
          Fast wins for the nights you have no time
        </Text>
      </View>
      <View style={styles.grid}>
        {quick.map((r) => {
          // ENG-1617 — one shared total (prep + cook) selector, not a local sum.
          const mins = totalRecipeDurationMin(r.prepTimeMin, r.cookTimeMin);
          const meta = [
            r.calories > 0 ? `${Math.round(r.calories)} kcal` : null,
            r.protein > 0 ? `${Math.round(r.protein)}g` : null,
            mins != null ? `${mins} min` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <PressableScale
              key={r.id}
              onPress={() => onPressRecipe(r)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${meta}`}
              style={styles.card}
            >
              <View
                testID={
                  photographicFirstViewEnabled
                    ? `quick-weeknight-photo-${r.id}`
                    : `quick-weeknight-tint-${r.id}`
                }
                style={[
                  styles.tint,
                  {
                    backgroundColor: photographicFirstViewEnabled
                      ? colors.backgroundSecondary
                      : creatorTintFor(r.id),
                  },
                ]}
              >
                {photographicFirstViewEnabled ? (
                  <RecipeCardImage
                    uri={r.image}
                    cardImageStyle={styles.photo}
                    recipeId={r.id}
                    recipeTitle={r.title}
                  />
                ) : (
                  <UtensilsCrossed
                    size={20}
                    color={colors.primaryForeground}
                    style={styles.tintIcon}
                  />
                )}
                {mins != null ? (
                  <View style={[styles.timePill, { backgroundColor: colors.card }]}>
                    <Text style={[styles.timePillText, { color: colors.text }]}>{mins} min</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {meta}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.xl },
  head: { marginBottom: Spacing.sm },
  title: { ...Type.navTitle },
  sub: { ...Type.caption, marginTop: Spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48%", marginBottom: Spacing.md },
  tint: {
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  tintIcon: { opacity: 0.5 },
  timePill: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  timePillText: { ...Type.caption, fontFamily: FontFamily.sansSemibold },
  name: { fontFamily: FontFamily.serifMedium, fontSize: 15, lineHeight: 19, marginTop: Spacing.sm },
  meta: { ...Type.caption, fontVariant: ["tabular-nums"], marginTop: Spacing.xs },
});

export default DiscoverQuickWeeknight;
