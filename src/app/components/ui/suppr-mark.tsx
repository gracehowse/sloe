import * as React from "react";
import { cn } from "./utils";

/**
 * SupprMark — rounded-square brand mark.
 *
 * 2026-05-19: Black-on-cream (light) and white-on-black (dark) via
 * `--brand-mark-bg` / `--brand-mark-ring` — not brand blue.
 */

interface SupprMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

function SupprMark({ size = 32, className, ...props }: SupprMarkProps) {
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
        style={{ fontSize: Math.round(size * 0.64), letterSpacing: "-0.02em" }}
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
        style={{ fontSize: Math.round(size * 0.64), letterSpacing: "-0.02em" }}
      >
        Suppr
      </span>
    </div>
  );
}

export { SupprMark, SupprWordmark, SupprPlateMark, SupprPlateWordmark };
