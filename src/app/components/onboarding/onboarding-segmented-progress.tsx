"use client";

import { cn } from "@/app/components/ui/utils";

/**
 * Figma onboarding chrome (189:2) — discrete plum segments instead of a
 * continuous fill bar. One segment per step in the flow.
 */
export function OnboardingSegmentedProgress({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const segments = Math.max(1, total);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label={`Step ${value} of ${total}`}
      className={cn("flex gap-1.5", className)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <div
          key={index}
          data-segment-index={index}
          data-filled={index < value ? "true" : "false"}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            index < value ? "bg-primary" : "bg-primary/15",
          )}
        />
      ))}
    </div>
  );
}
