/**
 * Mobile ingredient image tile — the small leading thumbnail on a
 * recipe-detail ingredient row. Renders the on-brand `ingredient_images`
 * photo when one exists, else the calm cream + sage-initial placeholder.
 *
 * Part of the Sloe image system (2026-06-08). Spec + determinism live in
 * `src/lib/recipe/ingredientImageTile.ts` (consumed via @suppr/shared);
 * web parity: `src/app/components/suppr/IngredientImageTile.tsx`.
 *
 * Extracted as its own component (not inlined into the ~3.4k-line recipe
 * screen) per the screen-size governance — new touches move toward the
 * 400-line target, not away from it.
 */
import { memo } from "react";
import { Image, Text, View } from "react-native";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "@suppr/shared/recipe/ingredientImageTile";

export interface IngredientImageTileProps {
  /** Raw ingredient name (the stored `recipe_ingredients.name`). */
  name: string;
  /** Hydrated `name_key -> image_url` map. Empty/absent -> placeholder. */
  imageMap?: ReadonlyMap<string, string> | null;
  /** Square tile size in px. Default 32 (ingredient-row scale). */
  size?: number;
  testID?: string;
}

function IngredientImageTileImpl({
  name,
  imageMap,
  size = 32,
  testID,
}: IngredientImageTileProps) {
  const url = resolveIngredientTileImage(name, imageMap);
  const ph = getIngredientTilePlaceholder(name);
  const radius = Math.round(size * 0.25);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID ?? "ingredient-image-tile"}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          // Photos are on white; a hairline keeps the edge crisp on cream.
          borderWidth: 1,
          borderColor: "#ECEAE4",
        }}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? "ingredient-image-tile"}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ph.bg,
      }}
    >
      <Text
        style={{
          color: ph.fg,
          fontWeight: "600",
          fontSize: Math.round(size * 0.42),
          lineHeight: Math.round(size * 0.42) + 2,
        }}
      >
        {ph.initial}
      </Text>
    </View>
  );
}

export const IngredientImageTile = memo(IngredientImageTileImpl);
