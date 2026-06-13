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
 */
import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";

export type SupprButtonVariant = "primary" | "ghost";

export interface SupprButtonProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  variant: SupprButtonVariant;
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

export function SupprButton({
  variant,
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
      disabled={blocked}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cn("px-5 font-semibold", VARIANT_CLASSES[variant], className)}
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
