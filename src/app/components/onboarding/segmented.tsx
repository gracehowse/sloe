"use client";

import * as React from "react";
import { SegmentedTrack } from "@/app/components/ui/segmented-track";

/**
 * Segmented — small pill-style switch for the metric/imperial unit
 * toggle on the Height + Weight steps. Renders as a `radiogroup` so
 * keyboard arrow keys and screen readers behave correctly.
 *
 * Distinct from the shadcn `tabs` primitive — that's for surface-level
 * navigation; this is a binary input control rendered inline with form
 * fields.
 *
 * ENG-1375 S2: now a thin wrapper over the canonical §8 `SegmentedTrack`
 * (full-radius muted rail, card-white thumb + `shadow-sm`, `primary-solid`
 * semibold active label). The previous square bordered track + soft-tint
 * thumb is retired — ONE track-and-thumb grammar product-wide. Mirrors the
 * mobile `MobileSegmented` (`apps/mobile/components/onboarding/segmented.tsx`).
 */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel = "Toggle",
  className,
}: SegmentedProps<T>) {
  return (
    <SegmentedTrack
      role="radiogroup"
      ariaLabel={ariaLabel}
      options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
      value={value}
      onChange={onChange}
      fit="hug"
      className={className}
    />
  );
}
