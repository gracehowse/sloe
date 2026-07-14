import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type ImageStyle, type StyleProp } from "react-native";

import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { recipeUnderlayColor } from "@suppr/shared/recipe/recipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useResolvedScheme } from "@/context/theme";
import { decodeEntities } from "@/lib/decodeEntities";
import type { RecipeCard } from "@/lib/types";
import { displayAttribution } from "@suppr/shared/recipes/displayAttribution";
import { recipeCardAccessibilityLabel } from "@suppr/shared/recipes/recipeCardAccessibilityLabel";

/** Row thumbnail: if `uri` 404s, show the same glyph box as missing image. */
function DiscoverCoverImage({
  uri,
  style,
  fallback,
}: {
  uri: string | null | undefined;
  style: StyleProp<ImageStyle>;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const trimmed = (uri ?? "").trim();
  if (!trimmed || broken) return <>{fallback}</>;
  return (
    <SmartImage
      source={{ uri: trimmed }}
      style={style}
      resizeMode="cover"
      recyclingKey={trimmed}
      accessibilityIgnoresInvertColors
      onError={() => setBroken(true)}
    />
  );
}

export interface DiscoverMoreIdeaRowProps {
  item: RecipeCard;
  /** Row index — rows after the first get a top divider so the parent card reads as a divider sequence. */
  idx: number;
  onPress: () => void;
}

/**
 * DiscoverMoreIdeaRow — the compact "More ideas" list row: 56px thumbnail (warm
 * sage→cream fallback when image-less), title + source·time, trailing kcal/P/C.
 * Extracted verbatim from `discover.tsx` (ENG-1225 Block 6 pre-work) to free host
 * line-budget; behaviour unchanged. Web parity: `DiscoverFeed.tsx` list rows.
 */
export function DiscoverMoreIdeaRow({ item, idx, onPress }: DiscoverMoreIdeaRowProps) {
  const colors = useThemeColors();
  const scheme = useResolvedScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const kcal = Math.round(item.calories);
  const protein = Math.round(item.protein);
  const carbs = Math.round(item.carbs);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipeCardAccessibilityLabel({
        title: decodeEntities(item.title),
        calories: kcal,
        protein,
        carbs,
        cookTime: item.cookTime ?? null,
      })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        padding: Spacing.md,
        borderTopWidth: idx > 0 ? 1 : 0,
        borderTopColor: colors.cardBorder,
      }}
    >
      {/* ENG-1374 PR 2 — the thumb wrapper paints the recipe's opaque
          §11.4 cuisine tint (was `colors.card` #FFFFFF on the fallback
          branch, and bare on the photo branch), so a 404 or a failed
          fallback SVG mount never exposes page white. */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: Radius.xl,
          overflow: "hidden",
          backgroundColor: recipeUnderlayColor({ id: item.id, title: item.title }, scheme),
        }}
      >
        <DiscoverCoverImage
          uri={item.image}
          style={{ width: "100%", height: "100%" }}
          fallback={<RecipeHeroFallback id={item.id} title={item.title} iconSize={20} />}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...Type.headline, fontWeight: "600", color: colors.text }} numberOfLines={1}>
          {decodeEntities(item.title)}
        </Text>
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
          {displayAttribution({ creatorName: item.creatorName, source: item.source })}
          {item.cookTime ? ` · ${item.cookTime}` : ""}
        </Text>
      </View>
      <Text style={{ ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
        <Text style={{ fontWeight: "600", color: colors.text }}>{kcal}</Text>
        {` · ${protein}P · ${carbs}C`}
      </Text>
    </Pressable>
  );
}

export default DiscoverMoreIdeaRow;
