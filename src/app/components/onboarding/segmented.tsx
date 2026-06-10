"use client";

import * as React from "react";
import { cn } from "@/app/components/ui/utils";

/**
 * Segmented — small pill-style switch for the metric/imperial unit
 * toggle on the Height + Weight steps. Renders as a `radiogroup` so
 * keyboard arrow keys and screen readers behave correctly.
 *
 * Distinct from the shadcn `tabs` primitive — that's for surface-level
 * navigation; this is a binary input control rendered inline with form
 * fields.
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
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    const next =
      e.key === "ArrowRight"
        ? options[(idx + 1) % options.length]
        : options[(idx - 1 + options.length) % options.length];
    onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex gap-0.5 rounded-md border border-border bg-card p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3.5 py-1.5 rounded-[7px] text-xs font-bold transition-pm cursor-pointer border-0",
              // Sloe treatment system (2026-06-08): the active segment is a
              // soft aubergine tint + deep-aubergine label, NOT a solid
              // accent fill — parity with the mobile `MobileSegmented`
              // (`Accent.primarySoft` bg + `Accent.primary` label) and the
              // approved component-treatment proto (segmented active = lift +
              // accent label, the accent rationed to small surfaces as a tint).
              // `text-primary-solid` (#4E3260) keeps AA contrast on the 10%
              // tint where `text-primary` would be borderline.
              on
                ? "bg-primary/10 text-primary-solid"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
