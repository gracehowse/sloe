import * as React from "react";
import { cn } from "./utils";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

/**
 * SupprMark — the single canonical brand mark entry point.
 *
 * ENG-797 (design-direction 2026-05-31): the product previously shipped
 * THREE mark treatments. `SupprPlateMark` (the concentric-ring "empty
 * plate" motif) is now the one canonical mark per the approved
 * prototype direction. `SupprMark` is the canonical entry point that
 * every consumer calls; when the `design_system_brandmark` flag is on
 * it renders the canonical ring motif, otherwise it falls back to the
 * legacy S-glyph so the old path stays alive until the flag is at 100%.
 *
 * 2026-05-19: Black-on-cream (light) and white-on-black (dark) via
 * `--brand-mark-bg` / `--brand-mark-ring` — not brand blue.
 */

interface SupprMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

/**
 * @deprecated The S-glyph mark is the non-canonical variant (ENG-797).
 * Use the ring motif (`SupprPlateMark`) for all new call-sites. This
 * renderer is kept only as the flag-off fallback inside `SupprMark`.
 */
function SupprGlyphMark({ size = 32, className, ...props }: SupprMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      data-slot="suppr-mark"
      className={cn(className)}
      role="img"
      aria-label="Suppr"
      {...props}
    >
      <rect width="32" height="32" rx="8" fill="var(--brand-mark-bg)" />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily='"Inter", system-ui, sans-serif'
        fontWeight={800}
        fontSize={20}
        letterSpacing="-0.02em"
        fill="var(--brand-mark-ring)"
      >
        S
      </text>
    </svg>
  );
}

/**
 * SupprMark — canonical brand mark entry point (ENG-797).
 *
 * Renders the canonical ring motif when `design_system_brandmark` is
 * enabled; falls back to the legacy S-glyph otherwise. Existing
 * call-sites need no change — the flag flips the visual.
 */
function SupprMark({ size = 32, className, ...props }: SupprMarkProps) {
  if (isFeatureEnabled("design_system_brandmark")) {
    return <SupprPlateMark size={size} className={className} {...props} />;
  }
  return <SupprGlyphMark size={size} className={className} {...props} />;
}

interface SupprWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

function SupprWordmark({ size = 28, className, ...props }: SupprWordmarkProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2.5", className)}
      data-slot="suppr-wordmark"
      {...props}
    >
      <SupprMark size={size} />
      <span
        className="text-foreground font-bold tracking-tight"
        style={{ fontSize: Math.round(size * 0.72), letterSpacing: "-0.02em" }}
      >
        Suppr
      </span>
    </div>
  );
}

function SupprPlateMark({ size = 32, className, ...props }: SupprMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      data-slot="suppr-plate-mark"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Suppr"
      {...props}
    >
      <rect width="32" height="32" rx="8" fill="var(--brand-mark-bg)" />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        stroke="var(--brand-mark-ring)"
        strokeWidth="2"
        fill="none"
        opacity={0.95}
      />
      <circle
        cx="16"
        cy="16"
        r="5.5"
        stroke="var(--brand-mark-ring)"
        strokeWidth="1"
        fill="none"
        opacity={0.35}
      />
    </svg>
  );
}

interface SupprPlateWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

function SupprPlateWordmark({ size = 28, className, ...props }: SupprPlateWordmarkProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2.5", className)}
      data-slot="suppr-plate-wordmark"
      {...props}
    >
      <SupprPlateMark size={size} />
      <span
        className="text-foreground font-bold tracking-tight"
        style={{ fontSize: Math.round(size * 0.72), letterSpacing: "-0.02em" }}
      >
        Suppr
      </span>
    </div>
  );
}

export { SupprMark, SupprWordmark, SupprPlateMark, SupprPlateWordmark };
