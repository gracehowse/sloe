/**
 * Web ingredient image tile — the small leading thumbnail on a recipe-
 * detail ingredient row. Renders the on-brand `ingredient_images` photo
 * when one exists, else the calm cream + sage-initial placeholder.
 *
 * Part of the Sloe image system (2026-06-08). Spec + determinism live in
 * `src/lib/recipe/ingredientImageTile.ts`; mobile parity:
 * `apps/mobile/components/IngredientImageTile.tsx`.
 *
 * Extracted as its own component (not inlined into the ~2.6k-line
 * `RecipeDetail.tsx`) per the screen-size governance — new touches move
 * toward the 400-line target, not away from it.
 */
import { memo } from "react";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "../../../lib/recipe/ingredientImageTile";

export interface IngredientImageTileProps {
  /** Raw ingredient name (the stored `recipe_ingredients.name`). Used
   *  to key the image map + derive the placeholder initial. */
  name: string;
  /** Hydrated `name_key → image_url` map from `fetchIngredientImageMap`.
   *  Empty/absent → placeholder. */
  imageMap?: ReadonlyMap<string, string> | null;
  /** Square tile size in px. Default 32 (ingredient-row scale). */
  size?: number;
  className?: string;
  testId?: string;
}

function IngredientImageTileImpl({
  name,
  imageMap,
  size = 32,
  className,
  testId,
}: IngredientImageTileProps) {
  const url = resolveIngredientTileImage(name, imageMap);
  const ph = getIngredientTilePlaceholder(name);
  const radius = Math.round(size * 0.25);

  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={className}
        data-testid={testId ?? "ingredient-image-tile"}
        data-tile="image"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          // Photos are on white; a hairline keeps the edge crisp on cream.
          border: "1px solid var(--border, #ECEAE4)",
        }}
      />
    );
  }

  return (
    <div
      className={className}
      data-testid={testId ?? "ingredient-image-tile"}
      data-tile="placeholder"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        backgroundColor: ph.bg,
        color: ph.fg,
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {ph.initial}
    </div>
  );
}

export const IngredientImageTile = memo(IngredientImageTileImpl);
