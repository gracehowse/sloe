"use client";

import * as React from "react";
import { Utensils } from "lucide-react";
import {
  resolveFoodFallbackCategory,
  resolveFoodFallbackSampleCategory,
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

export interface FoodFallbackThumbProps {
  title: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
  testId?: string;
}

/**
 * Painterly food-row thumbnail (ENG-1015). Real photo when available; else
 * deterministic category sample; else utensil glyph fallback.
 */
export function FoodFallbackThumb({
  title,
  imageUrl,
  size = 36,
  className,
  testId,
}: FoodFallbackThumbProps) {
  const [errored, setErrored] = React.useState(false);

  const baseClass = cn(
    "shrink-0 rounded-md bg-muted object-cover",
    className,
  );
  const dimension = { width: size, height: size };

  if (imageUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        data-testid={testId}
        className={baseClass}
        style={dimension}
        onError={() => setErrored(true)}
      />
    );
  }

  const category = resolveFoodFallbackCategory({ title });
  // ENG-1478 — null when the category has no shipped sample: render the
  // glyph rather than a wrong specific food image (fish ≠ berry smoothie).
  const sampleCategory = resolveFoodFallbackSampleCategory(category);
  const sampleSrc = sampleCategory
    ? SAMPLE_SRC_BY_CATEGORY[sampleCategory as keyof typeof SAMPLE_SRC_BY_CATEGORY]
    : undefined;

  if (sampleSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sampleSrc}
        alt=""
        aria-hidden
        data-testid={testId ?? `food-fallback-${sampleCategory}`}
        className={baseClass}
        style={dimension}
      />
    );
  }

  return (
    <div
      data-testid={testId ?? "food-fallback-glyph"}
      aria-hidden
      className={cn(baseClass, "flex items-center justify-center")}
      style={dimension}
    >
      <Utensils
        size={Math.round(size * 0.44)}
        className="text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  );
}

export default FoodFallbackThumb;
