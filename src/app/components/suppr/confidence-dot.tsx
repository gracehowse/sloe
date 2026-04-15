import * as React from "react";
import { cn } from "../ui/utils";

/**
 * ConfidenceDot — a small coloured dot indicating nutrition
 * match confidence (high / medium / low).
 *
 * Can optionally show a text label beside it.
 */

type ConfidenceLevel = "high" | "medium" | "low";

const dotClasses: Record<ConfidenceLevel, string> = {
  high: "bg-confidence-high",
  medium: "bg-confidence-med",
  low: "bg-confidence-low",
};

const labelText: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

interface ConfidenceDotProps extends React.ComponentProps<"span"> {
  level: ConfidenceLevel;
  showLabel?: boolean;
}

function ConfidenceDot({
  level,
  showLabel = false,
  className,
  ...props
}: ConfidenceDotProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", dotClasses[level])}
        aria-hidden
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {labelText[level]}
        </span>
      )}
    </span>
  );
}

export { ConfidenceDot, type ConfidenceLevel };
