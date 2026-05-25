"use client";

import { useState } from "react";
import { RecipeHeroFallback } from "./RecipeHeroFallback";

type DiscoverRecipeImageProps = {
  id: string;
  title: string;
  image?: string | null;
  iconSize?: number;
  className?: string;
  aspectRatio?: string;
  /** Compact list row (More ideas). */
  variant?: "hero" | "thumb";
};

/**
 * Discover card hero — falls back to gradient when URL 404s (stale Unsplash seeds).
 */
export function DiscoverRecipeImage({
  id,
  title,
  image,
  iconSize = 24,
  className = "w-full h-full object-cover",
  aspectRatio = "16 / 10",
  variant = "hero",
}: DiscoverRecipeImageProps) {
  const [broken, setBroken] = useState(false);

  if (variant === "thumb") {
    if (!image?.trim() || broken) {
      return (
        <span className="w-10 h-10 rounded-lg bg-muted inline-flex items-center justify-center shrink-0 overflow-hidden">
          <RecipeHeroFallback id={id} title={title} iconSize={iconSize} />
        </span>
      );
    }
    return (
      <span className="w-10 h-10 rounded-lg bg-muted inline-flex shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className={className}
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  if (!image?.trim() || broken) {
    return (
      <div className="relative overflow-hidden w-full h-full" style={{ aspectRatio }}>
        <RecipeHeroFallback id={id} title={title} iconSize={iconSize} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full h-full" style={{ aspectRatio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        className={className}
        onError={() => setBroken(true)}
      />
    </div>
  );
}
