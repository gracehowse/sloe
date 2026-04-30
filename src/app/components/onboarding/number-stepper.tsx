"use client";

import * as React from "react";
import { cn } from "@/app/components/ui/utils";

/**
 * NumberStepper — used by the Age step (and any future "small integer"
 * input). Tactile − / + buttons either side of a tabular-num readout.
 *
 * Lives under `onboarding-v2/` rather than `ui/` because the only
 * shipped consumer is the v2 flow. Promote to `ui/` if a second
 * surface picks it up.
 */

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Hero-sized variant for the Age step's centred stepper. */
  big?: boolean;
  suffix?: string;
  ariaLabel?: string;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 120,
  step = 1,
  big = false,
  suffix,
  ariaLabel = "Value",
  className,
}: NumberStepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const btnSize = big ? "size-12" : "size-10";
  const numSize = big ? "text-[56px]" : "text-4xl";
  const padding = big ? "p-6" : "p-4";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-7 rounded-card bg-card border border-border",
        padding,
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label={`Decrement ${ariaLabel.toLowerCase()}`}
        className={cn(
          "rounded-full bg-muted text-foreground grid place-items-center transition-pm",
          "hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed",
          btnSize,
        )}
      >
        <span className="text-2xl leading-none">−</span>
      </button>

      <div className="text-center" style={{ minWidth: big ? 140 : 100 }}>
        <div
          className={cn(
            "font-extrabold tracking-tight tabular-nums leading-none text-foreground",
            numSize,
          )}
          style={{ letterSpacing: "-0.03em" }}
          aria-label={ariaLabel}
          aria-live="polite"
        >
          {value}
        </div>
        {suffix && (
          <div className="section-label mt-1.5">{suffix}</div>
        )}
      </div>

      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label={`Increment ${ariaLabel.toLowerCase()}`}
        className={cn(
          "rounded-full bg-muted text-foreground grid place-items-center transition-pm",
          "hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed",
          btnSize,
        )}
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    </div>
  );
}
