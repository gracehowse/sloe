import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { DiscoverCoverImage } from "@/components/discover/DiscoverCoverImage";
import { decodeEntities } from "@/lib/decodeEntities";
import { Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { displayAttribution } from "@suppr/shared/recipes/displayAttribution";
import { recipeCardAccessibilityLabel } from "@suppr/shared/recipes/recipeCardAccessibilityLabel";
import type { RecipeCard } from "@/lib/types";

/**
 * Discover cuisine-rail card (ENG-695) — image-forward browse card that mirrors
 * web `DiscoverFeed.tsx` cluster-carousel cards: a full-bleed photo with the
 * title + one quiet meta line OVERLAID at the bottom over a dark scrim. The
 * first card in a rail is a larger "hero" (3:4) vs the rest (4:5).
 *
 * Deliberately NO macro rainbow (premium-spec 2026-05-26 + ENG-695 scope): browse
 * cards stay image-forward; macros live on the recipe detail, not the card.
 *
 * Scrim is an `react-native-svg` LinearGradient (already a dep — same approach as
 * RecipeDetailHero) rather than `expo-linear-gradient` (not installed → would need
 * a native rebuild). White title legibility over the no-photo RecipeHeroFallback
 * tile is the watch-item — the scrim keeps the bottom dark enough for AA.
 */
const HERO = { width: 224, height: 298 }; // ~3:4
const STD = { width: 160, height: 200 }; // 4:5

export function DiscoverRailCard({
  item,
  isHero = false,
  onPress,
}: {
  item: RecipeCard;
  isHero?: boolean;
  onPress: () => void;
}) {
  const kcal = Math.round(item.calories);
  const protein = Math.round(item.protein);
  const dim = isHero ? HERO : STD;
  const title = decodeEntities(item.title);
  const scrimId = `rail-scrim-${item.id}`;
  const meta = [
    displayAttribution({ creatorName: item.creatorName, source: item.source }),
    item.cookTime,
    `${kcal} kcal`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <PressableScale
      haptic="confirm"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipeCardAccessibilityLabel({
        title,
        calories: kcal,
        protein,
        cookTime: item.cookTime ?? null,
      })}
      style={{ width: dim.width, borderRadius: CARD_RADIUS, overflow: "hidden" }}
    >
      <View style={{ width: dim.width, height: dim.height }}>
        <DiscoverCoverImage
          uri={item.image}
          style={{ width: "100%", height: "100%" }}
          fallback={
            <View style={{ width: "100%", height: "100%" }}>
              <RecipeHeroFallback id={item.id} title={item.title} iconSize={isHero ? 40 : 28} />
            </View>
          }
        />

        {/* Bottom-up dark scrim so the white title clears AA over both photos
            and the lighter no-photo fallback tile. */}
        <Svg
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(dim.height * 0.62) }}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={scrimId} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.74} />
              <Stop offset="0.55" stopColor="#000000" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${scrimId})`} />
        </Svg>

        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14 }}>
          <Text numberOfLines={2} style={{ ...Type.headline, color: "#FFFFFF", fontWeight: "700" }}>
            {title}
          </Text>
          {meta ? (
            <Text
              numberOfLines={1}
              style={{ ...Type.caption, color: "rgba(255,255,255,0.85)", marginTop: 4, fontVariant: ["tabular-nums"] }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
