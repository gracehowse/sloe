"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";
import { PressableScale } from "./pressable-scale";

export type IconButtonSizeKey = "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconButtonSizeKey, string> = {
  sm: "size-[var(--icon-button-sm)]",
  md: "size-[var(--icon-button-md)]",
  lg: "size-[var(--icon-button-lg)]",
};

export interface IconButtonProps extends React.ComponentProps<"button"> {
  icon: LucideIcon;
  size?: IconButtonSizeKey;
  variant?: "muted" | "ghost";
  iconStrokeWidth?: number;
  /** Required spoken label for the icon-only control. */
  "aria-label": string;
}

export function IconButton({
  icon: Icon,
  size = "md",
  variant = "muted",
  iconStrokeWidth = 2,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <PressableScale
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        SIZE_CLASS[size],
        variant === "ghost" ? "bg-transparent" : "bg-muted",
        disabled && "opacity-40",
        className,
      )}
      {...props}
    >
      <Icon className="size-4 text-foreground" strokeWidth={iconStrokeWidth} aria-hidden />
    </PressableScale>
  );
}

export default IconButton;
