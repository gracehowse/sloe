/**
 * Ingredient image tile — shared spec for the small leading thumbnail
 * on each ingredient row (recipe detail, shopping, verify).
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * When `ingredient_images` has a `ready` image for the ingredient we
 * render that photo (stylised-photoreal on white, Template B). Until the
 * backfill runs the table is empty, so we render a calm placeholder
 * instead: a warm cream tile with the ingredient's initial in sage —
 * deterministic per name so the same ingredient always looks the same.
 *
 * This mirrors the §11.4 fallback hierarchy (warm placeholder, never a
 * grey box, never a broken-image icon) at the small ingredient scale.
 * Platform-agnostic: web (`IngredientImageTile.tsx`) and mobile
 * (`IngredientImageTile.tsx` under apps/mobile) both consume this so the
 * tile never drifts between platforms.
 *
 * Pure + sync. Safe in render.
 */

import { djb2 } from "./recipeHeroFallback";
import { normalizeIngredientNameKey } from "../planning/ingredientNameKey";

export interface IngredientTilePlaceholder {
  /** Single uppercase initial to render (the ingredient's first letter,
   *  or "·" when the name has no letters). */
  initial: string;
  /** Cream background fill (slightly varied per ingredient so a column
   *  of tiles isn't perfectly uniform, but always a calm cream). */
  bg: string;
  /** Sage colour for the initial. */
  fg: string;
}

/**
 * Two calm cream tints. The ingredient's normalised key deterministically
 * picks one so adjacent tiles get a gentle alternation without ever
 * leaving the cream family.
 */
const CREAM_TINTS = ["#F1EFE8", "#ECEAE1"] as const;

/** Sage `#7C8466` — the §11.4 mark colour, used for the initial. */
const SAGE = "#7C8466";

export function getIngredientTilePlaceholder(
  name: string | null | undefined,
): IngredientTilePlaceholder {
  const key = typeof name === "string" ? normalizeIngredientNameKey(name) : "";
  // First alphabetic character of the (cleaned) key, uppercased.
  const letter = key.match(/[a-z]/i)?.[0];
  const initial = letter ? letter.toUpperCase() : "·";
  const tint = CREAM_TINTS[djb2(key || "x") % CREAM_TINTS.length];
  return { initial, bg: tint, fg: SAGE };
}

/**
 * Resolve the tile's image URL for an ingredient, or `null` to render
 * the placeholder. The caller passes the hydrated `name_key → url` map
 * from `fetchIngredientImageMap`.
 */
export function resolveIngredientTileImage(
  name: string | null | undefined,
  imageMap: ReadonlyMap<string, string> | null | undefined,
): string | null {
  if (!imageMap || imageMap.size === 0) return null;
  const key = typeof name === "string" ? normalizeIngredientNameKey(name) : "";
  if (!key) return null;
  return imageMap.get(key) ?? null;
}
