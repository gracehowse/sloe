import { useState } from "react";
import { View, type ImageStyle } from "react-native";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";

/**
 * Library / profile recipe card image with no-image + on-error fallback
 * (audit 2026-05-04 #28; honest imagery ENG-1287).
 *
 * Renders the photo when a URL is present and loads cleanly. When the
 * recipe has no image (`uri` null — never a substituted stock photo) or
 * the image fails to load, renders the deterministic `RecipeHeroFallback`
 * (cuisine-tinted cream gradient + food glyph, design system §11.4) — the
 * same treatment Discover cards, coach rows and the NorthStar card use,
 * keyed by recipe id + title so the tint is stable per recipe on both
 * platforms.
 */
export function RecipeCardImage({
  uri,
  cardImageStyle,
  fallbackBg,
  recipeId,
  recipeTitle,
}: {
  uri: string | null | undefined;
  cardImageStyle: ImageStyle;
  /** Solid tint painted under the photo while it fades in. */
  fallbackBg: string;
  /** Recipe id — keys the deterministic placeholder tint. */
  recipeId: string;
  /** Recipe title — picks the placeholder's cuisine glyph. */
  recipeTitle: string;
}) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !uri || errored;
  if (showPlaceholder) {
    return (
      <View
        style={[cardImageStyle, { position: "relative", overflow: "hidden" }]}
        testID={`recipe-card-image-fallback-${recipeId}`}
      >
        <RecipeHeroFallback id={recipeId} title={recipeTitle} iconSize={28} />
      </View>
    );
  }
  return (
    <SmartImage
      source={{ uri }}
      style={cardImageStyle}
      resizeMode="cover"
      onError={() => setErrored(true)}
      recyclingKey={recipeId}
      placeholderColor={fallbackBg}
    />
  );
}
