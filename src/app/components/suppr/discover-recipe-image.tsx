"use client";

import { useState } from "react";
import Image from "next/image";
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
  /**
   * Responsive `sizes` hint for the optimizer's srcset. Defaults to a
   * conservative full-width-on-mobile / 3-col-on-desktop estimate that
   * matches the Discover grid + hero layouts. Callers can override when
   * the card width is known more precisely.
   */
  sizes?: string;
};

/**
 * Hosts whose image URLs are bounded + trusted enough to route through
 * Next's on-the-fly image optimizer (AVIF/WebP + srcset). These mirror
 * `images.remotePatterns` in `next.config.ts`:
 *   - `images.unsplash.com` — seed recipe heroes (+ DEFAULT_UPLOADED_RECIPE_IMAGE)
 *   - `*.supabase.co`        — user-uploaded recipe images in storage
 *   - `img.youtube.com`      — YouTube thumbnails derived at render time
 *
 * Recipe images can ALSO be arbitrary user-imported URLs (og:image /
 * twitter:image / JSON-LD scraped from any recipe page or social post —
 * see `src/lib/recipe-import/parseRecipeFromHtml.ts`). That host set is
 * unbounded and user-controlled, so we must NOT route it through the
 * optimizer — doing so would turn `/_next/image` into an open fetch
 * proxy for any URL a user can paste (SSRF-adjacent + bandwidth
 * amplification). For those hosts we render `next/image` with
 * `unoptimized`, which still gives lazy-loading, async decoding, and
 * intrinsic sizing (no layout shift) — just no server-side transcode.
 *
 * The long-term fix is to rehost imported images into Supabase storage
 * at import time so the whole feed becomes optimizable under a single
 * allowlist; that's a backend/importer change tracked separately
 * (out of scope for ENG-704, web-only image migration).
 */
const OPTIMIZABLE_HOST_SUFFIXES = [
  "images.unsplash.com",
  ".supabase.co",
  "img.youtube.com",
] as const;

function canOptimize(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Relative / malformed URLs can't be matched against remotePatterns;
    // treat as un-optimizable so the build never sees an un-allowlisted host.
    return false;
  }
  return OPTIMIZABLE_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? host.endsWith(suffix) : host === suffix,
  );
}

/**
 * Discover card hero — falls back to gradient when URL 404s (stale
 * Unsplash seeds) or is missing. Uses `next/image` for lazy-loading +
 * responsive srcset on allowlisted hosts; arbitrary user-imported hosts
 * render unoptimized (still lazy) so the optimizer can't be abused.
 */
export function DiscoverRecipeImage({
  id,
  title,
  image,
  iconSize = 24,
  className = "object-cover",
  aspectRatio = "16 / 10",
  variant = "hero",
  sizes,
}: DiscoverRecipeImageProps) {
  const [broken, setBroken] = useState(false);

  const trimmed = image?.trim() || "";

  if (variant === "thumb") {
    if (!trimmed || broken) {
      return (
        <span className="w-10 h-10 rounded-lg bg-muted inline-flex items-center justify-center shrink-0 overflow-hidden">
          <RecipeHeroFallback id={id} title={title} iconSize={iconSize} />
        </span>
      );
    }
    return (
      <span className="relative w-10 h-10 rounded-lg bg-muted inline-flex shrink-0 overflow-hidden">
        <Image
          src={trimmed}
          alt=""
          fill
          // 40px box; 2x for retina. Fixed size, so a single hint is exact.
          sizes={sizes ?? "40px"}
          unoptimized={!canOptimize(trimmed)}
          className={className}
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  if (!trimmed || broken) {
    return (
      <div className="relative overflow-hidden w-full h-full" style={{ aspectRatio }}>
        <RecipeHeroFallback id={id} title={title} iconSize={iconSize} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full h-full" style={{ aspectRatio }}>
      <Image
        src={trimmed}
        alt=""
        fill
        // Full-width on mobile, ~1/3 of a 1152px content canvas at md+.
        sizes={sizes ?? "(min-width: 768px) 33vw, 100vw"}
        unoptimized={!canOptimize(trimmed)}
        className={className}
        onError={() => setBroken(true)}
      />
    </div>
  );
}
