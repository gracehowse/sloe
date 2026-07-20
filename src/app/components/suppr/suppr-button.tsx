"use client";

/**
 * SupprButton — the shared CTA primitive (web).
 *
 * Web mirror of `apps/mobile/components/ui/SupprButton.tsx`. Same prop contract
 * (`variant: "primary" | "ghost"`, `loading`, `disabled`, `label`/`children`)
 * so the two platforms read identically.
 *
 * Grammar (`docs/decisions/2026-06-12-button-system-solid-primary.md`):
 *   - `primary` — SOLID aubergine fill (`bg-primary-solid`), WHITE label,
 *     `rounded-full` pill, sans-semibold label (NOT the serif headline ramp —
 *     serif on a control reads dated; mirrors mobile Type.button). Solid fill IS the affordance —
 *     NO border, NO shadow (flat-card canon). Exactly ONE per screen (FAB +
 *     conversion paywalls excepted). Hover darkens; `:focus-visible` ring +
 *     active retained from the base `Button`.
 *   - `ghost` — transparent, NO border, plum label (`text-primary-solid`),
 *     same radius/padding. Replaces BOTH the old outline AND the beige
 *     `bg-card` fill secondary. Hover gets a faint plum tint (not a fill slab).
 *
 * Built on the shadcn `Button` so it inherits the shared focus-ring,
 * disabled-opacity, and svg sizing. The new variants live here rather than in
 * `button.tsx` so the existing shadcn `default`/`ghost` toolbar semantics used
 * across the web app keep their meaning; this primitive carries the CTA grammar.
 *
 * `size` (ENG-1590, 2026-07-20): mirrors mobile `SupprButton`'s `size` prop,
 * which web previously had no equivalent for — every call site that wanted a
 * compact CTA hand-rolled its own `h-N px-N` Tailwind override instead (e.g.
 * `quick-log-button.tsx`'s old `className="h-9 px-4"`), each landing on a
 * slightly different footprint. `sm` now gives ONE canonical compact size,
 * padding-driven (no fixed height) exactly like mobile's `size="sm"`
 * (`paddingVertical: Spacing.sm` / `paddingHorizontal: Spacing.md` = 8/16px).
 * `md` (default) is unchanged from the pre-ENG-1590 behaviour (fixed 40px
 * height, 20px horizontal padding) — not part of the confirmed drift, so left
 * as-is rather than blast-radius-changed across every consumer.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";

export type SupprButtonVariant = "primary" | "ghost";

/** `md` (default) — unchanged 40px-tall CTA. `sm` — compact, padding-driven
 *  (mirrors mobile `size="sm"`: 8px vertical / 16px horizontal). */
export type SupprButtonSize = "md" | "sm";

export interface SupprButtonProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  variant: SupprButtonVariant;
  /** Compact CTA for dense card/row surfaces. Default `md`. */
  size?: SupprButtonSize;
  loading?: boolean;
  /** Convenience text label. Ignored if `children` is provided. */
  label?: string;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<SupprButtonVariant, string> = {
  // Solid aubergine fill, white label, pill, no border, no shadow.
  primary:
    "rounded-full border-0 bg-primary-solid text-white shadow-none hover:bg-primary-solid/90 active:bg-primary-solid/80",
  // Transparent, no border, plum label, faint plum hover tint (not a fill slab).
  ghost:
    "rounded-full border-0 bg-transparent text-primary-solid shadow-none hover:bg-primary-solid/10 active:bg-primary-solid/15",
};

// ENG-1590 — `sm` mirrors mobile's `size="sm"` padding (Spacing.sm=8 vertical /
// Spacing.md=16 horizontal, `py-2 px-4`), with `h-auto` so padding (not a
// fixed height) drives the box — same model as RN's padding-only Pressable.
// `md` keeps the pre-existing `px-5` + the base Button's `size="lg"` (h-10).
const SIZE_CLASSES: Record<SupprButtonSize, string> = {
  md: "px-5",
  sm: "h-auto py-2 px-4",
};

export function SupprButton({
  variant,
  size = "md",
  loading = false,
  disabled = false,
  label,
  children,
  className,
  onClick,
  ...rest
}: SupprButtonProps) {
  const blocked = disabled || loading;

  return (
    <Button
      // Base `Button` keeps the shared focus-ring + layout; we override colour,
      // radius, and elevation to the CTA grammar via VARIANT_CLASSES.
      variant="ghost"
      size="lg"
      data-variant={variant}
      data-size={size}
      disabled={blocked}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cn("font-semibold", SIZE_CLASSES[size], VARIANT_CLASSES[variant], className)}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span className="sr-only">Loading</span>
        </>
      ) : children ? (
        children
      ) : (
        label
      )}
    </Button>
  );
}

export default SupprButton;
