/**
 * <TareCutoutCard> — card with a quarter-circle "bite" out of one
 * corner, with optional arc text following the curve.
 *
 * Source: Phase 0.5 of the Tare aesthetic rollout
 * (docs/decisions/2026-05-18-tare-aesthetic-foundation.md).
 *
 * Visual rationale: per the 2026-05-18 Noom comparative read, this is
 * the single most signature shape move on their acquisition surfaces —
 * a curved cutout that extends the brand's arc/bowl visual DNA into
 * surface treatment. Pure shape language. Adds personality without
 * being literal or decorative.
 *
 * Scope of use — strict:
 *   - Paywall hero card
 *   - Onboarding "Why Suppr" intro
 *   - Weekly digest editorial card on Progress (optional)
 *   - Anywhere else: DON'T. Daily-use surfaces stay rectangular so
 *     the cutout retains signal value.
 *
 * Implementation: a sibling absolute-positioned circle overlaps the
 * card's corner. The circle's background matches the SURFACE BEHIND
 * the card (page bg or peach surface), creating a fake cutout. This
 * is faster and more reliable cross-browser than CSS clip-path or
 * mask-image, and looks identical at any scale.
 *
 * The arc text uses SVG <textPath> tracing the cutout's curve. The
 * label is optional — pass undefined to get a silent cutout, useful
 * when the card carries its own headline.
 *
 * Activation: the visual only renders when `body.tare-on` is set —
 * outside the flag, the card falls back to a plain rounded card via
 * `.tare-cutout-card`'s base styles. The cutout circle does its job
 * either way; if the feature flag's off, the surface-token fallback
 * still uses sensible defaults (`var(--background)` / `var(--card)`).
 */

"use client";

import type { ReactNode } from "react";
import { cn } from "./utils";

export type CutoutCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface TareCutoutCardProps {
  children: ReactNode;
  /**
   * Background colour BEHIND the card. Use `"peach"` for the marketing
   * peach surface; any other value is passed through as a CSS colour
   * (token reference like `"var(--background)"` recommended). Default:
   * `var(--background)`.
   */
  surfaceBg?: "peach" | string;
  /**
   * Which corner gets the bite. Default top-left, matching Noom's
   * editorial convention.
   */
  corner?: CutoutCorner;
  /**
   * Diameter of the cutout in px. Larger = more dramatic. Default 72px.
   * Don't go below 48px (loses signal) or above 120px (consumes the
   * card content area).
   */
  size?: number;
  /**
   * Optional arc label that traces the cutout curve. Used for the
   * canonical "POWERED BY SCIENCE." pattern. Set in tracked uppercase
   * sans (Inter Medium 500). Pass undefined to suppress.
   */
  arcLabel?: string;
  /**
   * Optional className for the outer card (host adds padding,
   * margin, max-width, etc.).
   */
  className?: string;
  /**
   * `data-testid` for end-to-end tests.
   */
  testId?: string;
}

/**
 * Build the SVG path that traces the cutout curve for the arc text.
 * The path is a quarter-circle arc whose radius matches the cutout
 * diameter / 2, plus a small standoff so the text doesn't kiss the
 * curve. Direction (clockwise / counter-clockwise) flips per corner
 * so the text reads left-to-right at all four positions.
 */
function arcPath(corner: CutoutCorner, size: number, standoff: number): string {
  const r = size / 2 + standoff;
  // Arc starts and ends at the card edges that meet at the chosen
  // corner, sweeping AROUND the cutout circle's centre. Coordinates
  // are relative to a 200x200 SVG viewBox so the text scales cleanly
  // with the card's actual rendered size.
  switch (corner) {
    case "top-left":
      // From left edge (0, r) → arc clockwise → top edge (r, 0)
      return `M ${standoff},${r * 2} A ${r},${r} 0 0 1 ${r * 2},${standoff}`;
    case "top-right":
      return `M ${200 - r * 2},${standoff} A ${r},${r} 0 0 1 ${200 - standoff},${r * 2}`;
    case "bottom-left":
      return `M ${r * 2},${200 - standoff} A ${r},${r} 0 0 1 ${standoff},${200 - r * 2}`;
    case "bottom-right":
      return `M ${200 - standoff},${200 - r * 2} A ${r},${r} 0 0 1 ${200 - r * 2},${200 - standoff}`;
  }
}

export function TareCutoutCard({
  children,
  surfaceBg = "var(--background)",
  corner = "top-left",
  size = 72,
  arcLabel,
  className,
  testId,
}: TareCutoutCardProps) {
  const cutoutSurface =
    surfaceBg === "peach" ? "var(--surface-peach)" : surfaceBg;

  return (
    <div
      className={cn("tare-cutout-card", className)}
      data-cutout-corner={corner}
      data-cutout-surface={surfaceBg === "peach" ? "peach" : undefined}
      data-testid={testId}
      style={
        {
          "--cutout-surface": cutoutSurface,
          "--cutout-size": `${size}px`,
        } as React.CSSProperties
      }
    >
      {arcLabel ? (
        <svg
          viewBox="0 0 200 200"
          width={size + 56}
          height={size + 56}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: corner.startsWith("top") ? -size / 2 : "auto",
            bottom: corner.startsWith("bottom") ? -size / 2 : "auto",
            left: corner.endsWith("left") ? -size / 2 : "auto",
            right: corner.endsWith("right") ? -size / 2 : "auto",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <defs>
            <path id={`tare-cutout-arc-${corner}`} d={arcPath(corner, size, 6)} fill="none" />
          </defs>
          <text
            fontFamily="var(--font-sans)"
            fontSize="10"
            fontWeight="500"
            letterSpacing="0.18em"
            fill="var(--foreground)"
            style={{ textTransform: "uppercase" }}
          >
            <textPath
              href={`#tare-cutout-arc-${corner}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {arcLabel}
            </textPath>
          </text>
        </svg>
      ) : null}
      {children}
    </div>
  );
}

export default TareCutoutCard;
