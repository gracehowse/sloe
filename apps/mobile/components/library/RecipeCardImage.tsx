import { useState } from "react";
import { View, type ImageStyle } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";
import { FoodFallbackThumb } from "@/components/imagery/FoodFallbackThumb";
import { SmartImage } from "@/components/ui/SmartImage";

/**
 * Library recipe card image with on-error fallback (audit 2026-05-04 #28;
 * ENG-1015 painterly samples when no photo loads).
 *
 * Renders the photo when the URL loads cleanly. Swaps to
 * `<FoodFallbackThumb>` (category sample or utensil glyph) when:
 *   - no URI was supplied upstream AND a recipe `id`+`title` are
 *     available, OR
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
  /** Recipe title — used by the painterly category resolver. */
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
          <FoodFallbackThumb
            title={recipeTitle}
            style={{ width: "100%", height: "100%", borderRadius: 0 }}
            testID={`recipe-card-food-fallback-${recipeId}`}
          />
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
    <SmartImage
      source={{ uri }}
      style={cardImageStyle}
      resizeMode="cover"
      onError={() => setErrored(true)}
      recyclingKey={recipeId ?? uri}
      placeholderColor={fallbackBg}
    />
  );
}
