"use client";

import * as React from "react";
import { cn } from "@/app/components/ui/utils";

/**
 * BrandedSlider — pointer-driven slider that replaces the native
 * `<input type="range">` on the Pace step. The native control was
 * the single biggest "prototype tell" per `ui-critic` — it visibly
 * differs Mac/Win/Linux and breaks the brand-consistent feel of
 * the rest of the v2 flow.
 *
 * Behaviour:
 *  - Drag the track or thumb to scrub. Snaps to `step`.
 *  - Click anywhere on the track to jump to that value.
 *  - Keyboard: arrows ±step, Page Up/Down ±10×step, Home/End to clamp.
 *  - Optional value bubble above the thumb during interaction.
 *
 * Lives under `onboarding-v2/` for now because the only consumer is
 * the Pace step. Promote to `ui/` if a second surface picks it up.
 */

export interface BrandedSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Track + thumb tint. */
  accent?: string;
  /** Optional `(value) => string` to render above the thumb during drag. */
  formatBubble?: (value: number) => string;
  ariaLabel?: string;
  className?: string;
}

const TRACK_HEIGHT = 6;
const THUMB = 22;

export function BrandedSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  accent = "var(--primary)",
  formatBubble,
  ariaLabel = "Slider",
  className,
}: BrandedSliderProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [active, setActive] = React.useState(false);
  const pointerIdRef = React.useRef<number | null>(null);

  const range = max - min;
  const pct = range === 0 ? 0 : ((value - min) / range) * 100;

  const clamp = React.useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max],
  );
  const snap = React.useCallback(
    (v: number) => {
      const snapped = Math.round((v - min) / step) * step + min;
      // Round to mitigate float pollution from the multiply / divide.
      return Math.round(snapped * 1000) / 1000;
    },
    [min, step],
  );

  const valueAtClientX = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return snap(clamp(min + ratio * range));
    },
    [value, min, range, snap, clamp],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    pointerIdRef.current = e.pointerId;
    trackRef.current.setPointerCapture(e.pointerId);
    setActive(true);
    onChange(valueAtClientX(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current == null) return;
    onChange(valueAtClientX(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current == null) return;
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    pointerIdRef.current = null;
    setActive(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let handled = true;
    if (e.key === "ArrowLeft") onChange(snap(clamp(value - step)));
    else if (e.key === "ArrowRight") onChange(snap(clamp(value + step)));
    else if (e.key === "PageDown") onChange(snap(clamp(value - step * 10)));
    else if (e.key === "PageUp") onChange(snap(clamp(value + step * 10)));
    else if (e.key === "Home") onChange(min);
    else if (e.key === "End") onChange(max);
    else handled = false;
    if (handled) e.preventDefault();
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-full select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-md",
        active ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      style={{ height: THUMB + 8, paddingTop: 8, paddingBottom: 8 }}
    >
      {/* Track background */}
      <div
        className="absolute left-0 right-0 rounded-full bg-input-background"
        style={{
          height: TRACK_HEIGHT,
          top: `calc(50% - ${TRACK_HEIGHT / 2}px)`,
        }}
      />
      {/* Filled portion */}
      <div
        className="absolute left-0 rounded-full transition-[width] duration-75"
        style={{
          height: TRACK_HEIGHT,
          top: `calc(50% - ${TRACK_HEIGHT / 2}px)`,
          width: `${pct}%`,
          background: accent,
        }}
      />
      {/* Thumb */}
      <div
        aria-hidden
        className="absolute rounded-full transition-transform"
        style={{
          width: THUMB,
          height: THUMB,
          top: `calc(50% - ${THUMB / 2}px)`,
          left: `calc(${pct}% - ${THUMB / 2}px)`,
          background: accent,
          boxShadow: active
            ? `0 0 0 6px color-mix(in oklab, ${accent} 18%, transparent), 0 4px 12px ${accent}55`
            : `0 2px 6px ${accent}55`,
          transform: active ? "scale(1.08)" : "scale(1)",
        }}
      />
      {/* Value bubble during drag */}
      {active && formatBubble ? (
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `calc(${pct}% )`,
            top: -4,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="px-2 py-1 rounded-md text-xs font-bold tabular-nums shadow-md"
            style={{
              background: accent,
              color: "var(--primary-foreground)",
              whiteSpace: "nowrap",
            }}
          >
            {formatBubble(value)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
