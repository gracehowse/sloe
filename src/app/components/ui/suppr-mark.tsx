import * as React from "react";
import { cn } from "./utils";

/**
 * Sloe brand mark — wordmark only.
 *
 * The logo is the lowercase "sloe" wordmark in **Fraunces Light** + plum ink
 * (`--foreground-brand`). No berry glyph, no plate ring, no lockup. Casing +
 * weight + family match the v3 prototype's LOCKED type-split (Fraunces =
 * wordmark only; `.wordmark` = `text-transform: lowercase`, Fraunces ~360
 * light). Supersedes the 2026-06-08 Newsreader-semibold capital-"Sloe" Figma
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
  return (
    <span
      role="img"
      aria-label="Sloe"
      data-slot={slotName}
      className={cn(
        "font-[family-name:var(--font-brand)] font-light tracking-tight text-foreground-brand shrink-0 lowercase",
        className,
      )}
      style={{
        fontSize: sloeFontSize(size),
        lineHeight: 1,
        letterSpacing: "-0.01em",
      }}
      {...props}
    >
      sloe
    </span>
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
