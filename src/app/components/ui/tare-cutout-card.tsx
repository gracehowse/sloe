/**
 * <TareCutoutCard> — card with a quarter-circle "bite" out of one
 * corner.
 *
 * Source: Phase W0 of the Tare aesthetic rollout
 * (docs/decisions/2026-05-19-suppr-design-direction-v1.md).
 *
 * Scope of use — strict:
 *   - Paywall hero card
 *   - Onboarding "Why Suppr" intro
 *   - Weekly digest editorial card on Progress (optional)
 *   - Anywhere else: DON'T. Daily-use surfaces stay rectangular so
 *     the cutout retains signal value.
 *
 * Implementation: an absolute-positioned circle of the SURFACE-behind
 * colour overlapping the chosen corner. Faked-by-overlap, not a real
 * cutout — but visually identical at any scale and faster + more
 * reliable than CSS clip-path or mask-image.
 *
 * Activation: the cutout visual only renders when `body.tare-on` is
 * set. Outside the flag, the card falls back to its base styles.
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
   * (token reference like `"var(--background)"` recommended).
   */
  surfaceBg?: "peach" | string;
  /** Which corner gets the bite. Default top-left. */
  corner?: CutoutCorner;
  /**
   * Diameter of the cutout in px. Default 72px. Don't go below 48px
   * (loses signal) or above 120px (consumes the card content area).
   */
  size?: number;
  className?: string;
  testId?: string;
}

export function TareCutoutCard({
  children,
  surfaceBg = "var(--background)",
  corner = "top-left",
  size = 72,
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
      {children}
    </div>
  );
}

export default TareCutoutCard;
