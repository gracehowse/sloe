import * as React from "react";
import { cn } from "../ui/utils";

/**
 * Suppr `<Badge>` — the single compact-pill primitive used across the app
 * to tag rows, cells, and titles with a short semantic label (e.g. "AI",
 * "Override", "Added", "Custom", "Leftover", "Pro", "Freeze").
 *
 * The old inline-span badges introduced across Batches 2.7 / 3.9 / 3.10 /
 * 4.11 / 5.13 had divergent padding, font-size and fills. This primitive
 * replaces all of them with a single shape and a variant-driven palette
 * so different labels no longer read as "different apps glued together".
 *
 * Extending: add a new variant here + to the `variantStyles` map. Do not
 * re-roll a new inline pill elsewhere.
 *
 * Variants are deliberately colour-only swaps on top of the same size,
 * padding, radius, weight and uppercase tracking. Anything more than a
 * colour difference belongs in a different primitive.
 */

export type BadgeVariant =
  | "neutral"
  | "info"
  | "warn"
  | "pro"
  | "ai"
  | "added"
  | "override"
  | "leftover"
  | "custom"
  | "freeze";

const variantStyles: Record<BadgeVariant, string> = {
  // Catch-all, matches the previous `bg-muted + text-muted-foreground` AI badge.
  neutral: "bg-muted text-muted-foreground border-transparent",
  // Info — cyan/water token; used for informational metadata. Ink reads the
  // `-solid` teal (AA on the 14% tint), never the raw fill hue (ENG-828).
  info: "bg-[color-mix(in_oklab,var(--macro-water)_14%,transparent)] text-[color:var(--macro-water-solid)] border-[color:color-mix(in_oklab,var(--macro-water)_35%,transparent)]",
  // Warn — amber warning token.
  warn: "bg-warning/10 text-warning-solid border-warning/30",
  // Pro — primary-coloured; marks Pro-gated features.
  pro: "bg-primary/10 text-primary-solid border-primary/30",
  // AI — violet/chart-5 token. Pulled from the existing theme --chart-5.
  ai: "bg-[color-mix(in_oklab,var(--chart-5)_14%,transparent)] text-[color:var(--chart-5)] border-[color:color-mix(in_oklab,var(--chart-5)_35%,transparent)]",
  // Added — success/green: new content the user added themselves. Ink reads
  // `-solid` sage (AA on the /10 tint), never the raw fill hue (ENG-828).
  added: "bg-success/10 text-success-solid border-success/30",
  // Override — amber warning: a manual override pinned on a row.
  override: "bg-warning/10 text-warning-solid border-warning/30",
  // Leftover — subtle accent with amber tone that matches the planner's
  // existing leftover tile chrome.
  leftover: "bg-warning/10 text-warning-solid border-warning/30",
  // Custom — primary: user-created foods in the search results.
  custom: "bg-primary/10 text-primary-solid border-primary/30",
  // Freeze — cyan/water token with a snowflake prefix. Ink reads the `-solid`
  // teal (AA on the 14% tint), never the raw fill hue (ENG-828).
  freeze: "bg-[color-mix(in_oklab,var(--macro-water)_14%,transparent)] text-[color:var(--macro-water-solid)] border-[color:color-mix(in_oklab,var(--macro-water)_35%,transparent)]",
};

/** Variants that carry semantics meaningful to a screen reader. Used to
 *  apply a sensible default `aria-label` when the caller does not pass one. */
const defaultAriaLabel: Partial<Record<BadgeVariant, string>> = {
  pro: "Pro feature",
  override: "Manual override",
  leftover: "Leftover meal",
  freeze: "Streak freeze",
  ai: "AI estimated",
  added: "Added by you",
  custom: "Custom food",
};

export interface BadgeProps extends Omit<React.ComponentProps<"span">, "aria-label"> {
  variant?: BadgeVariant;
  ariaLabel?: string;
  /** Optional leading icon (e.g. a lucide icon). Rendered at size-3. */
  icon?: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  ariaLabel,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  const label = ariaLabel ?? defaultAriaLabel[variant];
  return (
    <span
      data-slot="suppr-badge"
      data-variant={variant}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
        variantStyles[variant],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden className="inline-flex items-center justify-center [&>svg]:size-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

export default Badge;
