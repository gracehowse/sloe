import * as React from "react";
import { cn } from "./utils";

/**
 * Sloe brand mark — wordmark only.
 *
 * The logo is the lowercase "sloe" wordmark in **Fraunces Bold** + plum ink
 * (`--foreground-brand`). No berry glyph, no plate ring, no lockup. Bold (700)
 * matches the splash logotype (Grace 2026-06-26 — the mark read too thin next
 * to the launch logo); supersedes the prior ~360 light. Replaces the
 * 2026-06-08 Newsreader-semibold capital-"Sloe" Figma
 * treatment (Figma is no longer the source of truth — 2026-06-24). Mobile
 * parity: `apps/mobile/components/SloeHeaderWordmark.tsx`. Component names keep
 * the historical `Suppr*` exports so call-sites stay stable until a rename pass.
 */

interface SloeWordmarkTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
  slotName?: string;
}

function sloeFontSize(size: number) {
  return Math.round(size * 0.72);
}

function SloeWordmarkText({
  size = 28,
  className,
  slotName = "sloe-wordmark",
  ...props
}: SloeWordmarkTextProps) {
  // Render the canonical splash logotype SVG (public/sloe-wordmark.svg) as a
  // recolorable CSS mask — `background: currentColor` so the brand ink (default
  // text-foreground-brand, or a caller's text-* override on a dark surface)
  // fills the mark. Only the asset matches the splash; a live Fraunces face
  // can't reproduce its high-opsz stroke contrast (Grace 2026-06-26).
  const fontSize = sloeFontSize(size);
  const height = Math.round(fontSize * 1.15);
  const width = Math.round(height / (1661 / 3088));
  return (
    <span
      role="img"
      aria-label="Sloe"
      data-slot={slotName}
      className={cn("inline-block shrink-0 align-middle text-foreground-brand", className)}
      style={{
        width,
        height,
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/sloe-wordmark.svg)",
        maskImage: "url(/sloe-wordmark.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      {...props}
    />
  );
}

interface SupprMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

/** Compact Sloe wordmark — canonical brand mark entry point (web). */
function SupprMark({ size = 32, className, ...props }: SupprMarkProps) {
  return (
    <SloeWordmarkText
      size={size}
      slotName="sloe-mark"
      className={className}
      {...props}
    />
  );
}

interface SupprWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/** Full Sloe wordmark — same treatment as the mark (no separate glyph). */
function SupprWordmark({ size = 28, className, ...props }: SupprWordmarkProps) {
  return (
    <div
      className={cn("inline-flex items-center", className)}
      data-slot="suppr-wordmark"
      {...props}
    >
      <SloeWordmarkText size={size} slotName="sloe-wordmark" />
    </div>
  );
}

/** @deprecated Alias — plate motif retired; renders the Sloe wordmark. */
function SupprPlateMark({ size = 32, className, ...props }: SupprMarkProps) {
  return <SupprMark size={size} className={className} {...props} />;
}

interface SupprPlateWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/** @deprecated Alias — renders the Sloe wordmark. */
function SupprPlateWordmark({ size = 28, className, ...props }: SupprPlateWordmarkProps) {
  return <SupprWordmark size={size} className={className} {...props} />;
}

export { SupprMark, SupprWordmark, SupprPlateMark, SupprPlateWordmark };
