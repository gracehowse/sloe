"use client";

import { useState } from "react";
import Image from "next/image";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { isFeatureEnabled } from "../../../lib/analytics/track";

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
  /**
   * ENG-1623 — decorative-vs-informative alt-text switch. See the "Alt
   * text contract" note above this component for the full rule; short
   * version:
   *   - `true` (default) — DECORATIVE (`alt=""`). Use whenever this image
   *     sits inside a card/row/link that already carries the recipe name
   *     as visible text or as the surrounding control's `aria-label`.
   *     Every current call site (Discover grid + carousel cards, the
   *     featured hero, quick-weeknight tiles, the "More ideas" thumb
   *     rows) qualifies, so the default keeps today's behaviour unchanged.
   *   - `false` — INFORMATIVE (`alt={title}`). Use ONLY when this image is
   *     the sole namer of the recipe at that position — a true page-level
   *     hero/detail placement with no adjacent title text or labelled
   *     control right next to it (e.g. `RecipeDetail`'s full-bleed hero,
   *     which sits above the page `<h1>` rather than beside a labelled
   *     card).
   *
   * Getting this backwards is exactly the ENG-1623 bug: `true` where the
   * card has no other name leaves the recipe unannounced; `false` where a
   * label/title already exists makes a screen reader say the recipe name
   * twice for one card.
   */
  decorative?: boolean;
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
 *
 * ## Alt-text contract (ENG-1623)
 *
 * This is the shared recipe-photo primitive most Discover surfaces route
 * through (grid + carousel cards, the featured hero, quick-weeknight
 * tiles, the "More ideas" thumb rows), so its alt-text behaviour is the
 * one place the decorative-vs-informative rule needs to live:
 *
 *   - **Decorative (`alt=""`, the `decorative` default of `true`)** — the
 *     right choice whenever this image is rendered inside a card, row, or
 *     link whose accessible name (visible text or `aria-label`) already
 *     includes the recipe title. The image would just repeat what a
 *     screen reader already announced for the card, so it stays silent.
 *     Every current call site is this shape.
 *   - **Informative (`alt={title}`, pass `decorative={false}`)** — the
 *     right choice only when this image is the sole namer of the recipe
 *     at that position: a genuine page-level hero/detail placement with
 *     no adjacent title text or labelled control (see `RecipeHeroImage`
 *     in `RecipeDetail.tsx` and the public `/recipe/[id]` page for the
 *     reference informative implementations).
 *
 * Broken/missing photos fall back to `RecipeHeroFallback`, whose SVG is
 * `aria-hidden` on purpose — the fallback never speaks for itself. Once a
 * caller wires the surrounding card/title correctly (per the rule above),
 * the recipe stays labelled through that broken/loading state exactly the
 * same as the loaded-photo state, decorative or informative.
 *
 * Get the switch backwards and either every card doubles its
 * announcement ("Kale Bowl. Kale Bowl.") or a lone hero photo goes
 * unlabelled — that duality is the bug this contract exists to prevent.
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
  decorative = true,
}: DiscoverRecipeImageProps) {
  const [broken, setBroken] = useState(false);
  const scheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const mediaPalette = isFeatureEnabled("recipe_sparse_media_v1") ? "plum-duotone" : "legacy-cuisine";

  const trimmed = image?.trim() || "";
  // ENG-1374 PR 2 structural guarantee — the wrapper itself paints the
  // recipe's opaque §11.4 cuisine tint (replacing the frost-grey
  // `bg-muted`, which §11.4 bans for imagery), so a 404, a slow load,
  // or a failed fallback SVG mount can never expose page white.
  const underlay = recipeUnderlayColor({ id, title }, scheme, mediaPalette);
  // ENG-1623 — see the "Alt-text contract" doc block above.
  const alt = decorative ? "" : title;

  if (variant === "thumb") {
    if (!trimmed || broken) {
      return (
        <span
          className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: underlay }}
        >
          <RecipeHeroFallback id={id} title={title} iconSize={iconSize} />
        </span>
      );
    }
    return (
      <span
        className="relative w-10 h-10 rounded-lg inline-flex shrink-0 overflow-hidden"
        style={{ backgroundColor: underlay }}
      >
        <Image
          src={trimmed}
          alt={alt}
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
      <div
        className="relative overflow-hidden w-full h-full"
        style={{ aspectRatio, backgroundColor: underlay }}
      >
        <RecipeHeroFallback id={id} title={title} iconSize={iconSize} variant="hero" />
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden w-full h-full"
      style={{ aspectRatio, backgroundColor: underlay }}
    >
      <Image
        src={trimmed}
        alt={alt}
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
