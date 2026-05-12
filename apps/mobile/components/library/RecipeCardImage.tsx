import { useState } from "react";
import { Image, View, type ImageStyle } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";
import { RecipeHeroFallback } from "../RecipeHeroFallback";

/**
 * Library recipe card image with on-error fallback (audit 2026-05-04 #28;
 * B7 hero-fallback rework 2026-05-11).
 *
 * Renders the photo when the URL loads cleanly. Swaps to a per-recipe
 * deterministic `<RecipeHeroFallback>` placeholder (gradient + glyph,
 * seeded by recipe id) when:
 *   - no URI was supplied upstream AND a recipe `id`+`title` are
 *     available (the B7 path — same gradient as the Discover hero so
 *     cards match the detail-screen placeholder), OR
 *   - the Image component reports a load failure (network blip, expired
 *     stock URL, 404 — the actually-live fallback path in production).
 *
 * Falls back to the legacy neutral utensils-glyph placeholder only when
 * the caller doesn't pass an id/title (defensive — every Library + Saved
 * card has both today).
 */
export function RecipeCardImage({
  uri,
  cardImageStyle,
  fallbackBg,
  fallbackTint,
  recipeId,
  recipeTitle,
}: {
  uri: string | null | undefined;
  cardImageStyle: ImageStyle;
  fallbackBg: string;
  fallbackTint: string;
  /** Recipe id — required for the per-recipe deterministic placeholder. */
  recipeId?: string;
  /** Recipe title — used by the placeholder glyph picker. */
  recipeTitle?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !uri || errored;
  if (showPlaceholder) {
    if (recipeId && recipeTitle) {
      return (
        <View
          style={[
            cardImageStyle,
            { backgroundColor: fallbackBg, position: "relative", overflow: "hidden" },
          ]}
          testID={`recipe-card-image-fallback-${recipeId}`}
        >
          <RecipeHeroFallback id={recipeId} title={recipeTitle} iconSize={32} />
        </View>
      );
    }
    // Defensive legacy path — kept for callers that don't pass id/title.
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
