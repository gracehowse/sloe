import { useState } from "react";
import { Image, View, type ImageStyle } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";

/**
 * Library recipe card image with on-error fallback (audit 2026-05-04 #28).
 *
 * Renders the photo when the URL loads cleanly. Swaps to a neutral
 * placeholder surface (soft-grey background + utensils glyph) when:
 *   - no URI was supplied upstream (defensive — `useSavedLibraryRecipes`
 *     resolves a stock URL via `pickDefaultImage` for empty `image_url`,
 *     so this path only fires for pathological data), OR
 *   - the Image component reports a load failure (network blip, expired
 *     stock URL, 404 — the actually-live fallback path in production).
 *
 * Same visual treatment as the cook empty-state placeholder so cross-
 * surface consistency holds.
 */
export function RecipeCardImage({
  uri,
  cardImageStyle,
  fallbackBg,
  fallbackTint,
}: {
  uri: string | null | undefined;
  cardImageStyle: ImageStyle;
  fallbackBg: string;
  fallbackTint: string;
}) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !uri || errored;
  if (showPlaceholder) {
    return (
      <View style={[cardImageStyle, { backgroundColor: fallbackBg, alignItems: "center", justifyContent: "center" }]}>
        <UtensilsCrossed size={32} color={fallbackTint} strokeWidth={1.5} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={cardImageStyle}
      resizeMode="cover"
      onError={() => setErrored(true)}
    />
  );
}
