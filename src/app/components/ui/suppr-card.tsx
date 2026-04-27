"use client";

/**
 * SupprCard — single card primitive.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * One card primitive across the app. Replaces the various ad-hoc
 * `<div className="rounded-xl border ...">` wrappers + the legacy
 * shadcn `<Card>` for in-product surfaces.
 *
 * Phase 1 ships the primitive only — callers are NOT swept here.
 * That's Phase 2 work per the production design spec.
 *
 * Mirror: `apps/mobile/components/ui/SupprCard.tsx` (same prop names,
 * same variants).
 *
 * Variants:
 *  - `tone`: `neutral` (default) / `primary` / `success` / `warning` / `magenta`
 *  - `elevation`: `none` / `card` (default) / `sheet` / `float`
 *  - `gradient`: bool — applies the north-star gradient when `tone='primary'`
 *  - `border`: bool (default true)
 *  - `padding`: token key — `sm` (8px) / `md` (12px) / `lg` (16px) /
 *                `xl` (20px) / `none`. Default `md`.
 *  - `radius`: token key — `sm` / `md` / `lg` (default — matches
 *               `var(--radius-card)` 16px) / `xl`.
 */

import * as React from "react";
import { cn } from "./utils";

export type SupprCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "magenta";

export type SupprCardElevation = "none" | "card" | "sheet" | "float";

export type SupprCardPadding = "none" | "sm" | "md" | "lg" | "xl";

export type SupprCardRadius = "sm" | "md" | "lg" | "xl";

export interface SupprCardProps extends React.ComponentProps<"div"> {
  tone?: SupprCardTone;
  elevation?: SupprCardElevation;
  gradient?: boolean;
  border?: boolean;
  padding?: SupprCardPadding;
  radius?: SupprCardRadius;
}

const paddingClasses: Record<SupprCardPadding, string> = {
  none: "",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
  xl: "p-5",
};

const radiusClasses: Record<SupprCardRadius, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-[var(--radius-card)]", // 16px
  xl: "rounded-2xl",
};

const elevationVar: Record<SupprCardElevation, string | undefined> = {
  none: undefined,
  card: "var(--elev-card)",
  sheet: "var(--elev-sheet)",
  float: "var(--elev-float)",
};

/**
 * Tone → tinted background + border colour.
 *
 * `tone='primary' + gradient` produces the north-star block bg using the
 * `--north-star-bg-from / --north-star-bg-to / --north-star-border`
 * tokens; otherwise a calm soft tint is used so callers can opt-in to
 * the loud gradient explicitly.
 */
function toneStyle(
  tone: SupprCardTone,
  gradient: boolean,
  border: boolean,
): React.CSSProperties {
  if (tone === "primary" && gradient) {
    return {
      background:
        "linear-gradient(135deg, var(--north-star-bg-from), var(--north-star-bg-to))",
      borderColor: border ? "var(--north-star-border)" : "transparent",
    };
  }

  switch (tone) {
    case "primary":
      return {
        backgroundColor: "var(--accent-muted, rgba(76,108,224,0.08))",
        borderColor: border ? "var(--north-star-border)" : "transparent",
      };
    case "success":
      return {
        backgroundColor: "var(--success-soft)",
        borderColor: border ? "var(--success)" : "transparent",
      };
    case "warning":
      return {
        backgroundColor: "var(--over-budget-soft)",
        borderColor: border ? "var(--over-budget-fg)" : "transparent",
      };
    case "magenta":
      return {
        backgroundColor: "rgba(224,72,136,0.08)",
        borderColor: border ? "var(--source-ai)" : "transparent",
      };
    case "neutral":
    default:
      return {
        backgroundColor: "var(--card)",
        borderColor: border ? "var(--border)" : "transparent",
      };
  }
}

export function SupprCard({
  tone = "neutral",
  elevation = "card",
  gradient = false,
  border = true,
  padding = "md",
  radius = "lg",
  className,
  style,
  children,
  ...props
}: SupprCardProps) {
  const tStyle = toneStyle(tone, gradient, border);
  const elev = elevationVar[elevation];

  const composedStyle: React.CSSProperties = {
    ...tStyle,
    ...(elev ? { boxShadow: elev } : null),
    ...style,
  };

  return (
    <div
      data-slot="suppr-card"
      data-tone={tone}
      data-elevation={elevation}
      data-gradient={gradient ? "true" : undefined}
      className={cn(
        "block",
        radiusClasses[radius],
        paddingClasses[padding],
        border ? "border" : "",
        className,
      )}
      style={composedStyle}
      {...props}
    >
      {children}
    </div>
  );
}

export default SupprCard;
