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
 * same variants, same flag-gated elevation behaviour).
 *
 * ── Elevation model (Design Direction 2026) ──
 * The card's resting tier (`elevation="card"`, the default) is the one
 * blessed elevation. When `design_system_elevation` is ON it adopts the
 * soft ambient shadow (`--elev-card-soft`, light = `0 4px 12px
 * rgba(28,25,22,.07)`) and DROPS its hairline border — one edge, no double
 * line — matching the mobile `useCardElevation` treatment and the
 * Settings/RecipeDetail/dialogs sweep already in flight. When the flag is
 * OFF the resting card keeps its exact prior flat `--elev-card` + hairline
 * border treatment, byte-for-byte. `sheet` / `float` / `none` tiers are
 * unaffected by the flag (overlays keep their heavier shadow).
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
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

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
  // Design Direction 2026 (ENG-795): soft ambient elevation on the resting
  // `card` tier when `design_system_elevation` is ON. Mirrors the mobile
  // SupprCard (`elevation === "card" && isFeatureEnabled(...)`). Flag OFF, or
  // any non-`card` tier, keeps the exact prior flat treatment byte-for-byte.
  const softElevation =
    elevation === "card" && isFeatureEnabled("design_system_elevation");

  // Under soft elevation the hairline border is dropped (one edge, no double
  // line) — so the tone style is recomputed with `border = false` to clear its
  // `borderColor`, and the `border` utility class is omitted below.
  const effectiveBorder = softElevation ? false : border;
  const tStyle = toneStyle(tone, gradient, effectiveBorder);
  const elev = softElevation ? "var(--elev-card-soft)" : elevationVar[elevation];

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
      data-soft-elevation={softElevation ? "true" : undefined}
      className={cn(
        "block",
        radiusClasses[radius],
        paddingClasses[padding],
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
