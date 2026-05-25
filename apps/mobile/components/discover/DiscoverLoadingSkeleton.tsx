import { View } from "react-native";

import { Spacing } from "@/constants/theme";
import { SkeletonCard, SkeletonRow } from "@/components/ui/SkeletonRow";

/**
 * Discover feed loading — hero + compact-row silhouettes (ENG-604).
 * Replaces the centred large spinner on cold load.
 */
export function DiscoverLoadingSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading recipes">
      <SkeletonCard hero lines={2} style={{ marginBottom: Spacing.md }} />
      <SkeletonCard hero lines={2} style={{ marginBottom: Spacing.lg }} />
      <View style={{ gap: 8 }}>
        <SkeletonRow lines={2} />
        <SkeletonRow lines={2} />
        <SkeletonRow lines={1} thumb={false} />
      </View>
    </View>
  );
}
