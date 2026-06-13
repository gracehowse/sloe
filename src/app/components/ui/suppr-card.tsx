"use client";

/**
 * SupprCard — single CANONICAL card primitive.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * One card primitive across the app. Replaces the various ad-hoc
 * `<div className="rounded-xl border ...">` wrappers + the legacy
 * shadcn `<Card>` for in-product surfaces. Surface agents should route
 * flat `bg-card border` resting cards through this — do NOT hand-roll
 * shadows. (Design Direction 2026, 2026-06-01.)
 *
 * Mirror: `apps/mobile/components/ui/SupprCard.tsx` (same prop names,
 * same variants, same UN-GATED elevation behaviour as mobile).
 *
 * ── Elevation model (Design Direction 2026 → FLAT-CARD, 2026-06-12) ──
 * Resting tier (`elevation="slab-flat"`, default) is a FLAT warm slab — no
 * shadow, no hairline; the `bg-card` fill on the page is the separation (the
 * Sloe Figma `654:2` look). The `card` tier is NO LONGER a soft-shadow lift:
 * the flat-card decision (`docs/decisions/2026-06-12-flat-card-surfaces.md`,
 * Withings grammar) flipped the `.card-slab` utility (`src/styles/theme.css`)
 * to FLAT — `box-shadow: none; border-width: 0`. So `card` now resolves flat
 * too: identical to `slab-flat` in LIGHT (flat `--card`, white-on-cream contrast
 * is the only separation); in DARK it takes the tonal `--card-elevated` fill
 * (the lone remaining differentiation — still no shadow, no hairline). The
 * internal `softSlab` flag name is historical; the tier is flat. Mirrors
 * `apps/mobile/hooks/useCardElevation.ts`, which the same decision flipped
 * soft→flat. `sheet` / `float` keep their shadows — they are TRANSIENT surfaces
 * (the one place elevation is still allowed); `none` has no elevation.
 *
 * Variants:
 *  - `tone`: `neutral` (default) / `primary` / `success` / `warning` / `magenta`
 *  - `elevation`: `none` / `slab-flat` (default — flat warm slab) / `card`
 *                 (also flat since the 2026-06-12 flat-card decision; tonal
 *                 `--card-elevated` fill in dark only) / `sheet` / `float`
 *                 (transient surfaces — keep shadow)
 *  - `gradient`: bool — applies the north-star gradient when `tone='primary'`
 *  - `border`: bool (default true)
 *  - `padding`: token key — `sm` (8px) / `md` (12px) / `lg` (16px) /
 *                `xl` (20px) / `none`. Default `md`.
 *  - `radius`: token key — `sm` / `md` / `lg` (default — matches
 *               `var(--radius-card-lg)` 24px, the Sloe warm-slab corner;
 *               mirrors mobile `CARD_RADIUS`/`TILE_RADIUS = 24`) / `xl`.
 */

import * as React from "react";
import { cn } from "./utils";

export type SupprCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "magenta";

export type SupprCardElevation = "none" | "card" | "slab-flat" | "sheet" | "float";

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
  lg: "rounded-[var(--radius-card-lg)]", // 24px — Sloe warm-slab corner (mirrors mobile CARD_RADIUS/TILE_RADIUS)
  xl: "rounded-2xl",
};

const elevationVar: Record<SupprCardElevation, string | undefined> = {
  none: undefined,
  card: "var(--elev-card)",
  "slab-flat": undefined,
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
        backgroundColor: "rgba(223, 94, 188,0.08)",
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
  elevation = "slab-flat",
  gradient = false,
  border = true,
  padding = "md",
  radius = "lg",
  className,
  style,
  children,
  ...props
}: SupprCardProps) {
  const softSlab = elevation === "card";
  const flatSlab = elevation === "slab-flat";

  // Light slab: shadow carries separation — no hairline. Dark slab: CSS
  // `.card-slab` adds hairline + card-elevated fill; inline border off in light.
  const effectiveBorder = softSlab || flatSlab ? false : border;
  const tStyle = toneStyle(tone, gradient, effectiveBorder);
  const elev =
    softSlab || flatSlab ? undefined : elevationVar[elevation as Exclude<SupprCardElevation, "slab-flat">];

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
      data-soft-elevation={softSlab ? "true" : undefined}
      data-flat-slab={flatSlab ? "true" : undefined}
      className={cn(
        "block",
        radiusClasses[radius],
        paddingClasses[padding],
        softSlab ? "card-slab" : "",
        flatSlab ? "card-slab-flat" : "",
        effectiveBorder ? "border" : "",
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
