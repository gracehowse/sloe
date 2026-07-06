import { useState } from "react";
import { StyleSheet, View, type ImageStyle } from "react-native";
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
    // ENG-1382 — most consumers pass a plain `{width:"100%", height:"100%"}`
    // `cardImageStyle` sized by a fixed-height wrapper `View`, which needs
    // `position: "relative"` here to establish its own box. But
    // `FeaturedHero` passes `StyleSheet.absoluteFillObject`
    // (`position: "absolute", top/left/right/bottom: 0`) to fill an
    // already-sized, already-`position:"relative"` wrapper — appending
    // `{ position: "relative" }` after it in the style array clobbered that
    // `"absolute"`, collapsing the fallback to zero size (RN style arrays
    // merge left-to-right, last write wins). Only default to "relative"
    // when the caller hasn't already declared a position, so every current
    // and future `cardImageStyle` (absolute-fill or width/height) keeps its
    // own positioning intact.
    const flattened = StyleSheet.flatten(cardImageStyle);
    const positionStyle = flattened.position ? null : { position: "relative" as const };
    return (
      <View
        // ENG-1374 structural guarantee — `fallbackBg` paints the wrapper
        // itself (not just `SmartImage`'s loading placeholder below), so
        // even if `RecipeHeroFallback`'s SVG failed to mount for any
        // reason, this box is never bare/transparent over the page
        // background.
        style={[cardImageStyle, positionStyle, { overflow: "hidden", backgroundColor: fallbackBg }]}
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
