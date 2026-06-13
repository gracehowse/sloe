"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../ui/utils";
import {
  PERIOD_TYPES,
  isCurrentPeriod,
  nextPeriod,
  periodLabel,
  periodTypeAccessibilityLabel,
  previousPeriod,
  withPeriodType,
  type ProgressPeriod,
  type WeekStartDay,
} from "../../../lib/nutrition/progressPeriod.ts";

/**
 * ProgressPeriodControl (web) — Apple Health range grammar (ENG-1030).
 *
 * Mirror of `apps/mobile/components/progress/ProgressPeriodControl.tsx`.
 * Same shared period model, same segments, same labels.
 *
 *   1. Segmented control: D / W / M / 6M / Y in the chip grammar
 *      (selected = `bg-primary-soft` + `text-primary-solid` + semibold; the
 *      web equivalent of the mobile §8 treatment, matching the existing
 *      range-pill grammar already on ProgressDashboard).
 *   2. Paging row: ‹ label › — chevron buttons flank the period label. The
 *      forward chevron is disabled on the current period (no future).
 *
 * Chevrons are mandatory (per ENG-1030); horizontal swipe on the content area
 * is an optional accelerator the host can wire via `usePeriodSwipe`. Keyboard:
 * the segmented control is a `tablist` with arrow-key movement, matching the
 * mobile accessibility contract.
 */

export interface ProgressPeriodControlProps {
  period: ProgressPeriod;
  weekStart: WeekStartDay;
  onChange: (next: ProgressPeriod) => void;
  /** Injected for deterministic labels in tests; defaults to real clock. */
  now?: Date;
  className?: string;
}

export function ProgressPeriodControl({
  period,
  weekStart,
  onChange,
  now,
  className,
}: ProgressPeriodControlProps) {
  const atCurrent = isCurrentPeriod(period);
  const label = periodLabel(period, weekStart, now);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = PERIOD_TYPES.indexOf(period.type);
    if (idx < 0) return;
    const nextType =
      e.key === "ArrowRight"
        ? PERIOD_TYPES[(idx + 1) % PERIOD_TYPES.length]
        : PERIOD_TYPES[(idx - 1 + PERIOD_TYPES.length) % PERIOD_TYPES.length];
    onChange(withPeriodType(period, nextType));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 1. SEGMENTED CONTROL */}
      <div
        role="tablist"
        aria-label="Progress time range"
        data-testid="progress-period-segments"
        onKeyDown={onKeyDown}
        className="flex gap-1.5"
      >
        {PERIOD_TYPES.map((type) => {
          const active = type === period.type;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={periodTypeAccessibilityLabel(type)}
              tabIndex={active ? 0 : -1}
              data-testid={`progress-period-segment-${type}`}
              onClick={() => {
                if (type !== period.type) onChange(withPeriodType(period, type));
              }}
              className={cn(
                "flex-1 rounded-full py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                active
                  ? "bg-primary-soft text-primary-solid font-semibold"
                  : "bg-card text-muted-foreground font-medium hover:text-foreground",
              )}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* 2. PERIOD PAGING — ‹ label › */}
      <div
        data-testid="progress-period-pager"
        className="flex items-center justify-center gap-4"
      >
        <button
          type="button"
          aria-label="Previous period"
          data-testid="progress-period-prev"
          onClick={() => onChange(previousPeriod(period))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        <span
          data-testid="progress-period-label"
          aria-live="polite"
          className="min-w-[160px] text-center text-[15px] font-semibold text-foreground"
        >
          {label}
        </span>

        <button
          type="button"
          aria-label="Next period"
          aria-disabled={atCurrent}
          disabled={atCurrent}
          data-testid="progress-period-next"
          onClick={() => {
            if (!atCurrent) onChange(nextPeriod(period));
          }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            atCurrent
              ? "opacity-30 cursor-not-allowed"
              : "hover:text-foreground hover:bg-muted",
          )}
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/**
 * Optional swipe accelerator for the web content area. Returns pointer
 * handlers that page prev/next on a horizontal drag past `threshold`px.
 * Chevrons remain the primary path; this is purely additive (web swipe is
 * optional per ENG-1030).
 */
export function usePeriodSwipe(
  period: ProgressPeriod,
  onChange: (next: ProgressPeriod) => void,
  threshold = 64,
) {
  const startX = React.useRef<number | null>(null);
  const startY = React.useRef<number | null>(null);
  const reset = () => {
    startX.current = null;
    startY.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
      startY.current = e.clientY;
    },
    // Reset on a cancelled/left gesture (no pointerup) so a stale start can't
    // leak into a later unrelated pointerup. Mobile gets this free from the
    // PanResponder lifecycle (ENG-1031 review hardening).
    onPointerCancel: reset,
    onPointerLeave: reset,
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current == null || startY.current == null) {
        reset();
        return;
      }
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      reset();
      if (Math.abs(dx) < threshold) return;
      // Axis guard (parity with the mobile PanResponder `shouldClaimChartSwipe`):
      // only page on a deliberately HORIZONTAL gesture, so a diagonal scroll-fling
      // with a >threshold horizontal component doesn't spuriously change period.
      if (Math.abs(dx) <= Math.abs(dy)) return;
      // Swipe right (dx > 0) → go back in time (prev); swipe left → forward.
      if (dx > 0) onChange(previousPeriod(period));
      else if (!isCurrentPeriod(period)) onChange(nextPeriod(period));
    },
  };
}
