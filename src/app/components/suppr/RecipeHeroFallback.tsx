/**
 * Web renderer for the Discover / Library recipe hero fallback.
 * Shared utility in `src/lib/recipe/recipeHeroFallback.ts` picks
 * the bucket + pattern; this file converts that spec to inline
 * SVG. Mobile parity: `apps/mobile/components/RecipeHeroFallback.tsx`.
 *
 * See `docs/design/discover-hero-fallback.md` for the design
 * intent (D8).
 */
import { memo } from "react";
import {
  Salad,
  Beef,
  Fish,
  Pizza,
  Cookie,
  Soup,
  Wheat,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  getRecipeFallback,
  patternSvgContent,
  type RecipeHeroGlyph,
  type RecipeHeroInput,
} from "../../../lib/recipe/recipeHeroFallback";

const GLYPHS: Record<RecipeHeroGlyph, LucideIcon> = {
  Salad,
  Beef,
  Fish,
  Pizza,
  Cookie,
  Soup,
  Wheat,
  Utensils,
};

export interface RecipeHeroFallbackProps extends RecipeHeroInput {
  /** Icon size in px. Defaults to 32 per §2 of the brief. */
  iconSize?: number;
  /** Optional className on the wrapping `<div>` (positioning only). */
  className?: string;
  /** Passes through to testing. */
  testId?: string;
}

function RecipeHeroFallbackImpl({ iconSize = 32, className, testId, ...input }: RecipeHeroFallbackProps) {
  const fb = getRecipeFallback(input);
  const Glyph = GLYPHS[fb.glyph];
  const patternId = `hero-pattern-${fb.pattern}-${fb.bucket}-${input.id}`;
  const gradientId = `hero-gradient-${fb.bucket}-${input.id}`;
  return (
    <div
      className={className}
      data-testid={testId ?? `recipe-hero-fallback-${input.id}`}
      data-bucket={fb.bucket}
      data-pattern={fb.pattern}
      data-glyph={fb.glyph}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: "block", position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
            gradientTransform="rotate(45 0.5 0.5)"
          >
            <stop offset="0%" stopColor={fb.gradientStart} />
            <stop offset="100%" stopColor={fb.gradientEnd} />
          </linearGradient>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            // SVG `preserveAspectRatio="none"` stretches the
            // viewBox; we keep the pattern in real user-space
            // units so the tile stays visually 24×24 regardless
            // of the card aspect ratio.
            patternContentUnits="userSpaceOnUse"
            dangerouslySetInnerHTML={{ __html: patternSvgContent(fb.pattern, fb.patternColor) }}
          />
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        <rect x="0" y="0" width="100" height="100" fill={`url(#${patternId})`} />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <Glyph
          width={iconSize}
          height={iconSize}
          style={{ color: fb.glyphColor }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export const RecipeHeroFallback = memo(RecipeHeroFallbackImpl);
