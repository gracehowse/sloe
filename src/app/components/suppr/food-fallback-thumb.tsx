"use client";

import * as React from "react";
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Drumstick,
  Fish,
  Pizza,
  Salad,
  Soup,
  Sun,
  Utensils,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  FOOD_FALLBACK_GLYPH_COLOR,
  resolveFoodFallback,
  resolveFoodFallbackSampleCategory,
  type FoodFallbackGlyph,
  type MealSlotName,
} from "../../../lib/imagery/foodFallbackCategory";
import { cn } from "../ui/utils";

const SAMPLE_SRC_BY_CATEGORY = {
  "ramen-noodles": "/imagery/fallbacks/samples/ramen-bowl.png",
  "breakfast-bowl": "/imagery/fallbacks/samples/berry-breakfast-bowl.png",
  chicken: "/imagery/fallbacks/samples/roast-chicken.png",
  salad: "/imagery/fallbacks/samples/green-salad.png",
  pasta: "/imagery/fallbacks/samples/pasta-tomato.png",
  smoothie: "/imagery/fallbacks/samples/berry-smoothie.png",
} as const;

const GLYPHS: Record<FoodFallbackGlyph, LucideIcon> = {
  Salad,
  Beef,
  Fish,
  Pizza,
  Cookie,
  Soup,
  Wheat,
  Utensils,
  UtensilsCrossed,
  Coffee,
  Apple,
  Drumstick,
  Sun,
};

export interface FoodFallbackThumbProps {
  title: string;
  /** Meal slot ("Breakfast"/"Lunch"/…) — enables the slot tier when the
   *  title misses every confident keyword. Mirror of the mobile prop. */
  slot?: MealSlotName | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
  testId?: string;
}

/**
 * Tiered food-row thumbnail (ENG-1448 PR 1, supersedes the ENG-1015
 * sample-or-glyph pair). Real photo when available; else the shipped
 * category sample ONLY on a confident keyword hit; else the slot or
 * generic glyph. The wrapper carries an opaque §11.4 tint underlay so
 * no child failure (broken URL, missing asset) can expose white — and
 * no tier ever fabricates a wrong specific food image.
 */
export function FoodFallbackThumb({
  title,
  slot,
  imageUrl,
  size = 36,
  className,
  testId,
}: FoodFallbackThumbProps) {
  const [errored, setErrored] = React.useState(false);

  const resolution = resolveFoodFallback(title, { slot });
  const sampleCategory =
    resolution.tier === "category"
      ? resolveFoodFallbackSampleCategory(resolution.category)
      : null;
  const sampleSrc = sampleCategory
    ? SAMPLE_SRC_BY_CATEGORY[sampleCategory as keyof typeof SAMPLE_SRC_BY_CATEGORY]
    : undefined;

  const showPhoto = Boolean(imageUrl) && !errored;
  const src = showPhoto ? imageUrl! : sampleSrc;
  const Glyph = GLYPHS[resolution.glyph];

  return (
    <div
      data-testid={
        testId ??
        (src
          ? showPhoto
            ? "food-thumb-photo"
            : `food-fallback-${sampleCategory}`
          : "food-fallback-glyph")
      }
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        className,
      )}
      // Opaque tint underlay — the never-white guarantee.
      style={{ width: size, height: size, backgroundColor: resolution.tint }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
          onError={showPhoto ? () => setErrored(true) : undefined}
        />
      ) : (
        <Glyph
          size={Math.round(size * 0.44)}
          color={FOOD_FALLBACK_GLYPH_COLOR}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </div>
  );
}

export default FoodFallbackThumb;
