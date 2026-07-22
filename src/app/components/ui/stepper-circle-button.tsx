"use client";

import * as React from "react";
import { cn } from "./utils";
import { PressableScale } from "./pressable-scale";

export type StepperCircleSizeKey = "sm" | "md" | "lg";

const SIZE_CLASS: Record<StepperCircleSizeKey, string> = {
  sm: "size-[var(--stepper-circle-sm)]",
  md: "size-[var(--stepper-circle-md)]",
  lg: "size-[var(--stepper-circle-lg)]",
};

export interface StepperCircleButtonProps extends React.ComponentProps<"button"> {
  size?: StepperCircleSizeKey;
  bordered?: boolean;
}

export function StepperCircleButton({
  size = "md",
  bordered = false,
  className,
  disabled,
  children,
  ...props
}: StepperCircleButtonProps) {
  return (
    <PressableScale
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted",
        SIZE_CLASS[size],
        bordered && "border border-border",
        disabled && "opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </PressableScale>
  );
}

export default StepperCircleButton;
