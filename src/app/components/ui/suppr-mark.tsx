import * as React from "react";
import { cn } from "./utils";

/**
 * Sloe brand mark — wordmark only (2026-06-04 Grace decision).
 *
 * The logo is the lowercase "sloe" wordmark in Newsreader + plum ink
 * (`--foreground-brand`). No berry glyph, no plate ring, no lockup.
 * Component names keep the historical `Suppr*` exports so call-sites
 * stay stable until a rename pass.
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
        "font-[family-name:var(--font-newsreader)] font-medium tracking-tight text-foreground-brand shrink-0",
        className,
      )}
      style={{
        fontSize: sloeFontSize(size),
        lineHeight: 1,
        letterSpacing: "-0.02em",
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
