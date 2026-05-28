"use client";

/**
 * ConfidenceChip — neutral grey chip used for adaptive TDEE display
 * (D-2026-04-27-12).
 *
 * Production design spec — 2026-04-27 §1.6 confidence chip.
 * Three levels (low / medium / high). Background is the neutral
 * `--confidence-neutral` token at 10% — this is calm, NOT a warning.
 * The macro/ingredient confidence pills live elsewhere (ConfidenceDot).
 *
 * Mirror: `apps/mobile/components/ui/ConfidenceChip.tsx`.
 */

import * as React from "react";
import { cn } from "./utils";

export type ConfidenceChipLevel = "low" | "medium" | "high";

export interface ConfidenceChipProps extends React.ComponentProps<"span"> {
  level: ConfidenceChipLevel;
  /** Optional label override; defaults to "{level} confidence". */
  label?: string;
}

const labelText: Record<ConfidenceChipLevel, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function ConfidenceChip({
  level,
  label,
  className,
  style,
  ...props
}: ConfidenceChipProps) {
  const displayLabel = label ?? labelText[level];

  return (
    <span
      data-slot="confidence-chip"
      data-level={level}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        "h-6 px-2 text-[11px] leading-none",
        className,
      )}
      style={{
        backgroundColor: "rgba(148, 163, 184, 0.12)",
        color: "var(--foreground-secondary)",
        ...style,
      }}
      {...props}
    >
      {displayLabel}
    </span>
  );
}

export default ConfidenceChip;
