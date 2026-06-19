import { View, Text, ScrollView } from "react-native";

import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { DiscoverRailCard } from "@/components/discover/DiscoverRailCard";
import type { RecipeCard } from "@/lib/types";

/**
 * One cuisine rail on Discover (ENG-695) — a serif section header + a horizontal
 * scroll of image-overlay `DiscoverRailCard`s, mirroring web `DiscoverFeed.tsx`
 * cluster carousels. The first card renders as the larger hero variant. Renders
 * nothing when the cluster has no recipes (matches web).
 */
export function DiscoverCuisineRail({
  title,
  items,
  onPressRecipe,
}: {
  title: string;
  items: RecipeCard[];
  onPressRecipe: (id: string) => void;
}) {
  const colors = useThemeColors();
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: Spacing.xl }} testID={`discover-cuisine-rail-${title}`}>
      <Text style={{ ...Type.title, color: colors.navPrimary, marginBottom: Spacing.md }}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.md, paddingRight: Spacing.lg }}
      >
        {items.map((item, idx) => (
          <DiscoverRailCard
            key={`rail-${item.id}`}
            item={item}
            isHero={idx === 0}
            onPress={() => onPressRecipe(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
