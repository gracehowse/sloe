"use client";

import * as React from "react";
import {
  PROGRESSIVE_TEXT_RISE_PX,
  PROGRESSIVE_TEXT_TOKEN_MS,
  progressiveTextDelayMs,
  tokenizeProgressiveText,
} from "@/lib/motion";

/**
 * ProgressiveText — web (ENG-720).
 *
 * Word/clause-staggered text reveal for the two onboarding "moment" beats
 * (Welcome wordmark+tagline, Reveal "Your plan is ready." heading). Each
 * whitespace-delimited token fades in + rises `PROGRESSIVE_TEXT_RISE_PX`,
 * staggered by `PROGRESSIVE_TEXT_STAGGER_MS` (read from the shared
 * `@/lib/motion` source so the cadence can't drift from the mobile twin
 * `apps/mobile/components/onboarding/ProgressiveText.tsx`).
 *
 * Animation is via a CSS keyframe + per-token `animation-delay`; no JS RAF
 * loop, so there is nothing to clean up and SSR renders the final text.
 *
 * GATING — instant fallback (no animation) when EITHER:
 *   - `animate` is `false` (the call site passes
 *     `isFeatureEnabled("onboarding_progressive_text")` — default-OFF), OR
 *   - the user prefers reduced motion (`prefers-reduced-motion: reduce`,
 *     the same media query the odometer hook honours, `src/lib/useOdometer.ts`).
 *
 * In the instant case the component renders the plain string with zero extra
 * markup/animation, so flag-OFF onboarding is pixel-identical to before this
 * change.
 *
 * Tokenization keeps the trailing space on each token, so re-joining renders
 * identically to the source string (no collapsed spaces, no lost punctuation).
 * `aria-label` carries the full phrase and the per-token spans are
 * `aria-hidden`, so screen readers always announce the whole line regardless
 * of the staggered visual reveal.
 */

interface ProgressiveTextProps {
  /** The phrase to reveal. */
  children: string;
  /**
   * When `false` (default), or when the user prefers reduced motion, the text
   * renders instantly with no animation. Pass
   * `isFeatureEnabled("onboarding_progressive_text")`.
   */
  animate?: boolean;
  /** Tag to render as (the visual element). Defaults to `span`. */
  as?: "span" | "p" | "h1" | "h2" | "div";
  className?: string;
  style?: React.CSSProperties;
  /**
   * Explicit screen-reader label for the whole phrase. Forwarded to the root
   * element in BOTH the instant and animating paths. Use it where the visible
   * text differs from how it should be announced (e.g. the lowercase "sloe"
   * wordmark announced as "Sloe"). When omitted, the animating path falls back
   * to the visible text as the label so the staggered tokens still read as one
   * line; the instant path inherits the element's natural text.
   */
  "aria-label"?: string;
}

function usePrefersReducedMotion(): boolean {
  // Mirror of the odometer / win-moment reduced-motion read: synchronous on
  // mount, SSR-safe (defaults to false on the server so the first client paint
  // matches the system's opt-in convention).
  const [reduce] = React.useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduce;
}

export function ProgressiveText({
  children,
  animate = false,
  as: Tag = "span",
  className,
  style,
  "aria-label": ariaLabel,
}: ProgressiveTextProps) {
  const reduceMotion = usePrefersReducedMotion();
  const shouldAnimate = animate && !reduceMotion;

  // Instant fallback: plain text, zero extra markup. Pixel-identical to the
  // pre-ENG-720 surface when the flag is OFF or reduce-motion is on. The
  // explicit aria-label is forwarded so the cased wordmark label survives.
  if (!shouldAnimate) {
    return (
      <Tag className={className} style={style} aria-label={ariaLabel}>
        {children}
      </Tag>
    );
  }

  const tokens = tokenizeProgressiveText(children);

  return (
    <Tag className={className} style={style} aria-label={ariaLabel ?? children}>
      <style>{progressiveTextKeyframes}</style>
      {tokens.map((token, i) => (
        <span
          key={`${i}-${token}`}
          data-progressive-token
          aria-hidden
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            willChange: "opacity, transform",
            animationName: "suppr-progressive-text-token",
            animationDuration: `${PROGRESSIVE_TEXT_TOKEN_MS}ms`,
            animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            animationFillMode: "both",
            animationDelay: `${progressiveTextDelayMs(i)}ms`,
          }}
        >
          {token}
        </span>
      ))}
    </Tag>
  );
}

/**
 * The token reveal keyframe. Inlined (scoped to this component) rather than
 * added to `theme.css` so the animation ships with the component and the
 * instant-fallback path carries no global CSS. `prefers-reduced-motion` is
 * already handled by the JS gate above, so this keyframe only ever mounts when
 * motion is wanted.
 */
const progressiveTextKeyframes = `
@keyframes suppr-progressive-text-token {
  from {
    opacity: 0;
    transform: translateY(${PROGRESSIVE_TEXT_RISE_PX}px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`;

export default ProgressiveText;
