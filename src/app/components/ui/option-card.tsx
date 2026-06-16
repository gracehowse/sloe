"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "./utils";

/**
 * OptionCard — tappable selection card used by onboarding (goal,
 * sex, activity, diet) and any flow that picks one or many from
 * a small list. Replaces ad-hoc radio-with-icon-and-subtitle blocks.
 *
 * Behaviour:
 *  - Renders as a real `<button>` so keyboard + screen readers work
 *    with no extra ARIA wiring (use `role="radio"` if grouping
 *    single-select).
 *  - Selected state uses `--primary` border + tinted background
 *    (`bg-primary/8`) so it reads against both light and dark.
 *  - Optional `icon` slot uses tinted square (matches IconBox sizing
 *    in `compact` vs default).
 *  - `trailing` prop overrides the default check/uncheck radio
 *    (pass `null` to suppress, e.g. for multi-select chip-style use).
 */

interface OptionCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  selected?: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Round food thumbnail (Figma onboarding 189:2) — takes precedence over icon. */
  thumbnail?: React.ReactNode;
  trailing?: React.ReactNode;
  compact?: boolean;
}

function OptionCard({
  selected = false,
  title,
  subtitle,
  icon,
  thumbnail,
  trailing,
  compact = false,
  className,
  ...props
}: OptionCardProps) {
  const leading = thumbnail ?? icon;
  return (
    <button
      type="button"
      data-slot="option-card"
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      className={cn(
        "w-full text-left flex items-center gap-3.5 rounded-card border bg-card transition-pm",
        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        // Press-state micro-bounce per ui-critic — makes selection
        // feel like an action, not a CSS state-swap.
        "active:scale-[0.985]",
        compact ? "p-3.5" : "p-4",
        selected
          ? "border-primary bg-primary/8"
          : "border-border",
        className,
      )}
      {...props}
    >
      {leading && (
        <span
          className={cn(
            "shrink-0 inline-flex items-center justify-center transition-pm overflow-hidden",
            thumbnail
              ? "size-14 rounded-full"
              : cn(
                  "rounded-md",
                  compact ? "size-9" : "size-11",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                ),
          )}
          aria-hidden
        >
          {leading}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block font-semibold text-foreground tracking-tight leading-snug",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
            {subtitle}
          </span>
        )}
      </span>
      {trailing !== undefined ? (
        trailing
      ) : (
        <span
          aria-hidden
          className={cn(
            "shrink-0 inline-grid place-items-center size-[22px] rounded-full border transition-pm",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-transparent",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      )}
    </button>
  );
}

export { OptionCard };
export type { OptionCardProps };
