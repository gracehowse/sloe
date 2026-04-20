import * as React from "react";
import { cn } from "./utils";

/**
 * SupprMark — the rounded-square "S" brand mark.
 *
 * Always blue background with white "S" regardless of theme,
 * matching `public/logo-mark.svg` and `docs/ux/brand-guidelines.md`.
 * The dark variant lifts the blue tint per `--primary` in dark mode
 * but keeps the same letterform.
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
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily='"Inter", system-ui, sans-serif'
        fontWeight={800}
        fontSize={20}
        letterSpacing="-0.02em"
        fill="#ffffff"
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

export { SupprMark, SupprWordmark };
