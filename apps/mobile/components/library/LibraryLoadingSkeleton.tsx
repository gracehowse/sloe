import { View } from "react-native";

import { Spacing } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { SkeletonCard } from "@/components/ui/SkeletonRow";

/**
 * Library cold-load skeleton — Figma `324:2` L2 Recipes loading / `527:2`
 * 2-column grid silhouette (ENG-896). Replaces the centred spinner on first
 * fetch when the saved-recipes list is still empty.
 */
export function LibraryLoadingSkeleton() {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your recipes"
      testID="library-loading-skeleton"
      style={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}
    >
      <View style={{ flexDirection: "row", gap: Spacing.md }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard
            hero
            lines={2}
            style={{ borderRadius: CARD_RADIUS, overflow: "hidden" }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard
            hero
            lines={2}
            style={{ borderRadius: CARD_RADIUS, overflow: "hidden" }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.md }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard
            hero
            lines={2}
            style={{ borderRadius: CARD_RADIUS, overflow: "hidden" }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard
            hero
            lines={2}
            style={{ borderRadius: CARD_RADIUS, overflow: "hidden" }}
          />
        </View>
      </View>
    </View>
  );
}
