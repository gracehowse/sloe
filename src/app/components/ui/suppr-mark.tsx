import * as React from "react";
import { cn } from "./utils";

/**
 * Sloe brand mark — wordmark only.
 *
 * The logo is the "Sloe" wordmark (capital S) in Newsreader semibold + plum
 * ink (`--foreground-brand`). No berry glyph, no plate ring, no lockup.
 * Casing + weight match the canonical Figma `654:2` Today frame
 * (`font-headline text-xl font-semibold text-plum`) — updated 2026-06-08 from
 * the earlier lowercase "sloe" / medium treatment so every surface (Today
 * brand bar, sidebar, onboarding, auth) reads the wordmark identically.
 * Component names keep the historical `Suppr*` exports so call-sites stay
 * stable until a rename pass.
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
        "font-[family-name:var(--font-newsreader)] font-semibold tracking-tight text-foreground-brand shrink-0",
        className,
      )}
      style={{
        fontSize: sloeFontSize(size),
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
      {...props}
    >
      Sloe
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
