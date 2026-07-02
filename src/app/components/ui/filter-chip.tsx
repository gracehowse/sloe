"use client";

import * as React from "react";

import { cn } from "./utils";

export type FilterChipProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: React.ReactNode;
  selected?: boolean;
  size?: "sm" | "md";
};

/**
 * §7 filter / option chip — rounded-full, quiet card fill at rest; selected =
 * primary-soft fill + primary-solid label; no accent ring (ENG-1022).
 */
export function FilterChip({
  label,
  selected = false,
  size = "sm",
  className,
  type = "button",
  disabled,
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={rest["aria-pressed"] ?? selected}
      className={cn(
        "shrink-0 rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        size === "sm" ? "px-4 py-2 text-xs" : "px-4 py-2 text-sm",
        selected
          ? "bg-primary-soft text-primary-solid font-semibold"
          : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}
